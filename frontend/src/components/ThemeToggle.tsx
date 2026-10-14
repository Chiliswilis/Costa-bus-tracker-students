interface ThemeToggleProps {
  /** `true` si el tema oscuro está activo. */
  isDark: boolean;
  /** Alterna entre tema claro y oscuro. */
  onToggle: () => void;
}

/**
 * Interruptor de tema claro/oscuro.
 *
 * Se renderiza como un botón con `aria-pressed` para que sea accesible por
 * teclado y anunciado correctamente por los lectores de pantalla.
 */
export function ThemeToggle({ isDark, onToggle }: ThemeToggleProps) {
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-pressed={isDark}
      aria-label={isDark ? "Activar tema claro" : "Activar tema oscuro"}
      title={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
    >
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__thumb">
          <span className="mi" aria-hidden="true">
            {isDark ? "dark_mode" : "light_mode"}
          </span>
        </span>
      </span>
      <span className="theme-toggle__label">
        {isDark ? "Oscuro" : "Claro"}
      </span>
    </button>
  );
}
