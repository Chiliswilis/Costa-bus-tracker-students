import { randomUUID } from 'node:crypto';
import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import {
  ALERT_ETA_THRESHOLD_MINUTES,
  BACKEND_PORT,
  ROUTES,
  SOCKET_EVENTS,
  invertRoute,
  type Alert,
  type BusPosition,
  type BusUpdate,
  type Route,
} from '@costa-bus/shared';

/**
 * Servidor de telemetría.
 *
 * No le importa el origen de las posiciones: escucha `bus-position` con un
 * payload `BusPosition` (hoy del simulador, mañana de un ingestador Teltonika),
 * enriquece el dato con información de la ruta y lo difunde a todos los
 * clientes. Cuando la ETA de un bus cae por debajo del umbral, emite una alerta.
 */
const app = express();

/**
 * Orígenes permitidos para el WebSocket y la API.
 * `CORS_ORIGIN="*"` (valor por defecto) acepta cualquiera; en producción conviene
 * restringirlo a los dominios reales, p. ej. `https://costa-bus.netlify.app`.
 * Admite varios separados por coma.
 */
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';
const corsOrigins =
  CORS_ORIGIN === '*' ? '*' : CORS_ORIGIN.split(',').map((s) => s.trim());

/** Puerto HTTP: en la nube el host inyecta `PORT`; en local cae a 4000. */
const PORT = Number(process.env.PORT ?? BACKEND_PORT);

app.use(cors({ origin: corsOrigins }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: corsOrigins },
});

/** Último estado conocido de cada bus, para servirlo al conectarse. */
const lastKnownPositions = new Map<string, BusUpdate>();

/**
 * Evita repetir la misma alerta en cada tick mientras el bus sigue acercándose.
 * Se guarda un timestamp por `busId` + parada y se permite una nueva alerta tras
 * `ALERT_COOLDOWN_MS`.
 */
const ALERT_COOLDOWN_MS = 90_000;
const lastAlertAt = new Map<string, number>();

/**
 * Catálogo de rutas con sus dos sentidos (ida y regreso). El simulador emite
 * posiciones para ambos, así que el backend debe poder resolver el nombre y el
 * color de una ruta `-return` igual que los de su ruta base.
 */
const ROUTE_DIRECTIONS: Route[] = ROUTES.flatMap((route) => [
  route,
  invertRoute(route),
]);

/** Devuelve una dirección por id (ida o regreso), o `undefined`. */
function findDirection(routeId: string): Route | undefined {
  return ROUTE_DIRECTIONS.find((route) => route.id === routeId);
}

/** Descarta estado de buses que llevan mucho tiempo sin reportar. */
function pruneStalePositions(): void {
  const cutoff = Date.now() - 5 * 60_000;
  for (const [busId, position] of lastKnownPositions) {
    if (position.timestamp < cutoff) {
      lastKnownPositions.delete(busId);
    }
  }
}

/** Enriquece la posición cruda con datos de la ruta. */
function toBusUpdate(position: BusPosition): BusUpdate | null {
  const route = findDirection(position.routeId);
  if (!route) return null;
  return {
    ...position,
    routeName: route.name,
    routeColor: route.color,
  };
}

/**
 * Decide si corresponde emitir una alerta de proximidad y la construye.
 * Devuelve `null` cuando el bus aún está lejos o ya se alertó recientemente.
 */
function buildAlert(position: BusPosition): Alert | null {
  if (position.etaMinutes > ALERT_ETA_THRESHOLD_MINUTES) return null;

  const key = `${position.busId}:${position.nextStopIndex}`;
  const previous = lastAlertAt.get(key) ?? 0;
  if (Date.now() - previous < ALERT_COOLDOWN_MS) return null;

  lastAlertAt.set(key, Date.now());

  return {
    id: randomUUID(),
    busId: position.busId,
    routeId: position.routeId,
    message: `El autobús ${position.busId} de ${position.operator} llega a ${position.nextStopName} en ${position.etaMinutes} min`,
    stopName: position.nextStopName,
    etaMinutes: position.etaMinutes,
    timestamp: position.timestamp,
  };
}

io.on('connection', (socket: Socket) => {
  console.log(`[backend] cliente conectado: ${socket.id}`);

  // Estado inicial: catálogo de rutas + posiciones vigentes.
  socket.emit(SOCKET_EVENTS.ROUTES, ROUTES);
  socket.emit(SOCKET_EVENTS.SNAPSHOT, Array.from(lastKnownPositions.values()));

  socket.on(SOCKET_EVENTS.BUS_POSITION, (raw: BusPosition) => {
    if (!raw || typeof raw.busId !== 'string') return;

    const update = toBusUpdate(raw);
    if (!update) return;

    lastKnownPositions.set(update.busId, update);

    // Difunde la posición ya enriquecida a todos los clientes conectados.
    io.emit(SOCKET_EVENTS.BUS_UPDATE, update);

    const alert = buildAlert(update);
    if (alert) {
      console.log(
        `[backend] ALERTA ${alert.busId} → ${alert.stopName} (${alert.etaMinutes} min)`,
      );
      io.emit(SOCKET_EVENTS.BUS_ALERT, alert);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`[backend] cliente desconectado: ${socket.id} (${reason})`);
  });
});

/* -------------------------------------------------------------------------- */
/*  Rutas HTTP                                                                */
/* -------------------------------------------------------------------------- */

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'costa-bus-tracker-backend',
    busesTracked: lastKnownPositions.size,
    routes: ROUTES.length,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.get('/api/routes', (_req, res) => {
  res.json(ROUTES);
});

app.get('/api/buses', (_req, res) => {
  res.json(Array.from(lastKnownPositions.values()));
});

setInterval(pruneStalePositions, 60_000).unref();

server.listen(PORT, () => {
  console.log(`[backend] escuchando en el puerto ${PORT}`);
  console.log(`[backend] CORS: ${CORS_ORIGIN}`);
  console.log(`[backend] rutas disponibles: ${ROUTES.length}`);
});
