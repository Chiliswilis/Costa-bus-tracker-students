import type { BusUpdate } from "@costa-bus/shared";
import { BusCard } from "./BusCard";

interface BusListProps {
  buses: BusUpdate[];
  followedBusId: string | null;
  onFollow: (bus: BusUpdate) => void;
  /** ETA (min) de cada bus hasta la parada del usuario; vacío si no hay GPS. */
  etaToUserByBus: Record<string, number>;
  /** Nombre de la parada de referencia del usuario, o `null`. */
  userStopName: string | null;
}

/**
 * Lista de autobuses de la ruta seleccionada.
 * Con ubicación activa se ordena por tiempo real hasta el usuario; si no, por
 * ETA a la siguiente parada del bus.
 */
export function BusList({
  buses,
  followedBusId,
  onFollow,
  etaToUserByBus,
  userStopName,
}: BusListProps) {
  const sorted = [...buses].sort((a, b) => {
    const etaA = etaToUserByBus[a.busId] ?? a.etaMinutes;
    const etaB = etaToUserByBus[b.busId] ?? b.etaMinutes;
    return etaA - etaB;
  });

  if (sorted.length === 0) {
    return (
      <div className="empty-state">
        Sin unidades reportando en esta ruta.
        <br />
        {buses.length === 0 && "Esperando telemetría del servidor…"}
      </div>
    );
  }

  return (
    <div className="bus-list">
      {sorted.map((bus) => (
        <BusCard
          key={bus.busId}
          bus={bus}
          isFollowed={bus.busId === followedBusId}
          onFollow={onFollow}
          etaToUser={etaToUserByBus[bus.busId] ?? null}
          userStopName={userStopName}
        />
      ))}
    </div>
  );
}
