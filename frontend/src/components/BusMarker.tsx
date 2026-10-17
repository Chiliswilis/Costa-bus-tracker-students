import { useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import {
  formatEta,
  operatorBrand,
  type BusUpdate,
} from "@costa-bus/shared";
import { ALERT_ETA_THRESHOLD_MINUTES } from "../hooks/useSocket";
import {
  interpolatePosition,
  useSmoothPosition,
} from "../hooks/useSmoothPosition";

interface BusMarkerProps {
  bus: BusUpdate;
  /** `true` si este bus es el objetivo del Modo GO. */
  highlighted: boolean;
}

/**
 * Construye el ícono circular del autobús.
 *
 * El color lo determina la LÍNEA que opera la unidad (dorado Primera Plus,
 * azul Autocamiones del Pacífico, plata ETN), no la ruta: así se distingue de
 * un vistazo qué empresa pasa por el mapa.
 */
function createBusIcon(
  color: string,
  textColor: string,
  urgent: boolean,
): L.DivIcon {
  const classes = `bus-marker${urgent ? " bus-marker--soon" : ""}`;
  return L.divIcon({
    className: "",
    html: `<div class="${classes}" style="background:${color};color:${textColor}"><span class="mi mi--marker" style="color:${textColor}">directions_bus</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });
}

/**
 * Marcador de autobús.
 *
 * Recibe la última posición conocida y anima su desplazamiento en el intervalo
 * entre ticks del servidor, de modo que el movimiento se vea continuo en lugar
 * de a saltos cada 3 segundos.
 */
export function BusMarker({ bus, highlighted }: BusMarkerProps) {
  const urgent = bus.etaMinutes <= ALERT_ETA_THRESHOLD_MINUTES;

  // Posición animada: parte del punto actual y avanza hacia donde estará el bus
  // cuando llegue el siguiente tick, a la velocidad reportada.
  const target = useMemo(
    () =>
      interpolatePosition(
        bus.lat,
        bus.lng,
        bus.speedKmh,
        3000,
        bus.progress,
        bus.routeId,
      ),
    [bus.lat, bus.lng, bus.speedKmh, bus.progress, bus.routeId],
  );

  const position = useSmoothPosition(bus.lat, bus.lng, target, 3000);

  const brand = useMemo(() => operatorBrand(bus.operator), [bus.operator]);

  const icon = useMemo(
    () => createBusIcon(brand.color, brand.textColor, urgent),
    [brand, urgent],
  );

  return (
    <Marker
      position={position}
      icon={icon}
      zIndexOffset={highlighted ? 1000 : 0}
    >
      <Popup>
        <div style={{ minWidth: 190 }}>
          <strong style={{ fontSize: "0.95rem" }}>
            <span className="mi" aria-hidden="true">
              directions_bus
            </span>{" "}
            {bus.busId}
          </strong>
          <div
            style={{
              color: "var(--text-muted)",
              fontSize: "0.78rem",
              marginTop: 3,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: brand.color,
                flexShrink: 0,
              }}
              aria-hidden="true"
            />
            {bus.operator}
          </div>
          <hr
            style={{
              border: "none",
              borderTop: "1px solid var(--border)",
              margin: "8px 0",
            }}
          />
          <div style={{ fontSize: "0.8rem", lineHeight: 1.6 }}>
            <div>
              <strong>Ruta:</strong> {bus.routeName}
            </div>
            <div>
              <strong>Próxima parada:</strong> {bus.nextStopName}
            </div>
            <div>
              <strong>Llegada:</strong>{" "}
              <span style={{ color: urgent ? "var(--danger)" : "var(--text)" }}>
                {formatEta(bus.etaMinutes)}
              </span>
            </div>
            <div>
              <strong>Velocidad:</strong> {bus.speedKmh} km/h
            </div>
            <div>
              <strong>Avance:</strong> {Math.round(bus.progress * 100)}%
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}
