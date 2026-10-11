import type { Operator } from "@costa-bus/shared";

interface PurchaseLinksProps {
  operators: Operator[];
  routeName: string;
}

/**
 * Enlaces oficiales de compra de boletos para los operadores que cubren la
 * ruta seleccionada. Si el operador define un `fallbackUrl`, se muestra como
 * enlace secundario para cuando el sitio principal no responde.
 */
export function PurchaseLinks({ operators, routeName }: PurchaseLinksProps) {
  return (
    <section>
      <h2 className="sidebar__section-title">
        <span>
          <span className="mi" aria-hidden="true">
            confirmation_number
          </span>{" "}
          Comprar boletos
        </span>
      </h2>

      {operators.length === 0 ? (
        <div className="empty-state">
          Sin operadores registrados para esta ruta.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.78rem",
              color: "var(--text-muted)",
            }}
          >
            Operadores que cubren <strong>{routeName}</strong>:
          </p>

          {operators.map((operator) => (
            <div
              key={operator.name}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 11px",
                background: "var(--bg-elevated)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <strong style={{ fontSize: "0.86rem" }}>{operator.name}</strong>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a
                  className="btn btn--buy"
                  href={operator.purchaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="mi" aria-hidden="true">
                    public
                  </span>
                  Comprar boleto
                </a>

                {operator.fallbackUrl && (
                  <a
                    className="btn btn--buy"
                    href={operator.fallbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Sitio de respaldo"
                  >
                    <span className="mi" aria-hidden="true">
                      sync_alt
                    </span>
                    Respaldo
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
