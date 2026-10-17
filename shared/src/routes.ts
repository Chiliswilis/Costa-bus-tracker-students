import { distanceKm } from './geo.js';
import type { City, Operator, Route } from './types.js';

/* -------------------------------------------------------------------------- */
/*  Catálogo de ciudades / paradas de la Costa de Jalisco                     */
/* -------------------------------------------------------------------------- */

export const CITIES = {
  guadalajara: { name: 'Guadalajara', lat: 20.6597, lng: -103.3496 },
  autlan: { name: 'Autlán', lat: 19.7708, lng: -104.3644 },
  casimiroCastillo: { name: 'Casimiro Castillo', lat: 19.6061, lng: -104.4333 },
  laHuerta: { name: 'La Huerta', lat: 19.4833, lng: -104.65 },
  melaque: { name: 'Melaque (San Patricio)', lat: 19.225, lng: -104.7 },
  barraDeNavidad: { name: 'Barra de Navidad', lat: 19.2083, lng: -104.6833 },
  colima: { name: 'Colima', lat: 19.2433, lng: -103.725 },
  manzanillo: { name: 'Manzanillo', lat: 19.1133, lng: -104.3383 },
  cihuatlan: { name: 'Cihuatlán', lat: 19.2367, lng: -104.5667 },
  tomatlan: { name: 'Tomatlán', lat: 19.9333, lng: -105.25 },
  puertoVallarta: { name: 'Puerto Vallarta', lat: 20.6534, lng: -105.2253 },
} as const satisfies Record<string, City>;

/* -------------------------------------------------------------------------- */
/*  Operadores y enlaces de compra                                            */
/* -------------------------------------------------------------------------- */

export const OPERATORS = {
  etn: {
    name: 'ETN Turistar Lujo',
    purchaseUrl: 'https://www.etn.com.mx',
  },
  primeraPlus: {
    name: 'Primera Plus',
    purchaseUrl: 'https://www.primeraplus.com.mx',
  },
  autocamionesDelPacifico: {
    name: 'Autocamiones del Pacífico',
    purchaseUrl: 'https://www.autocamionesdelpacifico.com.mx',
    fallbackUrl: 'https://www.facebook.com/autocamionesdelpacifico',
  },
} as const satisfies Record<string, Operator>;

/* -------------------------------------------------------------------------- */
/*  Rutas                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Rutas cubiertas. Las polilíneas se dibujan uniendo las paradas en orden;
 * las coordenadas son aproximadas y no siguen la traza exacta de la carretera.
 */
export const ROUTES: Route[] = [
  {
    id: 'gdl-barra-navidad',
    name: 'Guadalajara → Barra de Navidad',
    color: '#38bdf8',
    cities: [
      CITIES.guadalajara,
      CITIES.autlan,
      CITIES.casimiroCastillo,
      CITIES.laHuerta,
      CITIES.melaque,
      CITIES.barraDeNavidad,
    ],
    // ETN no cubre este corredor (va por Autlán, no por Colima).
    operators: [OPERATORS.primeraPlus, OPERATORS.autocamionesDelPacifico],
  },
  {
    id: 'gdl-manzanillo',
    name: 'Guadalajara → Manzanillo',
    color: '#a78bfa',
    cities: [CITIES.guadalajara, CITIES.colima, CITIES.manzanillo],
    // Corredor de ETN: Guadalajara ↔ Colima ↔ Manzanillo.
    operators: [
      OPERATORS.etn,
      OPERATORS.primeraPlus,
      OPERATORS.autocamionesDelPacifico,
    ],
  },
  {
    id: 'manzanillo-barra-navidad',
    name: 'Manzanillo → Barra de Navidad',
    color: '#fbbf24',
    cities: [CITIES.manzanillo, CITIES.cihuatlan, CITIES.barraDeNavidad],
    // Corredor de ETN: Manzanillo ↔ Barra de Navidad.
    operators: [
      OPERATORS.etn,
      OPERATORS.primeraPlus,
      OPERATORS.autocamionesDelPacifico,
    ],
  },
  {
    id: 'barra-navidad-puerto-vallarta',
    name: 'Barra de Navidad → Puerto Vallarta',
    color: '#34d399',
    cities: [
      CITIES.barraDeNavidad,
      CITIES.melaque,
      CITIES.tomatlan,
      CITIES.puertoVallarta,
    ],
    // ETN no cubre este corredor: solo va Guadalajara ↔ Colima ↔ Manzanillo ↔ Barra de Navidad.
    operators: [OPERATORS.primeraPlus, OPERATORS.autocamionesDelPacifico],
  },
];

/** Devuelve una ruta por su id, o `undefined` si no existe. */
export function getRouteById(routeId: string): Route | undefined {
  return ROUTES.find((route) => route.id === routeId);
}

/* -------------------------------------------------------------------------- */
/*  Sentido de las rutas (ida / regreso)                                      */
/* -------------------------------------------------------------------------- */

/** Sufijo del identificador de la ruta de regreso (paradas invertidas). */
export const RETURN_ROUTE_SUFFIX = '-return';

/** `true` si la ruta es el sentido de regreso de su ruta base. */
export function isReturnRoute(route: Route): boolean {
  return route.id.endsWith(RETURN_ROUTE_SUFFIX);
}

/**
 * Devuelve el mismo trazado con las paradas en orden inverso (viaje de
 * regreso). El color y los operadores se conservan; el id y el nombre se
 * marcan con el sufijo de regreso para poder identificarla.
 */
export function invertRoute(route: Route, color?: string): Route {
  if (isReturnRoute(route)) return route;
  const cities = [...route.cities].reverse();
  const [from, to] = [cities[0], cities[cities.length - 1]];
  return {
    ...route,
    id: `${route.id}${RETURN_ROUTE_SUFFIX}`,
    name: `${from.name} → ${to.name}`,
    color: color ?? route.color,
    cities,
  };
}

/**
 * Coordenada del usuario proyectada sobre un tramo de la ruta.
 *
 * Devuelve el índice del tramo (entre las paradas `i` e `i + 1`), el punto más
 * cercano dentro de ese tramo y la distancia del usuario a dicho punto.
 */
function projectOnLeg(
  route: Route,
  legIndex: number,
  userLat: number,
  userLng: number,
): { point: City; distanceKm: number } {
  const a = route.cities[legIndex];
  const b = route.cities[legIndex + 1];

  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const lengthSq = dx * dx + dy * dy;

  const t =
    lengthSq === 0
      ? 0
      : Math.min(
          1,
          Math.max(
            0,
            ((userLng - a.lng) * dx + (userLat - a.lat) * dy) / lengthSq,
          ),
        );

  const point: City = {
    name: `Entre ${a.name} y ${b.name}`,
    lat: a.lat + dy * t,
    lng: a.lng + dx * t,
  };

  return {
    point,
    distanceKm: distanceKm(userLat, userLng, point.lat, point.lng),
  };
}

/** Ubicación del usuario proyectada sobre una ruta, lista para mostrar. */
export interface RouteProjection {
  /** Tramo de la ruta (entre `cities[i]` y `cities[i + 1]`) más cercano. */
  legIndex: number;
  /** Punto sobre la ruta más próximo al usuario. */
  point: City;
  /** Índice de la parada siguiente a ese punto (índice dentro de `cities`). */
  nextStopIndex: number;
  /** Nombre de la parada siguiente. */
  nextStopName: string;
  /** Distancia en línea recta del usuario al punto proyectado (km). */
  distanceToUserKm: number;
}

/**
 * Proyecta la ubicación del usuario sobre la ruta y resuelve la siguiente
 * parada en el sentido de marcha. Lanza si la ruta tiene menos de 2 paradas.
 */
export function projectUserOnRoute(
  route: Route,
  userLat: number,
  userLng: number,
): RouteProjection {
  if (route.cities.length < 2) {
    throw new Error('La ruta necesita al menos 2 paradas para proyectar.');
  }

  let best = 0;
  let bestProjection: { point: City; distanceKm: number } | null = null;

  for (let i = 0; i < route.cities.length - 1; i += 1) {
    const projection = projectOnLeg(route, i, userLat, userLng);
    if (!bestProjection || projection.distanceKm < bestProjection.distanceKm) {
      best = i;
      bestProjection = projection;
    }
  }

  const projection = bestProjection ?? projectOnLeg(route, 0, userLat, userLng);
  const nextStopIndex = Math.min(best + 1, route.cities.length - 1);

  return {
    legIndex: best,
    point: projection.point,
    nextStopIndex,
    nextStopName: route.cities[nextStopIndex].name,
    distanceToUserKm: projection.distanceKm,
  };
}
