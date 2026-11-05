import type { BusUpdate } from "@costa-bus/shared";
import { operatorBrand } from "@costa-bus/shared";

/** Una ruta cuyo corredor pasa cerca del usuario. */
export interface NearbyRouteGroup {
  /** Identificador de la dirección mostrada (ida o regreso). */
  directionId: string;
  /** Nombre de la parada más próxima al usuario. */
  stopName: string;
  /** Color de la ruta. */
  color: string;
  /** Número grande de la tarjeta (código de línea). */
  badge: string;
  /** Nombre de la ruta. */
  title: string;
  /** Sub-línea ("Hacia <parada>"). */
  subtitle: string;
  /** Distancia en kilómetros del usuario a esa parada. */
  distanceKm: number;
  /** Nombre del operador que la cubre. */
  operator: string;
  /** ETA en minutos de la unidad más próxima (o `null` si no hay). */
  etaMinutes: number | null;
}

interface NearbyRoutesProps {
  groups: NearbyRouteGroup[];
  loading: boolean;
  /** Dirección seleccionada actualmente (para resaltar su fila). */
  selectedDirectionId: string;
  /** Selecciona una ruta al hacer clic en su fila. */
  onSelect: (directionId: string) => void;
}

/** Formatea una distancia en km de forma compacta ("850 m" / "12.4 km"). */
function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/**
 * Panel "Rutas activas cerca de ti".
 *
 * Cada fila va teñida con el color de la línea que la opera y es clicable: al
 * pulsarla se selecciona esa ruta y el panel de autobuses pasa a mostrar las
 * unidades que circulan por ella.
 */
export function NearbyRoutes({
  groups,
  loading,
  selectedDirectionId,
  onSelect,
}: NearbyRoutesProps) {
  if (loading) {
    return (
      <section className="nearby">
        <h2 className="nearby__title">Rutas activas cerca de ti</h2>
        <div className="empty-state">Buscando rutas a tu alrededor…</div>
      </section>
    );
  }

  if (groups.length === 0) {
    return (
      <section className="nearby">
        <h2 className="nearby__title">Rutas activas cerca de ti</h2>
        <div className="empty-state">
          No encontramos rutas a menos de 40 km de tu ubicación.
        </div>
      </section>
    );
  }

  return (
    <section className="nearby">
      <h2 className="nearby__title">Rutas activas cerca de ti</h2>
      <div className="nearby__list">
        {groups.map((group) => {
          const brand = operatorBrand(group.operator);
          const isReturn = group.directionId.endsWith("-return");
          const active = group.directionId === selectedDirectionId;

          return (
            <button
              key={group.directionId}
              type="button"
              className={`nearby-card${active ? " nearby-card--active" : ""}`}
              style={{
                ["--line-color" as string]: brand.color,
                ["--route-color" as string]: group.color,
              }}
              onClick={() => onSelect(group.directionId)}
              aria-pressed={active}
              title={`Ver los autobuses de ${group.title}`}
            >
              <span
                className="nearby-card__badge"
                style={{ background: brand.color, color: brand.textColor }}
                aria-hidden="true"
              >
                {group.badge}
              </span>

              <span className="nearby-card__body">
                <span className="nearby-card__title">
                  {group.title}
                  <span className="nearby-card__dir">
                    {isReturn ? "Regreso" : "Ida"}
                  </span>
                </span>
                <span className="nearby-card__subtitle">{group.subtitle}</span>
                <span className="nearby-card__meta">
                  <span className="nearby-card__distance">
                    <span className="mi" aria-hidden="true">
                      near_me
                    </span>{" "}
                    {formatDistance(group.distanceKm)}
                  </span>
                  <span className="nearby-card__operator">
                    {group.operator}
                  </span>
                </span>
              </span>

              <span className="nearby-card__eta">
                {group.etaMinutes === null ? (
                  <span className="nearby-card__eta-none">—</span>
                ) : (
                  <>
                    <span className="nearby-card__eta-value">
                      {Math.max(1, Math.round(group.etaMinutes))}
                    </span>
                    <span className="nearby-card__eta-unit">min</span>
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Construye el badge numérico determinista de un corredor.
 *
 * Se calcula sobre el id base (sin el sufijo de regreso), de modo que ida y
 * vuelta de la misma ruta comparten número, como en una línea de transporte.
 */
export function badgeForRoute(routeId: string): string {
  const base = routeId.replace(/-return$/, "");
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    hash = (hash * 31 + base.charCodeAt(i)) % 997;
  }
  return String((hash % 98) + 1).padStart(2, "0");
}

/** Nombre del operador de una unidad, o `null` si aún no hay telemetría. */
export function operatorLabel(bus: BusUpdate | undefined): string | null {
  return bus?.operator ?? null;
}
