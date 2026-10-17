import type { Alert } from "@costa-bus/shared";

interface ServiceAlertsProps {
  /** Alertas de proximidad activas (ETA ≤ umbral). */
  alerts: Alert[];
  /** Parada de referencia del usuario, o `null` si no hay GPS. */
  userStopName: string | null;
  /** ETA en minutos de la unidad más cercana al usuario. */
  nearestEtaMinutes: number | null;
  /** Operador de esa unidad más cercana. */
  nearestOperator: string | null;
  onClear: () => void;
}

/** Formatea una hora UNIX como "hh:mm". */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Panel de alertas de servicio con el diseño de tarjeta grande: muestra la
 * parada vigilada, la ETA más próxima en tipografía destacada y, debajo, una
 * tarjeta "En todo momento" con la dirección y el aviso de la alerta activa.
 */
export function ServiceAlerts({
  alerts,
  userStopName,
  nearestEtaMinutes,
  nearestOperator,
  onClear,
}: ServiceAlertsProps) {
  const latest = alerts[0] ?? null;

  return (
    <section className="service-alerts">
      <h2 className="service-alerts__title">Alertas de servicio</h2>

      <div className="service-alerts__stop">
        <span className="mi" aria-hidden="true">
          location_on
        </span>{" "}
        {userStopName ?? "Activa tu ubicación"}
      </div>

      {nearestEtaMinutes !== null ? (
        <div className="service-alerts__headline">
          <div className="service-alerts__eta-block">
            <span className="service-alerts__eta-value">
              {Math.max(1, Math.round(nearestEtaMinutes))}
            </span>
            <span className="service-alerts__eta-unit">min</span>
          </div>
          <div className="service-alerts__eta-info">
            <span className="service-alerts__eta-label">Llega a</span>
            <span className="service-alerts__eta-stop">
              {latest?.stopName ?? userStopName ?? "tu parada"}
            </span>
          </div>
        </div>
      ) : (
        <div className="service-alerts__headline service-alerts__headline--idle">
          <span className="mi" aria-hidden="true">
            directions_bus
          </span>
          <span className="service-alerts__idle-text">
            Sin unidades en camino por ahora
          </span>
        </div>
      )}

      <div className="service-alerts__card">
        <div className="service-alerts__card-top">
          <span className="mi" aria-hidden="true">
            schedule
          </span>
          <span className="service-alerts__card-label">En todo momento</span>
          <span className="service-alerts__card-count">
            {alerts.length} {alerts.length === 1 ? "aviso" : "avisos"}
          </span>
        </div>

        <p className="service-alerts__card-address">
          {nearestOperator ?? "Corredor Costa de Jalisco"}
        </p>

        {latest ? (
          <div className="service-alerts__notice">
            <span className="mi" aria-hidden="true">
              notifications_active
            </span>
            <div>
              <p className="service-alerts__notice-message">{latest.message}</p>
              <span className="service-alerts__notice-time">
                Última actualización: {formatTime(latest.timestamp)}
              </span>
            </div>
          </div>
        ) : (
          <p className="service-alerts__card-hint">
            Te avisaremos aquí cuando un autobús esté a 5 minutos o menos de tu
            parada.
          </p>
        )}

        {alerts.length > 0 && (
          <button
            type="button"
            className="btn service-alerts__clear"
            onClick={onClear}
          >
            Limpiar alertas
          </button>
        )}
      </div>
    </section>
  );
}
