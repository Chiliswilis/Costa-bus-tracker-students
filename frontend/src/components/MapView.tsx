import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { BusUpdate, City, Route } from "@costa-bus/shared";
import { RoutePolyline } from "./RoutePolyline";
import { BusMarker } from "./BusMarker";
import type { UserLocation } from "../hooks/useGeolocation";

interface MapViewProps {
  routes: Route[];
  buses: BusUpdate[];
  selectedRouteId: string;
  /** Bus objetivo del Modo GO, si está activo. */
  followBusId: string | null;
  /** Última ubicación conocida del usuario, o `null` si no hay GPS. */
  userLocation: UserLocation | null;
  /** Punto del usuario proyectado sobre la ruta seleccionada. */
  userPoint: City | null;
}

/** Centro aproximado de la región cubierta por las rutas. */
const DEFAULT_CENTER: [number, number] = [19.7, -104.4];
const DEFAULT_ZOOM = 8;

/** Encuadra el mapa a los límites de la ruta seleccionada. */
function FitToRoute({ route }: { route: Route | undefined }) {
  const map = useMap();

  useEffect(() => {
    if (!route || route.cities.length === 0) return;
    const bounds = L.latLngBounds(
      route.cities.map((city) => [city.lat, city.lng] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10, animate: true });
  }, [route, map]);

  return null;
}

/** Sigue al bus del Modo GO, recentrando el mapa sin bloquear al usuario. */
function FollowBus({ bus }: { bus: BusUpdate | null }) {
  const map = useMap();

  useEffect(() => {
    if (!bus) return;
    map.panTo([bus.lat, bus.lng], { animate: true, duration: 0.8 });
  }, [bus, map]);

  return null;
}

/**
 * Ícono de parada. Se alterna el estilo cuando es la siguiente parada de algún
 * autobús visible, para que el usuario vea de un vistazo dónde está el próximo
 * punto de llegada.
 */
function createStopIcon(active: boolean): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="stop-marker${active ? " stop-marker--active" : ""}"></div>`,
    iconSize: [13, 13],
    iconAnchor: [6, 6],
  });
}

/**
 * Leyenda flotante sobre el mapa.
 *
 * En escritorio se muestra siempre abierta. En móvil arranca minimizada como
 * un botón para no tapar el mapa; el usuario puede expandirla con el botón
 * de la cabecera. El estado se conserva al girar el teléfono.
 */
function Legend({ routes }: { routes: Route[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`map-legend${open ? " map-legend--open" : ""}`}
      style={{
        position: "absolute",
        right: 12,
        top: 12,
        zIndex: 500,
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: "10px 12px",
        fontSize: "0.76rem",
        boxShadow: "var(--shadow)",
        maxWidth: 230,
      }}
    >
      <button
        type="button"
        className="map-legend__header"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="map-legend-list"
        title={open ? "Minimizar rutas activas" : "Expandir rutas activas"}
      >
        <span className="map-legend__title">Rutas activas</span>
        <span className="map-legend__chevron mi" aria-hidden="true">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      <div className="map-legend__list" id="map-legend-list">
        {routes.map((route) => (
          <div
            key={route.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                width: 16,
                height: 3,
                background: route.color,
                borderRadius: 2,
                flexShrink: 0,
              }}
            />
            <span>{route.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ícono del marcador de la ubicación del usuario. */
const userIcon = L.divIcon({
  className: "",
  html: `<div class="user-marker"><span class="mi">my_location</span></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

/** Mapa interactivo con rutas, paradas y autobuses en movimiento. */
/** Última posición conocida del usuario, o `null` si aún no hay GPS. */
export function MapView({
  routes,
  buses,
  selectedRouteId,
  followBusId,
  userLocation,
  userPoint,
}: MapViewProps) {
  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === selectedRouteId),
    [routes, selectedRouteId],
  );

  const visibleBuses = useMemo(
    () => buses.filter((bus) => bus.routeId === selectedRouteId),
    [buses, selectedRouteId],
  );

  // Paradas que son el siguiente destino de algún bus visible.
  const activeStopKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const bus of visibleBuses) {
      const city = selectedRoute?.cities[bus.nextStopIndex];
      if (city) keys.add(`${city.lat},${city.lng}`);
    }
    return keys;
  }, [visibleBuses, selectedRoute]);

  const followBus = useMemo(
    () => buses.find((bus) => bus.busId === followBusId) ?? null,
    [buses, followBusId],
  );

  return (
    <div className="map-wrapper">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: "100%", width: "100%" }}
        zoomControl
        preferCanvas
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          subdomains="abc"
          maxZoom={19}
        />

        <FitToRoute route={selectedRoute} />
        <FollowBus bus={followBusId ? followBus : null} />

        {routes.map((route) => (
          <RoutePolyline
            key={route.id}
            route={route}
            active={route.id === selectedRouteId}
          />
        ))}

        {selectedRoute?.cities.map((city: City, index: number) => {
          const isOrigin = index === 0;
          const isDestination = index === selectedRoute.cities.length - 1;
          const active = activeStopKeys.has(`${city.lat},${city.lng}`);

          return (
            <Marker
              key={`${city.name}-${city.lat}`}
              position={[city.lat, city.lng]}
              icon={createStopIcon(active)}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <strong>{city.name}</strong>
                {isOrigin && <div>Origen de la ruta</div>}
                {isDestination && <div>Destino final</div>}
              </Tooltip>
            </Marker>
          );
        })}

        {/* Un trazo tenue de las paradas de las rutas no seleccionadas. */}
        {routes
          .filter((route) => route.id !== selectedRouteId)
          .flatMap((route) =>
            route.cities.map((city) => (
              <CircleMarker
                key={`${route.id}-${city.name}`}
                center={[city.lat, city.lng]}
                radius={2.5}
                pathOptions={{
                  color: route.color,
                  opacity: 0.45,
                  fillColor: route.color,
                  fillOpacity: 0.45,
                }}
              />
            )),
          )}

        {visibleBuses.map((bus) => (
          <BusMarker
            key={bus.busId}
            bus={bus}
            highlighted={bus.busId === followBusId}
          />
        ))}

        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={userIcon}
            zIndexOffset={2000}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              <strong>Tu ubicación</strong>
              {userPoint && <div>Cerca de {userPoint.name}</div>}
              <div>Precisión ~{Math.round(userLocation.accuracy)} m</div>
            </Tooltip>
          </Marker>
        )}

        {userPoint && (
          <CircleMarker
            center={[userPoint.lat, userPoint.lng]}
            radius={6}
            pathOptions={{
              color: "#38bdf8",
              weight: 2,
              fillColor: "#0ea5e9",
              fillOpacity: 0.35,
            }}
          >
            <Tooltip direction="bottom">Tu punto sobre la ruta</Tooltip>
          </CircleMarker>
        )}
      </MapContainer>

      <Legend routes={routes} />
    </div>
  );
}
