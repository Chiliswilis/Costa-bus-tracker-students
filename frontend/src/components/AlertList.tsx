import type { Alert } from "@costa-bus/shared";

interface AlertListProps {
  alerts: Alert[];
  onClear: () => void;
}

/** Fecha relativa corta, p. ej. "hace 12 s". */
function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  return `hace ${minutes} min`;
}

/**
 * Historial de alertas de proximidad (ETA ≤ 5 min) recibidas del servidor.
 */
export function AlertList({ alerts, onClear }: AlertListProps) {
  return (
    <section>
      <h2 className="sidebar__section-title">
        <span>
          <span className="mi" aria-hidden="true">
            notifications
          </span>{" "}
          Alertas de llegada
        </span>
        {alerts.length > 0 && (
          <button type="button" className="btn btn--ghost" onClick={onClear}>
            Limpiar
          </button>
        )}
      </h2>

      {alerts.length === 0 ? (
        <div className="empty-state">
          Sin alertas por ahora. Avisaremos cuando un autobús esté a 5 minutos o
          menos.
        </div>
      ) : (
        <div className="alert-list">
          {alerts.map((alert) => (
            <div className="alert" key={alert.id}>
              <span className="alert__icon" aria-hidden="true">
                <span className="mi" aria-hidden="true">
                  notifications
                </span>
              </span>
              <div className="alert__body">
                <p className="alert__message">{alert.message}</p>
                <div className="alert__time">
                  {relativeTime(alert.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
