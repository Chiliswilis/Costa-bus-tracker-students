import { Polyline, Tooltip } from "react-leaflet";
import type { Route } from "@costa-bus/shared";

interface RoutePolylineProps {
  route: Route;
  /** `true` si la ruta está seleccionada en el panel. */
  active: boolean;
}

/**
 * Dibuja la ruta como polilínea punteada entre sus paradas consecutivas.
 * Las coordenadas son aproximadas (líneas rectas entre ciudades), por lo que
 * el trazo no corresponde exactamente al eje carretero.
 */
export function RoutePolyline({ route, active }: RoutePolylineProps) {
  const positions: [number, number][] = route.cities.map((city) => [
    city.lat,
    city.lng,
  ]);

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: route.color,
        weight: active ? 4 : 2.5,
        opacity: active ? 0.95 : 0.4,
        dashArray: "10 10",
        lineCap: "round",
      }}
    >
      <Tooltip sticky>{route.name}</Tooltip>
    </Polyline>
  );
}
