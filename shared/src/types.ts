/**
 * Tipos compartidos entre simulator, backend y frontend.
 *
 * Contrato de datos: el simulador (o, en el futuro, el ingestador de hardware
 * Teltonika) produce `BusPosition`, el backend reenvía `BusUpdate` / `BusAlert`
 * y el frontend los consume sin conocer el origen de la señal.
 */

/** Ciudad o parada sobre una ruta. */
export interface City {
  /** Nombre legible mostrado en el panel y en el mapa. */
  name: string;
  /** Latitud en grados decimales (WGS84). */
  lat: number;
  /** Longitud en grados decimales (WGS84). */
  lng: number;
}

/** Empresa transportista y sus enlaces oficiales de venta de boletos. */
export interface Operator {
  /** Nombre comercial del operador. */
  name: string;
  /** URL oficial de compra de boletos. */
  purchaseUrl: string;
  /** URL alternativa si el sitio principal no responde. */
  fallbackUrl?: string;
}

/** Ruta completa: lista ordenada de paradas + operadores que la cubren. */
export interface Route {
  /** Identificador estable, p. ej. "gdl-barra-navidad". */
  id: string;
  /** Nombre legible de la ruta. */
  name: string;
  /** Color hex usado en el mapa y en la interfaz. */
  color: string;
  /** Paradas en orden de recorrido (índice 0 = origen). */
  cities: City[];
  /** Operadores que ofrecen esta ruta. */
  operators: Operator[];
}

/** Posición GPS puntual de un autobús en un instante dado. */
export interface BusPosition {
  /** Identificador de la unidad (en producción: ID del dispositivo GPS). */
  busId: string;
  /** Ruta que está recorriendo. */
  routeId: string;
  /** Nombre del operador al que pertenece la unidad. */
  operator: string;
  /** Latitud actual. */
  lat: number;
  /** Longitud actual. */
  lng: number;
  /** Velocidad instantánea en km/h. */
  speedKmh: number;
  /** Índice (dentro de `Route.cities`) de la siguiente parada. */
  nextStopIndex: number;
  /** Nombre de la siguiente parada. */
  nextStopName: string;
  /** Minutos restantes para llegar a la siguiente parada. */
  etaMinutes: number;
  /** Progreso del recorrido completo, de 0 a 1. */
  progress: number;
  /** Marca temporal UNIX en milisegundos. */
  timestamp: number;
}

/**
 * Actualización que el backend difunde a los clientes.
 * Extiende la posición con datos derivados del servidor.
 */
export interface BusUpdate extends BusPosition {
  /** Nombre de la ruta (desnormalizado para pintar la interfaz sin lookup). */
  routeName: string;
  /** Color de la ruta, útil para marcadores y lista. */
  routeColor: string;
}

/** Alerta emitida cuando un autobús está a punto de llegar (ETA ≤ umbral). */
export interface Alert {
  /** Identificador único de la alerta. */
  id: string;
  /** Unidad que la genera. */
  busId: string;
  /** Ruta asociada. */
  routeId: string;
  /** Texto listo para mostrar en pantalla. */
  message: string;
  /** Parada a la que se aproxima. */
  stopName: string;
  /** Minutos restantes en el momento de la alerta. */
  etaMinutes: number;
  /** Marca temporal UNIX en milisegundos. */
  timestamp: number;
}

/** Umbral (minutos) por debajo o igual al cual se genera una alerta. */
export const ALERT_ETA_THRESHOLD_MINUTES = 5;

/** Intervalo (ms) con el que el simulador emite nuevas posiciones. */
export const SIMULATOR_TICK_MS = 3000;

/** Puerto del backend Express + Socket.io. */
export const BACKEND_PORT = 4000;

/** URL del backend consumida por el frontend y por el simulador. */
export const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

/** Nombres de los eventos de Socket.io usados en el canal de telemetría. */
export const SOCKET_EVENTS = {
  /** Simulador → Backend: nueva posición cruda. */
  BUS_POSITION: 'bus-position',
  /** Backend → Clientes: posición enriquecida. */
  BUS_UPDATE: 'bus-update',
  /** Backend → Clientes: alerta de proximidad. */
  BUS_ALERT: 'bus-alert',
  /** Backend → Clientes: catálogo de rutas disponibles. */
  ROUTES: 'routes',
  /** Backend → Cliente que se conecta: estado inicial completo. */
  SNAPSHOT: 'bus-snapshot',
} as const;

/** Nombres concretos de los eventos (tipado para Socket.io). */
export type SocketEvent =
  (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
