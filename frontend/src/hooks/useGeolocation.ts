import { useCallback, useEffect, useRef, useState } from "react";

/** Coordenada del usuario y metadatos de la lectura GPS. */
export interface UserLocation {
  lat: number;
  lng: number;
  /** Precisión reportada por el navegador, en metros. */
  accuracy: number;
  /** Marca temporal UNIX de la última lectura. */
  timestamp: number;
}

/** Estado y controles del seguimiento de ubicación del usuario. */
export interface GeolocationState {
  /** Última ubicación conocida, o `null` si aún no hay ninguna. */
  location: UserLocation | null;
  /** `true` mientras se espera una lectura del GPS. */
  loading: boolean;
  /** Mensaje de error legible, o `null` si todo va bien. */
  error: string | null;
  /** `true` si el usuario ha concedido el permiso de ubicación. */
  granted: boolean;
  /** Solicita (o vuelve a solicitar) la ubicación actual. */
  request: () => void;
}

/**
 * Errores de la API de geolocalización traducidos a español.
 * https://developer.mozilla.org/docs/Web/API/GeolocationPositionError
 */
function describeError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Permiso de ubicación denegado. Actívalo en el navegador para ver tu posición.";
    case error.POSITION_UNAVAILABLE:
      return "No se pudo obtener tu ubicación en este momento.";
    case error.TIMEOUT:
      return "La ubicación tardó demasiado en responder. Inténtalo de nuevo.";
    default:
      return error.message || "Error desconocido al obtener la ubicación.";
  }
}

/**
 * Sigue la ubicación del usuario con `navigator.geolocation.watchPosition`, de
 * modo que la posición se actualice sola mientras se desplaza. Si se deniega el
 * permiso o el GPS falla, `error` explica el motivo y `request` permite
 * reintentar.
 */
export function useGeolocation(): GeolocationState {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [granted, setGranted] = useState(false);

  const watchIdRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("Tu navegador no soporta geolocalización.");
      return;
    }

    setLoading(true);
    setError(null);
    stop();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
        setGranted(true);
        setLoading(false);
        setError(null);
      },
      (geoError) => {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setGranted(false);
        }
        setError(describeError(geoError));
        setLoading(false);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { location, loading, error, granted, request };
}
