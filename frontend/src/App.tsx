import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  distanceKm,
  etaMinutes as computeEtaMinutes,
  invertRoute,
  isReturnRoute,
  projectUserOnRoute,
  type BusUpdate,
  type Route,
} from "@costa-bus/shared";
import { useSocket, ALERT_ETA_THRESHOLD_MINUTES } from "./hooks/useSocket";
import { useAlarmSound } from "./hooks/useAlarmSound";
import { useGeolocation } from "./hooks/useGeolocation";
import { MapView } from "./components/MapView";
import { BusList } from "./components/BusList";
import { AlertList } from "./components/AlertList";
import { PurchaseLinks } from "./components/PurchaseLinks";
import { GoModePanel } from "./components/GoModePanel";

/**
 * Color de la ruta de regreso de cada ruta base, para que la ida y la vuelta
 * de un mismo corredor se distingan de un vistazo en el mapa y en la leyenda.
 */
const RETURN_COLORS: Record<string, string> = {
  "gdl-barra-navidad": "#60a5fa",
  "gdl-manzanillo": "#c084fc",
  "manzanillo-barra-navidad": "#fcd34d",
  "barra-navidad-puerto-vallarta": "#6ee7b7",
};

/** Elige el color de la ruta de regreso (o el mismo si no hay uno definido). */
function returnColorFor(route: Route): string {
  return RETURN_COLORS[route.id] ?? route.color;
}

/** Aplicación principal de Costa Bus Tracker. */
export function App() {
  const { routes, buses, alerts, connected, offline, clearAlerts } =
    useSocket();
  const { unlock, playArrivalAlert, playUrgentAlert } = useAlarmSound();
  const {
    location,
    loading: locating,
    error: locationError,
    request: requestLocation,
  } = useGeolocation();

  const [selectedDirectionId, setSelectedDirectionId] = useState<string>("");
  const [followedBusId, setFollowedBusId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [ringing, setRinging] = useState(false);

  // Última ETA por la que se disparó alarma, para no repetir el tono en cada tick.
  const lastRungRef = useRef<{ busId: string; stopIndex: number } | null>(null);

  /**
   * Catálogo de direcciones por las que se puede navegar: por cada ruta base
   * se genera la de ida y, al darle clic, su trayecto de regreso (paradas
   * invertidas). Mismo corredor, dos sentidos seleccionables.
   */
  const routeDirections = useMemo<Route[]>(
    () =>
      routes.flatMap((route) => [
        route,
        invertRoute(route, returnColorFor(route)),
      ]),
    [routes],
  );

  // Selecciona la primera dirección en cuanto el catálogo está disponible.
  useEffect(() => {
    if (selectedDirectionId || routeDirections.length === 0) return;
    setSelectedDirectionId(routeDirections[0].id);
  }, [routeDirections, selectedDirectionId]);

  const selectedRoute = useMemo(
    () => routeDirections.find((route) => route.id === selectedDirectionId),
    [routeDirections, selectedDirectionId],
  );

  /** Proyección del usuario sobre la dirección seleccionada (si hay GPS). */
  const userProjection = useMemo(() => {
    if (!location || !selectedRoute || selectedRoute.cities.length < 2) {
      return null;
    }
    return projectUserOnRoute(selectedRoute, location.lat, location.lng);
  }, [location, selectedRoute]);

  /**
   * ETA (en minutos) de cada bus hasta la parada de referencia del usuario.
   * Solo se calcula cuando hay ubicación; si no, el panel usa la ETA normal.
   */
  const etaToUserByBus = useMemo(() => {
    const map: Record<string, number> = {};
    if (!userProjection) return map;

    for (const bus of buses) {
      if (bus.routeId !== selectedRoute?.id) continue;
      if (bus.nextStopIndex > userProjection.nextStopIndex) continue;
      if (userProjection.nextStopIndex >= selectedRoute.cities.length) continue;

      const target = selectedRoute.cities[userProjection.nextStopIndex];
      const remainingKm = distanceKm(
        bus.lat,
        bus.lng,
        target.lat,
        target.lng,
      );
      map[bus.busId] = computeEtaMinutes(remainingKm, bus.speedKmh);
    }
    return map;
  }, [buses, selectedRoute, userProjection]);

  const routeBuses = useMemo(
    () => buses.filter((bus) => bus.routeId === selectedDirectionId),
    [buses, selectedDirectionId],
  );

  const busesToUser = useMemo(
    () =>
      routeBuses.filter((bus) => (etaToUserByBus[bus.busId] ?? Infinity) < Infinity),
    [routeBuses, etaToUserByBus],
  );

  const nearestBusToUser = useMemo(() => {
    let best: BusUpdate | null = null;
    for (const bus of busesToUser) {
      const eta = etaToUserByBus[bus.busId];
      if (!best || eta < etaToUserByBus[best.busId]) best = bus;
    }
    return best;
  }, [busesToUser, etaToUserByBus]);

  const followedBus = useMemo(
    () => buses.find((bus) => bus.busId === followedBusId) ?? null,
    [buses, followedBusId],
  );

  /** Activa o desactiva el Modo GO sobre un autobús. */
  const handleFollow = useCallback(
    (bus: BusUpdate) => {
      void unlock();
      setFollowedBusId((current) => {
        if (current === bus.busId) {
          setRinging(false);
          return null;
        }
        // Al cambiar de objetivo, se permite una nueva alarma inmediata.
        lastRungRef.current = null;
        return bus.busId;
      });
    },
    [unlock],
  );

  const handleStopFollow = useCallback(() => {
    setFollowedBusId(null);
    setRinging(false);
    lastRungRef.current = null;
  }, []);

  const handleToggleSound = useCallback(() => {
    void unlock();
    setSoundEnabled((value) => !value);
  }, [unlock]);

  /* ------------------------------------------------------------------ */
  /*  Modo GO: alarma de sonido cuando el bus seguido está por llegar     */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!followedBus) {
      setRinging(false);
      return;
    }

    const withinThreshold =
      followedBus.etaMinutes <= ALERT_ETA_THRESHOLD_MINUTES;

    if (!withinThreshold) {
      setRinging(false);
      return;
    }

    const alreadyRung =
      lastRungRef.current?.busId === followedBus.busId &&
      lastRungRef.current?.stopIndex === followedBus.nextStopIndex;

    setRinging(true);

    if (alreadyRung) return;
    lastRungRef.current = {
      busId: followedBus.busId,
      stopIndex: followedBus.nextStopIndex,
    };

    if (!soundEnabled) return;

    // Repite el aviso un par de veces para que sea difícil de ignorar.
    playArrivalAlert();
    if (followedBus.etaMinutes <= 2) {
      playUrgentAlert();
    }
  }, [followedBus, soundEnabled, playArrivalAlert, playUrgentAlert]);

  // Cuenta de vehículos en umbral de llegada dentro de la ruta seleccionada.
  const soonCount = useMemo(
    () =>
      routeBuses.filter((bus) => bus.etaMinutes <= ALERT_ETA_THRESHOLD_MINUTES)
        .length,
    [routeBuses],
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__brand">
          <h1 className="app-header__title">
            <span className="mi" aria-hidden="true">
              directions_bus
            </span>{" "}
            Costa Bus Tracker
          </h1>
          <span className="app-header__subtitle">
            Costa de Jalisco · datos simulados (fase 1)
          </span>
        </div>

        <div className="app-header__spacer" />

        {soonCount > 0 && (
          <span className="status" title="Autobuses a ≤ 5 minutos">
            <span className="mi" aria-hidden="true">
              timer
            </span>{" "}
            {soonCount} por llegar
          </span>
        )}

        <span
          className={`status ${connected ? "status--online" : "status--offline"}`}
          title={
            connected
              ? "Conectado al servidor de telemetría"
              : "Sin conexión: mostrando el último estado conocido"
          }
        >
          <span className="status__dot" />
          {connected ? "En vivo" : offline ? "Sin conexión" : "Conectando…"}
        </span>
      </header>

      <div className="app-body">
        <MapView
          routes={routeDirections}
          buses={buses}
          selectedRouteId={selectedDirectionId}
          followBusId={followedBusId}
          userLocation={location}
          userPoint={userProjection?.point ?? null}
        />

        <GoModePanel
          bus={followedBus}
          ringing={ringing}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          onStop={handleStopFollow}
        />

        <aside className="sidebar">
          <section>
            <h2 className="sidebar__section-title">
              <span>
                <span className="mi" aria-hidden="true">
                  map
                </span>{" "}
                Ruta
              </span>
            </h2>

            <div className="route-controls">
              <select
                className="route-select"
                value={selectedDirectionId}
                onChange={(event) => setSelectedDirectionId(event.target.value)}
                aria-label="Seleccionar ruta y sentido"
              >
                <optgroup label="Ida">
                  {routeDirections
                    .filter((route) => !isReturnRoute(route))
                    .map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.name}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Regreso">
                  {routeDirections
                    .filter((route) => isReturnRoute(route))
                    .map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.name}
                      </option>
                    ))}
                </optgroup>
              </select>

              <button
                type="button"
                className={`btn ${isReturnRoute(selectedRoute ?? routeDirections[0] ?? { id: "" } as Route) ? "btn--primary" : ""}`}
                disabled={!selectedRoute}
                onClick={() => {
                  if (!selectedRoute) return;
                  const baseId = selectedRoute.id.replace(/-return$/, "");
                  const target = isReturnRoute(selectedRoute)
                    ? baseId
                    : `${selectedRoute.id}-return`;
                  const exists = routeDirections.some((r) => r.id === target);
                  if (exists) setSelectedDirectionId(target);
                }}
                title="Cambiar al sentido de regreso de esta ruta"
              >
                <span className="mi" aria-hidden="true">
                  swap_horiz
                </span>{" "}
                {selectedRoute && isReturnRoute(selectedRoute)
                  ? "Ver sentido de ida"
                  : "Ver sentido de regreso"}
              </button>
            </div>

            {selectedRoute && (
              <div className="route-meta">
                <span className="chip">
                  <span
                    className="chip__swatch"
                    style={{ background: selectedRoute.color }}
                  />
                  {selectedRoute.cities.length} paradas
                </span>
                <span className="chip">
                  <span className="mi" aria-hidden="true">
                    directions_bus
                  </span>{" "}
                  {routeBuses.length} unidades
                </span>
                <span className="chip">
                  <span className="mi" aria-hidden="true">
                    corporate_fare
                  </span>{" "}
                  {selectedRoute.operators.length} operadores
                </span>
              </div>
            )}
          </section>

          <section>
            <h2 className="sidebar__section-title">
              <span>
                <span className="mi" aria-hidden="true">
                  directions_bus
                </span>{" "}
                Autobuses en circulación
              </span>
              <span>{routeBuses.length}</span>
            </h2>

            <BusList
              buses={routeBuses}
              followedBusId={followedBusId}
              onFollow={handleFollow}
              etaToUserByBus={etaToUserByBus}
              userStopName={userProjection?.nextStopName ?? null}
            />
          </section>

          <AlertList alerts={alerts} onClear={clearAlerts} />

          {location ? (
            <div className="location-banner location-banner--ok">
              <span className="mi" aria-hidden="true">
                my_location
              </span>
              <div>
                <strong>Usando tu ubicación</strong>
                <div className="location-banner__hint">
                  {userProjection
                    ? `Las ETAs se calculan hasta ${userProjection.nextStopName}.`
                    : "No estás cerca del corredor de esta ruta."}
                </div>
                {nearestBusToUser &&
                  etaToUserByBus[nearestBusToUser.busId] !== undefined && (
                    <div className="location-banner__hint">
                      El más cercano ({nearestBusToUser.busId}) llega en ~
                      {Math.max(1, Math.round(etaToUserByBus[nearestBusToUser.busId]))} min.
                    </div>
                  )}
              </div>
            </div>
          ) : (
            <div className="location-banner">
              <span className="mi" aria-hidden="true">
                location_on
              </span>
              <div style={{ flex: 1 }}>
                <strong>Ubicación desactivada</strong>
                <div className="location-banner__hint">
                  Actívala para ver cuánto falta para que un autobús llegue a
                  donde estás.
                </div>
                {locationError && (
                  <div className="location-banner__hint location-banner__hint--error">
                    {locationError}
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn--primary"
                  style={{ marginTop: 8 }}
                  disabled={locating}
                  onClick={requestLocation}
                >
                  <span className="mi" aria-hidden="true">
                    my_location
                  </span>{" "}
                  {locating ? "Obteniendo…" : "Usar mi ubicación"}
                </button>
              </div>
            </div>
          )}

          <PurchaseLinks
            operators={selectedRoute?.operators ?? []}
            routeName={selectedRoute?.name ?? ""}
          />

          <footer
            style={{
              fontSize: "0.72rem",
              color: "var(--text-muted)",
              borderTop: "1px solid var(--border)",
              paddingTop: 12,
            }}
          >
            Las posiciones son simuladas con fines de demostración. Las rutas se
            dibujan como líneas rectas entre paradas: no reflejan el trazado
            real de la carretera.
          </footer>
        </aside>
      </div>
    </div>
  );
}
