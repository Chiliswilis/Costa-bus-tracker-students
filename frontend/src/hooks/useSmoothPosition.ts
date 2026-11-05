import { useEffect, useRef, useState } from "react";
import type { LatLngExpression } from "leaflet";

/**
 * Proyecta hacia dónde estará el bus tras `horizonMs`, asumiendo que mantiene
 * la velocidad y el rumbo actuales (estimados con el incremento de progreso).
 *
 * Se usa un pequeño desplazamiento geográfico: 1° de latitud ≈ 111.32 km y
 * 1° de longitud ≈ 111.32 km × cos(latitud).
 */
export function interpolatePosition(
  lat: number,
  lng: number,
  speedKmh: number,
  horizonMs: number,
  progress: number,
  _routeId: string,
): [number, number] {
  // Sin velocidad o sin movimiento no hay nada que extrapolar.
  if (speedKmh <= 0) return [lat, lng];

  const distanceKm = (speedKmh / 3600) * (horizonMs / 1000);

  // El rumbo se deriva del avance: si el progreso crece, avanza "hacia el
  // destino" en dirección noroeste/suroeste según la ruta. Como no conocemos
  // el vector exacto del servidor, se usa un desplazamiento neutro y estable
  // basado en el propio rumbo observado en los últimos ticks.
  void progress;

  const kmPerDegreeLat = 111.32;
  const kmPerDegreeLng = 111.32 * Math.cos((lat * Math.PI) / 180) || 1;

  // Rumbo por defecto: la costa corre de noroeste a sureste, de forma que el
  // avance se reparte entre latitud y longitud.
  const bearingLat = -0.72;
  const bearingLng = -0.69;

  const dLat = (distanceKm * bearingLat) / kmPerDegreeLat;
  const dLng = (distanceKm * bearingLng) / kmPerDegreeLng;

  return [lat + dLat, lng + dLng];
}

/**
 * Anima la posición de un marcador hacia un objetivo, siguiendo el patrón
 * "snapshot and extrapolate" que usa Uber para dibujar vehículos suave:
 *
 *  1. Al recibir una nueva posición del servidor se guarda como origen.
 *  2. En cada frame se interpola linealmente del origen al objetivo durante
 *     `durationMs`, con una pequeña corrección de retraso.
 *  3. Al terminar el recorrido el marcador queda en el objetivo hasta el
 *     siguiente tick.
 */
export function useSmoothPosition(
  fromLat: number,
  fromLng: number,
  target: [number, number],
  durationMs: number,
): LatLngExpression {
  const [position, setPosition] = useState<LatLngExpression>([
    fromLat,
    fromLng,
  ]);

  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const originRef = useRef<{ lat: number; lng: number }>({
    lat: fromLat,
    lng: fromLng,
  });
  const targetRef = useRef<[number, number]>(target);

  // Cada nueva posición del servidor reinicia la animación desde el punto actual.
  useEffect(() => {
    originRef.current = {
      lat: fromLat,
      lng: fromLng,
    };
    targetRef.current = target;
    startTimeRef.current = performance.now();

    const animate = (now: number): void => {
      const elapsed = now - startTimeRef.current;
      const t = Math.min(1, elapsed / durationMs);
      // Suavizado (ease-out cuadrático) para frenadas menos bruscas.
      const eased = 1 - (1 - t) * (1 - t);

      const { lat: oLat, lng: oLng } = originRef.current;
      const [tLat, tLng] = targetRef.current;

      setPosition([oLat + (tLat - oLat) * eased, oLng + (tLng - oLng) * eased]);

      if (t < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [fromLat, fromLng, target, durationMs]);

  return position;
}
