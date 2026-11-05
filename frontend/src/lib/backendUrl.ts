import { BACKEND_URL } from '@costa-bus/shared';

/**
 * Resuelve la URL del backend de telemetría según el entorno.
 *
 * - En desarrollo (o si no se define la variable) devuelve `BACKEND_URL`
 *   (`http://localhost:4000`).
 * - En producción (p. ej. Netlify) usa `VITE_BACKEND_URL` para apuntar al
 *   backend desplegado. Sin barra final para no romper la URL de Socket.io.
 */
export function resolveBackendUrl(): string {
  const fromEnv = import.meta.env.VITE_BACKEND_URL?.trim();
  if (!fromEnv) return BACKEND_URL;
  return fromEnv.replace(/\/+$/, '');
}
