import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Configuración de Vite.
 *
 * `preserveSymlinks: false` (valor por defecto) permite que Vite resuelva el
 * paquete `@costa-bus/shared` del workspace. Si se desarrolla `shared` con su
 * propio `tsc --watch`, el frontend consume siempre el `dist/` actualizado.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    host: true,
    proxy: {
      // Evita CORS en desarrollo si en el futuro se consulta la API REST.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          leaflet: ['leaflet', 'react-leaflet'],
          vendor: ['react', 'react-dom', 'socket.io-client'],
        },
      },
    },
  },
});
