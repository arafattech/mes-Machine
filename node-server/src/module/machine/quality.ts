/**
 * Quality is computed in kilograms on both sides: wastage is always logged in kg, so counts
 * are only comparable when every product in scope is measured in kg (BTL decision). Any other
 * unit makes Quality not applicable — `null`, never a mixed-unit figure.
 */
const KG_UOM_NAMES = new Set(
  (process.env.MES_KG_UOM_NAMES ?? 'kg,kgs,kilogram,kilograms')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean),
);

export function isKgUom(name: string | null | undefined): boolean {
  return !!name && KG_UOM_NAMES.has(name.trim().toLowerCase());
}

export interface QualityInput {
  good: number;
  /** Good + scrap counts, in the products' unit. */
  total: number;
  /** Wastage logged via the Wastage Log, kg. */
  wastageKg: number;
  /** True only when every product counted in scope is measured in kg. */
  countsInKg: boolean;
}

/** Denominator for Quality %, or `null` when Quality does not apply (non-kg units or no output). */
export function qualityDenominator({ total, wastageKg, countsInKg }: QualityInput): number | null {
  return countsInKg && total > 0 ? total + wastageKg : null;
}

/** Quality % = good / (good + scrap + wastage), all in kg; `null` when not applicable. */
export function qualityPercent(input: QualityInput): number | null {
  const denominator = qualityDenominator(input);
  // Same expression as the frontend live mirror (`round1(x * 100)`) so both round identically.
  return denominator ? Math.round((input.good / denominator) * 100 * 10) / 10 : null;
}
