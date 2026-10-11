/// <reference types="vite/client" />

/**
 * Variables de entorno expuestas al bundle del frontend.
 * Vite solo inyecta las que llevan el prefijo `VITE_`.
 */
interface ImportMetaEnv {
  /**
   * URL pública del backend de telemetría.
   * - En desarrollo se omite y se usa `http://localhost:4000`.
   * - En producción (Netlify) se define, p. ej.
   *   `VITE_BACKEND_URL=https://costa-bus-backend.up.railway.app`.
   */
  readonly VITE_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
