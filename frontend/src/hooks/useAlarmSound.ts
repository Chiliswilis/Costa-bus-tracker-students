import { useCallback, useRef } from "react";

/**
 * Genera tonos de aviso con la Web Audio API, sin depender de archivos de audio.
 *
 * Los navegadores exigen una interacción del usuario para habilitar el audio, por
 * eso se expone `unlock()`: el botón de "Modo GO" lo invoca antes de arrancar.
 */
export function useAlarmSound() {
  const contextRef = useRef<AudioContext | null>(null);

  /** Crea (si hace falta) el `AudioContext` y lo reanuda. */
  const unlock = useCallback(async (): Promise<void> => {
    if (!contextRef.current) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      contextRef.current = new Ctor();
    }
    if (contextRef.current.state === "suspended") {
      await contextRef.current.resume();
    }
  }, []);

  /** Reproduce un tono corto. `frequency` en Hz, `duration` en segundos. */
  const beep = useCallback(
    (frequency: number, duration: number, delay = 0): void => {
      const context = contextRef.current;
      if (!context) return;

      const startAt = context.currentTime + delay;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, startAt);

      // Envolvente suave para evitar clics.
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration + 0.02);
    },
    [],
  );

  /** Aviso de "el bus está llegando": dos pulsos ascendentes. */
  const playArrivalAlert = useCallback((): void => {
    beep(880, 0.18, 0);
    beep(1180, 0.22, 0.24);
  }, [beep]);

  /** Aviso crítico: tres pulsos rápidos. */
  const playUrgentAlert = useCallback((): void => {
    beep(1320, 0.12, 0);
    beep(1320, 0.12, 0.2);
    beep(1320, 0.12, 0.4);
  }, [beep]);

  return { unlock, playArrivalAlert, playUrgentAlert };
}
