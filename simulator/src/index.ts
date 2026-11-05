import { createServer } from 'node:http';
import { io, type Socket } from 'socket.io-client';
import {
  BACKEND_URL,
  ROUTES,
  SIMULATOR_TICK_MS,
  SOCKET_EVENTS,
  etaMinutes,
  invertRoute,
  positionAtDistance,
  totalDistanceKm,
  type BusPosition,
  type Route,
} from '@costa-bus/shared';

/**
 * Simulador de flota.
 *
 * Por cada ruta Y por cada sentido (ida y regreso) crea 2 unidades desfasadas,
 * avanza su odómetro según una velocidad variable y traduce la distancia
 * recorrida a una coordenada sobre la polilínea. Emite `bus-position` cada
 * `SIMULATOR_TICK_MS`.
 *
 * El regreso usa el mismo trazado con las paradas invertidas (`invertRoute`) y
 * el id con sufijo `-return`, de modo que el frontend lo trata como una
 * dirección más sin cambios adicionales.
 *
 * En la fase 2 este proceso se sustituye por un ingestador de hardware Teltonika
 * que emita exactamente el mismo evento con el mismo payload.
 */

/** Velocidad base por autobús (km/h). Se les aplica una variación aleatoria. */
const BASE_SPEED_KMH = 72;

/** Segundos simulados que representa cada tick real (acelera la travesía). */
const SIMULATED_SECONDS_PER_TICK = 40;

interface SimulatedBus {
  busId: string;
  route: Route;
  operator: string;
  /** Distancia recorrida sobre la ruta, en km. */
  travelledKm: number;
  speedKmh: number;
  /** Longitud total de la ruta (cacheada). */
  routeLengthKm: number;
}

const buses: SimulatedBus[] = [];

/** Unidades simuladas por cada sentido de cada ruta. */
const UNITS_PER_DIRECTION = 2;

/** Cada ruta base se simula en ida y en regreso (paradas invertidas). */
const DIRECTIONS: Route[] = ROUTES.flatMap((route) => [route, invertRoute(route)]);

DIRECTIONS.forEach((route, routeIndex) => {
  const routeLengthKm = totalDistanceKm(route);
  for (let unit = 0; unit < UNITS_PER_DIRECTION; unit += 1) {
    const operator = route.operators[unit % route.operators.length].name;
    buses.push({
      busId: `bus-${route.id}-${unit + 1}`,
      route,
      operator,
      // Arranca repartido a lo largo de la ruta y con un pequeño desfase por tramo.
      travelledKm: (routeLengthKm / UNITS_PER_DIRECTION) * unit + routeIndex * 3,
      speedKmh: BASE_SPEED_KMH,
      routeLengthKm,
    });
  }
});

console.log(
  `[simulator] ${buses.length} unidades simuladas en ${ROUTES.length} rutas ` +
    `(${DIRECTIONS.length} sentidos).`,
);

/** Avanza un bus y construye su posición GPS. */
function tickBus(bus: SimulatedBus): BusPosition {
  // Variación suave de velocidad: entre 45 y 95 km/h.
  const jitter = (Math.random() - 0.5) * 18;
  bus.speedKmh = Math.min(95, Math.max(45, BASE_SPEED_KMH + jitter));

  const advanceKm = (bus.speedKmh / 3600) * SIMULATED_SECONDS_PER_TICK;
  bus.travelledKm += advanceKm;

  // Al llegar al final, reinicia el recorrido (servicio continuo).
  if (bus.travelledKm >= bus.routeLengthKm) {
    bus.travelledKm = 0;
  }

  const point = positionAtDistance(bus.route, bus.travelledKm);

  return {
    busId: bus.busId,
    routeId: bus.route.id,
    operator: bus.operator,
    lat: Number(point.lat.toFixed(6)),
    lng: Number(point.lng.toFixed(6)),
    speedKmh: Number(bus.speedKmh.toFixed(1)),
    nextStopIndex: point.nextStopIndex,
    nextStopName: point.nextStop.name,
    etaMinutes: Number(
      etaMinutes(point.distanceToNextStopKm, bus.speedKmh).toFixed(1),
    ),
    progress: Number(point.progress.toFixed(4)),
    timestamp: Date.now(),
  };
}

/**
 * URL del backend. En local cae a `BACKEND_URL` (`http://localhost:4000`); en un
 * host (Railway, Render, Fly.io…) se define `BACKEND_URL` en el entorno del
 * servicio para apuntar al backend desplegado.
 */
const TARGET_URL = process.env.BACKEND_URL?.trim().replace(/\/+$/, '') ?? BACKEND_URL;

/**
 * Servidor HTTP mínimo de salud.
 *
 * El simulador no necesita exponer API, pero la plataforma de hosting (Render)
 * exige un puerto abierto para mantener vivo un Web Service. Este listener
 * satisface ese requisito sin interferir con el canal de telemetría.
 */
const HEALTH_PORT = Number(process.env.PORT ?? 0);
if (HEALTH_PORT > 0) {
  createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'costa-bus-simulator', buses: buses.length }));
      return;
    }
    res.writeHead(404);
    res.end();
  }).listen(HEALTH_PORT, () => {
    console.log(`[simulator] servidor de salud escuchando en el puerto ${HEALTH_PORT}`);
  });
}

const socket: Socket = io(TARGET_URL, { transports: ['websocket'] });

socket.on('connect', () => {
  console.log(`[simulator] conectado al backend en ${TARGET_URL}`);
  console.log(`[simulator] emitiendo posiciones cada ${SIMULATOR_TICK_MS / 1000}s`);
});

socket.on('connect_error', (error) => {
  console.warn(`[simulator] sin conexión con el backend: ${error.message}`);
});

socket.on('disconnect', (reason) => {
  console.warn(`[simulator] desconectado del backend (${reason})`);
});

setInterval(() => {
  if (!socket.connected) return;
  for (const bus of buses) {
    socket.emit(SOCKET_EVENTS.BUS_POSITION, tickBus(bus));
  }
}, SIMULATOR_TICK_MS);

/**
 * Guarda de cordura: advierte si alguna ruta tiene menos de 2 paradas
 * (no habría polilínea ni siguiente parada que calcular).
 */
for (const route of ROUTES) {
  if (route.cities.length < 2) {
    console.warn(`[simulator] la ruta ${route.id} tiene menos de 2 paradas.`);
  }
}

/** Distancia total de cada ruta, útil para depurar el trazado. */
for (const route of ROUTES) {
  console.log(
    `[simulator] ruta ${route.id}: ${totalDistanceKm(route).toFixed(0)} km (línea recta entre paradas)`,
  );
}
