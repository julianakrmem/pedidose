/**
 * Peso mediano aproximado por idade (média entre sexos, curvas OMS até 5 anos e
 * CDC depois). Serve só para detectar erro de digitação, nunca para calcular dose.
 */
const MEDIAN_WEIGHT: [ageMonths: number, kg: number][] = [
  [0, 3.3], [1, 4.3], [3, 6.0], [6, 7.6], [9, 8.6], [12, 9.4], [18, 10.9], [24, 12.0],
  [36, 14.2], [48, 16.2], [60, 18.3], [72, 20.5], [84, 22.9], [96, 25.6], [108, 28.6],
  [120, 32.0], [132, 36.0], [144, 40.5], [156, 45.5], [168, 50.5], [180, 54.5],
  [192, 57.5], [204, 59.5], [216, 61.0],
];

/** Faixa considerada plausível em relação à mediana (generosa: obesidade e desnutrição existem). */
export const PLAUSIBLE_RATIO: [low: number, high: number] = [0.55, 2.0];

export function medianWeightKg(ageMonths: number): number {
  const table = MEDIAN_WEIGHT;
  if (ageMonths <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [a1, w1] = table[i];
    if (ageMonths <= a1) {
      const [a0, w0] = table[i - 1];
      return w0 + ((w1 - w0) * (ageMonths - a0)) / (a1 - a0);
    }
  }
  return table[table.length - 1][1];
}

export function isPlausibleWeight(weightKg: number, ageMonths: number): boolean {
  const ratio = weightKg / medianWeightKg(ageMonths);
  return ratio >= PLAUSIBLE_RATIO[0] && ratio <= PLAUSIBLE_RATIO[1];
}
