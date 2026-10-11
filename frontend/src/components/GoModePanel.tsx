import { formatEta, type BusUpdate } from '@costa-bus/shared';
import { ALERT_ETA_THRESHOLD_MINUTES } from '../hooks/useSocket';

interface GoModePanelProps {
  /** Bus que se está siguiendo; `null` desactiva el panel. */
  bus: BusUpdate | null;
  /** `true` mientras suena la alarma de proximidad. */
  ringing: boolean;
  /** Sonido activado/desactivado por el usuario. */
  soundEnabled: boolean;
  onToggleSound: () => void;
  onStop: () => void;
}

/**
 * Panel flotante del Modo GO: sigue a un autobús concreto y avisa (con sonido
 * cuando está habilitado) en cuanto entra en el umbral de llegada.
 */
export function GoModePanel({
  bus,
  ringing,
  soundEnabled,
  onToggleSound,
  onStop,
}: GoModePanelProps) {
  if (!bus) return null;

  const soon = bus.etaMinutes <= ALERT_ETA_THRESHOLD_MINUTES;
  const approaching = !soon && bus.etaMinutes <= ALERT_ETA_THRESHOLD_MINUTES * 2;

  const etaClass = [
    'go-overlay__eta',
    soon ? 'go-overlay__eta--soon' : '',
    approaching ? 'go-overlay__eta--approaching' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <aside className={`go-overlay${ringing ? ' go-overlay--ringing' : ''}`}>
      <h2 className="go-overlay__title">
        <span className="mi" aria-hidden="true">
          headphones
        </span>{" "}
        Modo GO · {bus.busId}
        {ringing && (
          <span aria-label="Alarma sonando">
            <span className="mi mi--filled" aria-hidden="true">
              notifications_active
            </span>
          </span>
        )}
      </h2>

      <div className={etaClass}>{soon ? '¡Llegando!' : formatEta(bus.etaMinutes)}</div>

      <p className="go-overlay__meta">
        {bus.operator}
        <br />
        Próxima parada: <strong style={{ color: 'var(--text)' }}>{bus.nextStopName}</strong>
        <br />
        Distancia restante estimada para llegar: {formatEta(bus.etaMinutes)}
        <br />
        Velocidad: {bus.speedKmh} km/h
      </p>

      <div className="go-overlay__actions">
        <button
          type="button"
          className={`btn ${soundEnabled ? 'btn--primary' : ''}`}
          onClick={onToggleSound}
        >
          {soundEnabled ? (
            <>
              <span className="mi" aria-hidden="true">
                volume_up
              </span>{" "}
              Sonido activado
            </>
          ) : (
            <>
              <span className="mi" aria-hidden="true">
                volume_off
              </span>{" "}
              Sonido desactivado
            </>
          )}
        </button>

        <button type="button" className="btn btn--danger" onClick={onStop}>
          <span className="mi" aria-hidden="true">
            stop_circle
          </span>{" "}
          Detener
        </button>
      </div>

      {soon && (
        <p
          style={{
            margin: 0,
            fontSize: '0.76rem',
            color: 'var(--danger)',
            fontWeight: 600,
          }}
        >
          El autobús está a {Math.round(bus.etaMinutes)} min de {bus.nextStopName}.
        </p>
      )}
    </aside>
  );
}
