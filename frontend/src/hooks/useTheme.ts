import { useCallback, useEffect, useState } from "react";

/** Tema visual de la aplicación. */
export type Theme = "light" | "dark";

/** Clave de almacenamiento local donde se recuerda la preferencia. */
const STORAGE_KEY = "costa-bus-theme";

/**
 * Lee el tema guardado por el usuario. Si no hay preferencia explícita, se
 * respeta la del sistema operativo (`prefers-color-scheme`).
 */
function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Aplica el tema al elemento raíz del documento. */
function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  // El color de la barra del navegador en móvil acompaña al tema.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0b1220" : "#eef2f7");
}

/**
 * Gestiona el tema claro/oscuro de la aplicación.
 *
 * - Arranca con la preferencia guardada o, si no existe, la del sistema.
 * - Persiste cada cambio en `localStorage`.
 * - Sincroniza el atributo `data-theme` en `<html>` para que el CSS lo aplique.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Si el usuario no ha elegido tema, sigue los cambios del sistema.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => {
      if (window.localStorage.getItem(STORAGE_KEY)) return;
      setTheme(event.matches ? "dark" : "light");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggleTheme, isDark: theme === "dark" };
}
