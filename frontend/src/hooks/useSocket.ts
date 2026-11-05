import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  ALERT_ETA_THRESHOLD_MINUTES,
  ROUTES,
  SOCKET_EVENTS,
  type Alert,
  type BusUpdate,
  type Route,
} from '@costa-bus/shared';
import { resolveBackendUrl } from '../lib/backendUrl';

/** Estado que expone el hook a la interfaz. */
export interface SocketState {
  /** Catálogo de rutas (del servidor o del respaldo offline). */
  routes: Route[];
  /** Posiciones vigentes indexadas por `busId`. */
  buses: BusUpdate[];
  /** Alertas recientes, la más nueva primero. */
  alerts: Alert[];
  /** `true` mientras el WebSocket está conectado. */
  connected: boolean;
  /** `true` si no hay conexión y se está mostrando el estado cacheado. */
  offline: boolean;
  /** Descarta el historial de alertas. */
  clearAlerts: () => void;
}

/** Máximo de alertas conservadas en memoria. */
const MAX_ALERTS = 30;

/** Clave de `localStorage` donde se cachea el último estado conocido. */
const CACHE_KEY = 'costa-bus-tracker:state:v1';

/** Forma del objeto persistido en `localStorage`. */
interface CachedState {
  routes: Route[];
  buses: BusUpdate[];
  savedAt: number;
}

/** Lee el estado cacheado; tolerante a JSON corrupto o ausente. */
function readCache(): CachedState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedState;
    if (!Array.isArray(parsed.routes) || !Array.isArray(parsed.buses)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persiste el estado; ignora cuotas excedidas o modo privado. */
function writeCache(routes: Route[], buses: BusUpdate[]): void {
  try {
    const payload: CachedState = { routes, buses, savedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* localStorage no disponible: el modo offline simplemente no persiste. */
  }
}

/**
 * Conecta al backend de telemetría y mantiene el estado de la flota.
 *
 * `routes` tiene doble origen: se inicializa desde `ROUTES` (empaquetado en el
 * bundle, por lo que funciona sin conexión) y se reemplaza por la respuesta del
 * servidor si esta llega. Las posiciones se cachean en `localStorage` para
 * restaurarlas cuando no hay red.
 */
export function useSocket(): SocketState {
  const [serverRoutes, setServerRoutes] = useState<Route[] | null>(null);
  const [busMap, setBusMap] = useState<Record<string, BusUpdate>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [connected, setConnected] = useState(false);
  const [offline, setOffline] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // Rutas disponibles sin conexión: el bundle trae el catálogo completo.
  const baseRoutes = useMemo(() => ROUTES, []);
  const routes = serverRoutes ?? baseRoutes;

  const clearAlerts = useCallback(() => setAlerts([]), []);

  useEffect(() => {
    // 1) Restaura el último estado conocido antes de intentar conectar.
    const cached = readCache();
    if (cached) {
      setServerRoutes(cached.routes);
      setBusMap(Object.fromEntries(cached.buses.map((bus) => [bus.busId, bus])));
      setOffline(true);
    }

    const socket = io(resolveBackendUrl(), {
      transports: ['websocket'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setOffline(false);
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setOffline(true);
    });

    socket.on('connect_error', () => {
      setConnected(false);
      setOffline(true);
    });

    socket.on(SOCKET_EVENTS.ROUTES, (incoming: Route[]) => {
      if (Array.isArray(incoming) && incoming.length > 0) {
        setServerRoutes(incoming);
      }
    });

    socket.on(SOCKET_EVENTS.SNAPSHOT, (incoming: BusUpdate[]) => {
      if (!Array.isArray(incoming)) return;
      setBusMap(Object.fromEntries(incoming.map((bus) => [bus.busId, bus])));
    });

    socket.on(SOCKET_EVENTS.BUS_UPDATE, (update: BusUpdate) => {
      setBusMap((previous) => ({ ...previous, [update.busId]: update }));
    });

    socket.on(SOCKET_EVENTS.BUS_ALERT, (alert: Alert) => {
      setAlerts((previous) => [alert, ...previous].slice(0, MAX_ALERTS));
    });

    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, []);

  // Persiste el estado con un ligero retardo para no escribir en cada tick.
  useEffect(() => {
    const handler = setTimeout(() => {
      const buses = Object.values(busMap);
      if (buses.length > 0) writeCache(routes, buses);
    }, 1500);
    return () => clearTimeout(handler);
  }, [busMap, routes]);

  const buses = useMemo(
    () => Object.values(busMap).sort((a, b) => a.busId.localeCompare(b.busId)),
    [busMap],
  );

  // Las alertas caducan solas: solo se conservan las de los últimos 2 minutos.
  useEffect(() => {
    if (alerts.length === 0) return undefined;
    const timer = setInterval(() => {
      const cutoff = Date.now() - 120_000;
      setAlerts((previous) => previous.filter((a) => a.timestamp >= cutoff));
    }, 15_000);
    return () => clearInterval(timer);
  }, [alerts.length]);

  return { routes, buses, alerts, connected, offline, clearAlerts };
}

/** Reexportado para que la interfaz pueda resaltar buses en umbral de llegada. */
export { ALERT_ETA_THRESHOLD_MINUTES };
