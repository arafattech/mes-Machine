import { isKgUom, qualityPercent } from './quality';

describe('qualityPercent', () => {
  it('computes good / (total + wastage) when counts are kg', () => {
    expect(qualityPercent({ good: 909, total: 909, wastageKg: 858, countsInKg: true })).toBe(51.4);
    expect(qualityPercent({ good: 120, total: 120, wastageKg: 142.61, countsInKg: true })).toBe(45.7);
  });

  it('is not applicable for non-kg products instead of mixing units', () => {
    expect(qualityPercent({ good: 120, total: 120, wastageKg: 3614.61, countsInKg: false })).toBeNull();
  });

  it('is not applicable without output', () => {
    expect(qualityPercent({ good: 0, total: 0, wastageKg: 25, countsInKg: true })).toBeNull();
  });

  it('counts scrap against quality', () => {
    expect(qualityPercent({ good: 90, total: 100, wastageKg: 0, countsInKg: true })).toBe(90);
  });
});

describe('isKgUom', () => {
  it('matches kg spellings case-insensitively', () => {
    expect(isKgUom('KG')).toBe(true);
    expect(isKgUom(' Kilograms ')).toBe(true);
    expect(isKgUom('pcs')).toBe(false);
    expect(isKgUom(null)).toBe(false);
  });
});
