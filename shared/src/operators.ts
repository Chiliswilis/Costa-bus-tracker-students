import type { Operator } from './types.js';

/**
 * Identidad visual de cada línea de autobuses.
 *
 * El color se usa para pintar el marcador del autobús y el acento de su tarjeta
 * en el panel, de modo que se distinga de un vistazo qué empresa opera la unidad:
 *
 * - Primera Plus            → dorado
 * - Autocamiones del Pacífico → azul
 * - ETN Turistar Lujo       → plata
 */
export interface OperatorBrand {
  /** Color principal de la línea. */
  color: string;
  /** Color de texto legible sobre `color`. */
  textColor: string;
}

/** Marca por defecto cuando el operador no está catalogado. */
export const DEFAULT_OPERATOR_BRAND: OperatorBrand = {
  color: '#94a3b8',
  textColor: '#0f172a',
};

/** Marcas conocidas, indexadas por nombre exacto del operador. */
const OPERATOR_BRANDS: Record<string, OperatorBrand> = {
  'Primera Plus': { color: '#d4a017', textColor: '#2a1c00' },
  'Autocamiones del Pacífico': { color: '#2563eb', textColor: '#ffffff' },
  'ETN Turistar Lujo': { color: '#c0c7d1', textColor: '#1f2937' },
};

/**
 * Devuelve la marca visual del operador. Si el nombre no coincide exactamente
 * con el catálogo, se intenta un match parcial (por ejemplo, "ETN").
 */
export function operatorBrand(operatorName: string | undefined | null): OperatorBrand {
  if (!operatorName) return DEFAULT_OPERATOR_BRAND;

  const exact = OPERATOR_BRANDS[operatorName];
  if (exact) return exact;

  const normalized = operatorName.toLowerCase();
  for (const [name, brand] of Object.entries(OPERATOR_BRANDS)) {
    const key = name.toLowerCase();
    if (normalized.includes(key) || key.includes(normalized)) return brand;
  }

  // Coincidencias por palabra clave suelta.
  if (normalized.includes('primera')) {
    return OPERATOR_BRANDS['Primera Plus'];
  }
  if (normalized.includes('pacífico') || normalized.includes('pacifico')) {
    return OPERATOR_BRANDS['Autocamiones del Pacífico'];
  }
  if (normalized.includes('etn')) {
    return OPERATOR_BRANDS['ETN Turistar Lujo'];
  }

  return DEFAULT_OPERATOR_BRAND;
}

/** Color de marcador para un operador dado. */
export function operatorColor(operatorName: string | undefined | null): string {
  return operatorBrand(operatorName).color;
}

/** Texto legible sobre el color del operador. */
export function operatorTextColor(operatorName: string | undefined | null): string {
  return operatorBrand(operatorName).textColor;
}

/** Operadores catalogados, útil para leyendas. */
export const KNOWN_OPERATORS: Operator[] = [
  { name: 'ETN Turistar Lujo', purchaseUrl: 'https://www.etn.com.mx' },
  { name: 'Primera Plus', purchaseUrl: 'https://www.primeraplus.com.mx' },
  {
    name: 'Autocamiones del Pacífico',
    purchaseUrl: 'https://www.autocamionesdelpacifico.com.mx',
  },
];
