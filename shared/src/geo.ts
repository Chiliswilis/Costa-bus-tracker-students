import type { City, Route } from './types.js';

/** Radio medio de la Tierra en kilómetros. */
const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Distancia en kilómetros entre dos coordenadas mediante la fórmula de
 * Haversine. Suficientemente precisa para distancias regionales.
 */
export function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Interpolación lineal entre dos valores. `t` se satura al rango [0, 1]. */
export function lerp(a: number, b: number, t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return a + (b - a) * clamped;
}

/**
 * Interpola una coordenada a lo largo de dos puntos (aproximación planar,
 * válida para tramos cortos como los de estas rutas).
 */
export function lerpPoint(
  from: City,
  to: City,
  t: number,
): { lat: number; lng: number } {
  return {
    lat: lerp(from.lat, to.lat, t),
    lng: lerp(from.lng, to.lng, t),
  };
}

/** Longitudes de cada tramo de la ruta, en kilómetros. */
export function legDistances(route: Route): number[] {
  const legs: number[] = [];
  for (let i = 0; i < route.cities.length - 1; i += 1) {
    const a = route.cities[i];
    const b = route.cities[i + 1];
    legs.push(distanceKm(a.lat, a.lng, b.lat, b.lng));
  }
  return legs;
}

/** Longitud total del recorrido en kilómetros. */
export function totalDistanceKm(route: Route): number {
  return legDistances(route).reduce((sum, km) => sum + km, 0);
}

/**
 * Desplaza una distancia (km) desde el origen de la ruta y devuelve la
 * coordenada resultante junto con la siguiente parada y el progreso global.
 */
export function positionAtDistance(
  route: Route,
  travelledKm: number,
): {
  lat: number;
  lng: number;
  nextStopIndex: number;
  nextStop: City;
  distanceToNextStopKm: number;
  progress: number;
} {
  const legs = legDistances(route);
  const total = legs.reduce((sum, km) => sum + km, 0);
  const clamped = Math.min(Math.max(travelledKm, 0), total);

  let remaining = clamped;
  for (let i = 0; i < legs.length; i += 1) {
    const leg = legs[i];
    if (remaining <= leg || i === legs.length - 1) {
      const t = leg === 0 ? 0 : Math.min(1, remaining / leg);
      const point = lerpPoint(route.cities[i], route.cities[i + 1], t);
      return {
        ...point,
        nextStopIndex: i + 1,
        nextStop: route.cities[i + 1],
        distanceToNextStopKm: Math.max(0, leg - remaining),
        progress: total === 0 ? 1 : clamped / total,
      };
    }
    remaining -= leg;
  }

  // Inalcanzable, pero mantiene el tipo de retorno explícito.
  const last = route.cities[route.cities.length - 1];
  return {
    lat: last.lat,
    lng: last.lng,
    nextStopIndex: route.cities.length - 1,
    nextStop: last,
    distanceToNextStopKm: 0,
    progress: 1,
  };
}

/**
 * ETA en minutos para recorrer `km` a una velocidad dada (km/h).
 * Si la velocidad es 0 o negativa, se usa un mínimo para evitar infinitos.
 */
export function etaMinutes(km: number, speedKmh: number): number {
  const safeSpeed = speedKmh > 1 ? speedKmh : 40;
  return (km / safeSpeed) * 60;
}

/** Formatea minutos como "Xh Ym" o "Ym" para la interfaz. */
export function formatEta(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return mins === 0 ? `${hours} h` : `${hours} h ${mins} min`;
}
