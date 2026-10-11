import type { BusUpdate } from "@costa-bus/shared";
import { formatEta } from "@costa-bus/shared";
import { ALERT_ETA_THRESHOLD_MINUTES } from "../hooks/useSocket";

interface BusCardProps {
  bus: BusUpdate;
  /** `true` si este bus es el objetivo del Modo GO. */
  isFollowed: boolean;
  onFollow: (bus: BusUpdate) => void;
  /** Minutos hasta la parada del usuario, o `null` si no aplica. */
  etaToUser: number | null;
  /** Nombre de la parada de referencia del usuario, o `null`. */
  userStopName: string | null;
}

/**
 * Tarjeta de un autobús: identificador, operador, próxima parada, ETA, barra de
 * avance y acción para activarlo como objetivo del Modo GO.
 */
export function BusCard({
  bus,
  isFollowed,
  onFollow,
  etaToUser,
  userStopName,
}: BusCardProps) {
  const soon = bus.etaMinutes <= ALERT_ETA_THRESHOLD_MINUTES;
  const approaching =
    !soon && bus.etaMinutes <= ALERT_ETA_THRESHOLD_MINUTES * 2;

  const cardClass = [
    "bus-card",
    soon ? "bus-card--soon" : "",
    approaching ? "bus-card--approaching" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const etaClass = [
    "bus-card__eta",
    soon ? "bus-card__eta--soon" : "",
    approaching ? "bus-card__eta--approaching" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={cardClass} style={{ borderLeftColor: bus.routeColor }}>
      <header className="bus-card__header">
        <div className="bus-card__id">
          <span className="mi" aria-hidden="true">
            directions_bus
          </span>{" "}
          {bus.busId}
          {soon && (
            <span title="Llegando ahora">
              <span className="mi" aria-hidden="true">
                notifications_active
              </span>
            </span>
          )}
        </div>
        <div className={etaClass} title="Tiempo estimado de llegada">
          {formatEta(bus.etaMinutes)}
        </div>
      </header>

      <div className="bus-card__operator">{bus.operator}</div>

      {etaToUser !== null && userStopName && (
        <div className="bus-card__to-user" title="Tiempo hasta tu ubicación">
          <span className="mi" aria-hidden="true">
            my_location
          </span>{" "}
          Llega a donde estás en ~{Math.max(1, Math.round(etaToUser))} min
          <span className="bus-card__to-user-stop"> ({userStopName})</span>
        </div>
      )}

      <div className="bus-card__row">
        <span>
          Próxima parada: <strong>{bus.nextStopName}</strong>
        </span>
      </div>

      <div className="bus-card__row">
        <span>
          Velocidad: <strong>{bus.speedKmh} km/h</strong>
        </span>
        <span>{Math.round(bus.progress * 100)}% del recorrido</span>
      </div>

      <div className="progress-bar">
        <div
          className="progress-bar__fill"
          style={{
            width: `${Math.min(100, Math.max(0, bus.progress * 100))}%`,
            background: bus.routeColor,
          }}
        />
      </div>

      <div className="bus-card__row">
        <button
          type="button"
          className={`btn ${isFollowed ? "btn--danger" : "btn--primary"}`}
          onClick={() => onFollow(bus)}
          style={{ width: "100%" }}
        >
          {isFollowed ? (
            <>
              <span className="mi" aria-hidden="true">
                stop_circle
              </span>{" "}
              Detener Modo GO
            </>
          ) : (
            <>
              <span className="mi" aria-hidden="true">
                headphones
              </span>{" "}
              Seguir este bus
            </>
          )}
        </button>
      </div>
    </article>
  );
}
