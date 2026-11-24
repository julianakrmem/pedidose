import { getDrug } from '../data/drugs';
import type { Administration, Alert, CalcInput, CalcResult, Drug, Presentation, Regimen } from './types';

export const MIN_WEIGHT_KG = 0.5;
export const MAX_WEIGHT_KG = 150;
export const MAX_AGE_MONTHS = 216; // 18 anos

/** Diferença relativa a partir da qual o arredondamento gera alerta. */
const ROUNDING_TOLERANCE = 0.1;

const round = (value: number, step: number) => Math.round(value / step) * step;
const floorTo = (value: number, step: number) => Math.floor(value / step + 1e-9) * step;
/** Remove ruído de ponto flutuante (ex.: 0.30000000000000004). */
const clean = (n: number) => Math.round(n * 1e6) / 1e6;

export function scheduleText(regimen: Regimen): string {
  if (regimen.intervalHours === null) return regimen.scheduleLabel ?? 'Dose única';
  if (regimen.intervalHours === 24) return '1 vez ao dia';
  return `De ${regimen.intervalHours}/${regimen.intervalHours}h`;
}

export function dosesPerDay(regimen: Regimen): number | null {
  return regimen.intervalHours ? 24 / regimen.intervalHours : null;
}

export function allowedPresentations(drug: Drug, regimen: Regimen): Presentation[] {
  if (!regimen.presentationIds) return drug.presentations;
  return drug.presentations.filter((p) => regimen.presentationIds!.includes(p.id));
}

/**
 * Converte a dose em mg para a unidade prática da apresentação, arredondando
 * para algo mensurável sem ultrapassar o teto de segurança.
 */
export function toAdministration(
  doseMg: number,
  presentation: Presentation,
  ceilingMg: number,
): { administration: Administration | null; deliveredMg: number } {
  const { form } = presentation;

  if (form === 'gotas' || form === 'nebulizacao') {
    const mgPerDrop = presentation.mgPerMl! / presentation.dropsPerMl!;
    let drops = Math.max(1, Math.round(doseMg / mgPerDrop));
    if (drops * mgPerDrop > ceilingMg + 1e-9) drops = Math.floor(ceilingMg / mgPerDrop + 1e-9);
    if (drops < 1) return { administration: null, deliveredMg: 0 };
    return {
      administration: { amount: drops, unit: 'gotas', ml: clean(drops / presentation.dropsPerMl!) },
      deliveredMg: clean(drops * mgPerDrop),
    };
  }

  if (form === 'solucao' || form === 'injetavel') {
    const conc = presentation.mgPerMl!;
    const step = doseMg / conc < 1 ? 0.05 : 0.1;
    let ml = Math.max(step, round(doseMg / conc, step));
    if (ml * conc > ceilingMg + 1e-9) ml = floorTo(ceilingMg / conc, step);
    ml = clean(ml);
    if (ml <= 0) return { administration: null, deliveredMg: 0 };
    return { administration: { amount: ml, unit: 'mL', ml }, deliveredMg: clean(ml * conc) };
  }

  // Formas unitárias: comprimido, cápsula, jato.
  const perUnit = presentation.mgPerUnit!;
  const step = presentation.divisibleBy ?? 1;
  let units = round(doseMg / perUnit, step);
  if (units * perUnit > ceilingMg + 1e-9) units = floorTo(ceilingMg / perUnit, step);
  units = clean(units);
  if (units <= 0) return { administration: null, deliveredMg: 0 };
  const unit = form === 'spray' ? 'jatos' : form === 'capsula' ? 'cápsula' : 'comprimido';
  return { administration: { amount: units, unit }, deliveredMg: clean(units * perUnit) };
}

export function calculate(input: CalcInput): CalcResult {
  const drug = getDrug(input.drugId);
  if (!drug) throw new Error(`Fármaco desconhecido: ${input.drugId}`);

  const regimen = drug.regimens.find((r) => r.id === input.regimenId) ?? drug.regimens[0];
  const allowed = allowedPresentations(drug, regimen);
  const alerts: Alert[] = [];
  let blocked = false;

  let presentation = allowed.find((p) => p.id === input.presentationId);
  if (!presentation) {
    if (input.presentationId) {
      alerts.push({
        level: 'info',
        code: 'presentation-not-in-regimen',
        message: 'A apresentação escolhida não se aplica a este esquema; usando a apresentação padrão.',
      });
    }
    presentation = allowed[0];
  }

  const base = {
    drug,
    regimen,
    presentation,
    dosesPerDay: dosesPerDay(regimen),
    scheduleText: scheduleText(regimen),
  };

  // ── 1. Validação de entrada ─────────────────────────────────────────────
  const { weightKg, ageMonths } = input;
  if (!Number.isFinite(weightKg) || weightKg < MIN_WEIGHT_KG || weightKg > MAX_WEIGHT_KG) {
    return {
      ...base,
      blocked: true,
      mgPerKgUsed: regimen.mgPerKg,
      doseMg: 0,
      deliveredDoseMg: 0,
      dailyDoseMg: null,
      administration: null,
      alerts: [
        {
          level: 'danger',
          code: 'invalid-weight',
          message: `Informe um peso entre ${MIN_WEIGHT_KG} e ${MAX_WEIGHT_KG} kg.`,
        },
      ],
    };
  }

  if (ageMonths !== undefined && (!Number.isFinite(ageMonths) || ageMonths < 0 || ageMonths > MAX_AGE_MONTHS)) {
    alerts.push({ level: 'danger', code: 'invalid-age', message: 'Idade inválida (0 a 18 anos).' });
    blocked = true;
  }

  // ── 2. Travas por idade e peso ──────────────────────────────────────────
  const hasAgeLimits =
    drug.minAgeMonths !== undefined ||
    (drug.ageRules?.length ?? 0) > 0 ||
    presentation.minAgeMonths !== undefined;

  if (ageMonths === undefined) {
    if (hasAgeLimits) {
      alerts.push({
        level: 'warning',
        code: 'age-unknown',
        message: 'Informe a idade: este fármaco ou apresentação tem restrição etária.',
      });
    }
  } else if (!blocked) {
    for (const rule of drug.ageRules ?? []) {
      if (ageMonths < rule.belowMonths) {
        alerts.push({
          level: rule.level,
          code: rule.blocks ? 'age-contraindication' : 'age-caution',
          message: rule.message,
        });
        if (rule.blocks) blocked = true;
      }
    }
    if (drug.minAgeMonths !== undefined && ageMonths < drug.minAgeMonths && !blocked) {
      alerts.push({
        level: 'danger',
        code: 'age-contraindication',
        message: `Idade mínima para ${drug.name}: ${drug.minAgeMonths} meses.`,
      });
      blocked = true;
    }
    if (presentation.minAgeMonths !== undefined && ageMonths < presentation.minAgeMonths) {
      alerts.push({
        level: 'danger',
        code: 'presentation-age',
        message: presentation.note ?? 'Apresentação inadequada para a idade.',
      });
      blocked = true;
    }
  }

  if (drug.minWeightKg !== undefined && weightKg < drug.minWeightKg) {
    alerts.push({
      level: 'danger',
      code: 'weight-below-min',
      message: `Peso mínimo para ${drug.name}: ${drug.minWeightKg} kg.`,
    });
    blocked = true;
  }
  if (presentation.minWeightKg !== undefined && weightKg < presentation.minWeightKg) {
    alerts.push({
      level: 'danger',
      code: 'presentation-weight',
      message: presentation.note ?? `Apresentação indicada a partir de ${presentation.minWeightKg} kg.`,
    });
    blocked = true;
  }

  // ── 3. Dose por tomada ──────────────────────────────────────────────────
  const [minKg, maxKg] = regimen.mgPerKgRange;
  let mgPerKgUsed = input.mgPerKg ?? regimen.mgPerKg;
  if (mgPerKgUsed < minKg || mgPerKgUsed > maxKg) {
    alerts.push({
      level: 'warning',
      code: 'mgkg-out-of-range',
      message: `mg/kg fora da faixa do esquema (${minKg}–${maxKg}); ajustado para o limite.`,
    });
    mgPerKgUsed = Math.min(maxKg, Math.max(minKg, mgPerKgUsed));
  }

  const perDay = dosesPerDay(regimen);
  let doseMg =
    regimen.basis === 'dose' ? weightKg * mgPerKgUsed : (weightKg * mgPerKgUsed) / (perDay ?? 1);

  if (regimen.minDoseMg !== undefined && doseMg < regimen.minDoseMg) {
    doseMg = regimen.minDoseMg;
    alerts.push({
      level: 'info',
      code: 'dose-raised-to-min',
      message: `Dose elevada ao mínimo eficaz do esquema (${fmt(regimen.minDoseMg)} mg).`,
    });
  }

  if (regimen.maxDoseMg !== undefined && doseMg > regimen.maxDoseMg) {
    alerts.push({
      level: 'danger',
      code: 'dose-capped',
      message: `Dose calculada (${fmt(doseMg)} mg) ultrapassa o máximo por tomada; limitada a ${fmt(regimen.maxDoseMg)} mg.`,
    });
    doseMg = regimen.maxDoseMg;
  }

  // ── 4. Teto diário ──────────────────────────────────────────────────────
  let ceilingMg = regimen.maxDoseMg ?? Number.POSITIVE_INFINITY;
  if (perDay !== null) {
    const limits: { value: number; code: 'daily-capped' | 'daily-per-kg-capped'; label: string }[] = [];
    if (regimen.maxDailyMg !== undefined) {
      limits.push({ value: regimen.maxDailyMg, code: 'daily-capped', label: `${fmt(regimen.maxDailyMg)} mg/dia` });
    }
    if (regimen.maxDailyMgPerKg !== undefined) {
      limits.push({
        value: regimen.maxDailyMgPerKg * weightKg,
        code: 'daily-per-kg-capped',
        label: `${regimen.maxDailyMgPerKg} mg/kg/dia`,
      });
    }
    for (const limit of limits) {
      const perDoseLimit = limit.value / perDay;
      ceilingMg = Math.min(ceilingMg, perDoseLimit);
      if (doseMg * perDay > limit.value + 1e-9) {
        alerts.push({
          level: 'danger',
          code: limit.code,
          message: `Total diário ultrapassaria ${limit.label}; dose por tomada limitada a ${fmt(perDoseLimit)} mg.`,
        });
        doseMg = perDoseLimit;
      }
    }
  }
  doseMg = clean(doseMg);

  // ── 5. Conversão para a apresentação ────────────────────────────────────
  const { administration, deliveredMg } = toAdministration(doseMg, presentation, ceilingMg);

  if (!administration) {
    alerts.push({
      level: 'danger',
      code: 'presentation-unsuitable',
      message: 'A dose é pequena demais para esta apresentação. Escolha uma forma líquida.',
    });
    blocked = true;
  } else if (Math.abs(deliveredMg - doseMg) / doseMg > ROUNDING_TOLERANCE) {
    alerts.push({
      level: 'warning',
      code: 'rounding',
      message: `Arredondamento da apresentação altera a dose em mais de 10% (${fmt(doseMg)} → ${fmt(deliveredMg)} mg).`,
    });
  }

  if (
    administration?.ml !== undefined &&
    presentation.maxPracticalVolumeMl !== undefined &&
    administration.ml > presentation.maxPracticalVolumeMl
  ) {
    alerts.push({
      level: 'warning',
      code: 'volume-high',
      message: `Volume alto (${fmt(administration.ml)} mL por tomada): considere uma apresentação mais concentrada.`,
    });
  }

  if (presentation.dropsPerMl !== undefined) {
    alerts.push({
      level: 'info',
      code: 'drops-vary',
      message: `Cálculo considera ${presentation.dropsPerMl} gotas/mL — confira o conta-gotas do fabricante.`,
    });
  }

  for (const w of drug.warnings ?? []) alerts.push({ level: 'info', code: 'clinical', message: w });
  if (regimen.note) alerts.push({ level: 'info', code: 'clinical', message: regimen.note });

  return {
    ...base,
    presentation,
    blocked,
    mgPerKgUsed,
    doseMg,
    deliveredDoseMg: deliveredMg,
    dailyDoseMg: perDay !== null ? clean(deliveredMg * perDay) : null,
    administration: blocked ? null : administration,
    alerts: sortAlerts(alerts),
  };
}

const LEVEL_ORDER = { danger: 0, warning: 1, info: 2 } as const;
const sortAlerts = (alerts: Alert[]) =>
  [...alerts].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);

/** Número em pt-BR com até 2 casas decimais. */
export function fmt(n: number, maxDecimals = 2): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: maxDecimals });
}
