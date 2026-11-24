import { describe, expect, it } from 'vitest';
import { DRUGS } from '../data/drugs';
import { allowedPresentations, calculate } from './calculate';
import type { AlertCode, CalcResult } from './types';

const codes = (r: CalcResult): AlertCode[] => r.alerts.map((a) => a.code);

describe('validação de entrada', () => {
  it.each([0, -3, Number.NaN, 200])('bloqueia peso inválido (%s)', (weightKg) => {
    const r = calculate({ drugId: 'paracetamol', weightKg });
    expect(r.blocked).toBe(true);
    expect(r.administration).toBeNull();
    expect(codes(r)).toContain('invalid-weight');
  });

  it('bloqueia idade inválida', () => {
    const r = calculate({ drugId: 'paracetamol', weightKg: 10, ageMonths: 300 });
    expect(r.blocked).toBe(true);
    expect(codes(r)).toContain('invalid-age');
  });

  it('lança erro para fármaco inexistente', () => {
    expect(() => calculate({ drugId: 'xyz', weightKg: 10 })).toThrow();
  });
});

describe('paracetamol', () => {
  it('10 kg, gotas 200 mg/mL → 11 gotas de 6/6h', () => {
    const r = calculate({ drugId: 'paracetamol', weightKg: 10, ageMonths: 12, presentationId: 'gotas-200' });
    expect(r.blocked).toBe(false);
    expect(r.doseMg).toBe(150);
    expect(r.administration).toMatchObject({ amount: 11, unit: 'gotas' });
    expect(r.deliveredDoseMg).toBeCloseTo(146.67, 1);
    expect(r.scheduleText).toBe('De 6/6h');
    expect(r.dosesPerDay).toBe(4);
  });

  it('70 kg bate no teto de 1 g por tomada', () => {
    const r = calculate({ drugId: 'paracetamol', weightKg: 70, ageMonths: 192, presentationId: 'gotas-200' });
    expect(r.doseMg).toBe(1000);
    expect(codes(r)).toContain('dose-capped');
    expect(r.administration?.amount).toBe(75);
    expect(r.dailyDoseMg).toBeLessThanOrEqual(4000);
  });

  it('bloqueia comprimido para criança de 8 anos', () => {
    const r = calculate({ drugId: 'paracetamol', weightKg: 25, ageMonths: 96, presentationId: 'comp-500' });
    expect(r.blocked).toBe(true);
    expect(codes(r)).toContain('presentation-age');
  });

  it('alerta, sem bloquear, lactente < 3 meses', () => {
    const r = calculate({ drugId: 'paracetamol', weightKg: 4, ageMonths: 1 });
    expect(r.blocked).toBe(false);
    expect(codes(r)).toContain('age-caution');
  });
});

describe('dipirona', () => {
  it('bloqueia criança de 4 kg (peso mínimo 5 kg)', () => {
    const r = calculate({ drugId: 'dipirona', weightKg: 4, ageMonths: 4 });
    expect(r.blocked).toBe(true);
    expect(codes(r)).toContain('weight-below-min');
  });

  it('bloqueia menor de 3 meses', () => {
    const r = calculate({ drugId: 'dipirona', weightKg: 6, ageMonths: 2 });
    expect(r.blocked).toBe(true);
    expect(codes(r)).toContain('age-contraindication');
  });

  it('45 kg a 20 mg/kg → 36 gotas', () => {
    const r = calculate({ drugId: 'dipirona', weightKg: 45, ageMonths: 144 });
    expect(r.doseMg).toBe(900);
    expect(r.administration).toMatchObject({ amount: 36, unit: 'gotas' });
  });

  it('45 kg a 25 mg/kg é limitado a 1 g (40 gotas)', () => {
    const r = calculate({ drugId: 'dipirona', weightKg: 45, ageMonths: 144, mgPerKg: 25 });
    expect(r.doseMg).toBe(1000);
    expect(r.administration?.amount).toBe(40);
    expect(codes(r)).toContain('dose-capped');
  });
});

describe('ibuprofeno', () => {
  it('bloqueia menor de 6 meses', () => {
    const r = calculate({ drugId: 'ibuprofeno', weightKg: 7, ageMonths: 5 });
    expect(r.blocked).toBe(true);
    expect(codes(r)).toContain('age-contraindication');
  });

  it('avisa quando a idade não foi informada', () => {
    const r = calculate({ drugId: 'ibuprofeno', weightKg: 12 });
    expect(r.blocked).toBe(false);
    expect(codes(r)).toContain('age-unknown');
  });

  it('45 kg é limitado a 400 mg (40 gotas de 100 mg/mL)', () => {
    const r = calculate({ drugId: 'ibuprofeno', weightKg: 45, ageMonths: 144, presentationId: 'gotas-100' });
    expect(r.doseMg).toBe(400);
    expect(r.administration?.amount).toBe(40);
    expect(r.dailyDoseMg).toBe(1200);
  });
});

describe('antibióticos (dose por dia)', () => {
  it('amoxicilina padrão 45 kg: 750 mg/tomada limitado a 500 mg → 10 mL', () => {
    const r = calculate({ drugId: 'amoxicilina', weightKg: 45, ageMonths: 144, presentationId: 'susp-50' });
    expect(r.doseMg).toBe(500);
    expect(r.administration).toMatchObject({ amount: 10, unit: 'mL' });
    expect(r.dailyDoseMg).toBe(1500);
  });

  it('amoxicilina alta dose 15 kg, 500 mg/5 mL → 6,8 mL de 12/12h', () => {
    const r = calculate({
      drugId: 'amoxicilina',
      weightKg: 15,
      ageMonths: 36,
      regimenId: 'alta',
      presentationId: 'susp-100',
    });
    expect(r.doseMg).toBe(675);
    expect(r.administration?.amount).toBe(6.8);
    expect(r.scheduleText).toBe('De 12/12h');
  });

  it('amoxicilina + clavulanato bloqueia menor de 3 meses', () => {
    const r = calculate({ drugId: 'amoxi-clav', weightKg: 5, ageMonths: 2 });
    expect(r.blocked).toBe(true);
  });

  it('troca para a apresentação ES quando o esquema é alta dose', () => {
    const r = calculate({
      drugId: 'amoxi-clav',
      weightKg: 12,
      ageMonths: 24,
      regimenId: 'alta',
      presentationId: 'bd-400',
    });
    expect(r.presentation.id).toBe('es-600');
    expect(codes(r)).toContain('presentation-not-in-regimen');
  });

  it('azitromicina 60 kg respeita teto de 500 mg/dia', () => {
    const r = calculate({ drugId: 'azitromicina', weightKg: 60, ageMonths: 168, presentationId: 'susp-40' });
    expect(r.doseMg).toBe(500);
    expect(r.administration?.amount).toBe(12.5);
    expect(r.scheduleText).toBe('1 vez ao dia');
    expect(codes(r)).toContain('daily-capped');
  });
});

describe('corticoides', () => {
  it('prednisolona 12 kg a 1 mg/kg → 4 mL de 3 mg/mL', () => {
    const r = calculate({ drugId: 'prednisolona', weightKg: 12, ageMonths: 30 });
    expect(r.administration).toMatchObject({ amount: 4, unit: 'mL' });
  });

  it('prednisolona 50 kg a 2 mg/kg é limitada a 40 mg/dia', () => {
    const r = calculate({ drugId: 'prednisolona', weightKg: 50, ageMonths: 156, mgPerKg: 2 });
    expect(r.doseMg).toBe(40);
    expect(r.deliveredDoseMg).toBeLessThanOrEqual(40);
  });

  it('dexametasona em elixir gera alerta de volume alto', () => {
    const r = calculate({ drugId: 'dexametasona', weightKg: 15, ageMonths: 30, presentationId: 'elixir-01' });
    expect(r.doseMg).toBe(9);
    expect(codes(r)).toContain('volume-high');
    expect(r.scheduleText).toBe('Dose única');
  });

  it('dexametasona injetável VO 15 kg → 2,3 mL', () => {
    const r = calculate({ drugId: 'dexametasona', weightKg: 15, ageMonths: 30, presentationId: 'inj-4' });
    expect(r.administration?.amount).toBe(2.3);
  });
});

describe('formas unitárias e doses mínimas', () => {
  it('ondansetrona orodispersível 4 mg é inadequada para 10 kg', () => {
    const r = calculate({ drugId: 'ondansetrona', weightKg: 10, ageMonths: 12, presentationId: 'odt-4' });
    expect(r.blocked).toBe(true);
    expect(codes(r)).toContain('presentation-unsuitable');
  });

  it('salbutamol nebulização 10 kg sobe para a dose mínima de 2,5 mg (10 gotas)', () => {
    const r = calculate({ drugId: 'salbutamol', weightKg: 10, regimenId: 'nebulizacao' });
    expect(r.doseMg).toBe(2.5);
    expect(r.administration).toMatchObject({ amount: 10, unit: 'gotas' });
    expect(codes(r)).toContain('dose-raised-to-min');
  });

  it('salbutamol spray: 6 kg → 3 jatos; 30 kg → teto de 10 jatos', () => {
    expect(calculate({ drugId: 'salbutamol', weightKg: 6 }).administration?.amount).toBe(3);
    const big = calculate({ drugId: 'salbutamol', weightKg: 30 });
    expect(big.administration).toMatchObject({ amount: 10, unit: 'jatos' });
  });
});

describe('faixa de mg/kg', () => {
  it('limita mg/kg escolhido fora da faixa', () => {
    const r = calculate({ drugId: 'paracetamol', weightKg: 10, ageMonths: 12, mgPerKg: 30 });
    expect(r.mgPerKgUsed).toBe(15);
    expect(codes(r)).toContain('mgkg-out-of-range');
  });
});

describe('integridade da base de dados', () => {
  it.each(DRUGS.map((d) => [d.id, d] as const))('%s tem dados consistentes', (_id, drug) => {
    expect(drug.references.length).toBeGreaterThan(0);
    for (const reg of drug.regimens) {
      const [min, max] = reg.mgPerKgRange;
      expect(min).toBeLessThanOrEqual(max);
      expect(reg.mgPerKg).toBeGreaterThanOrEqual(min);
      expect(reg.mgPerKg).toBeLessThanOrEqual(max);
      expect(allowedPresentations(drug, reg).length).toBeGreaterThan(0);
      for (const id of reg.presentationIds ?? []) {
        expect(drug.presentations.some((p) => p.id === id)).toBe(true);
      }
    }
    for (const p of drug.presentations) {
      if (['gotas', 'nebulizacao'].includes(p.form)) expect(p.dropsPerMl).toBeGreaterThan(0);
      if (['gotas', 'nebulizacao', 'solucao', 'injetavel'].includes(p.form)) expect(p.mgPerMl).toBeGreaterThan(0);
      if (['comprimido', 'capsula', 'spray'].includes(p.form)) expect(p.mgPerUnit).toBeGreaterThan(0);
    }
  });
});

describe('invariante de segurança: nenhuma combinação ultrapassa os tetos', () => {
  const weights = [0.5, 1, 2.5, 4, 7, 10, 13.5, 20, 33, 45, 60, 80, 120, 150];
  for (const drug of DRUGS) {
    for (const reg of drug.regimens) {
      for (const pres of allowedPresentations(drug, reg)) {
        it(`${drug.id} / ${reg.id} / ${pres.id}`, () => {
          for (const w of weights) {
            for (const mgPerKg of reg.mgPerKgRange) {
              const r = calculate({
                drugId: drug.id,
                regimenId: reg.id,
                presentationId: pres.id,
                weightKg: w,
                ageMonths: 216,
                mgPerKg,
              });
              if (reg.maxDoseMg !== undefined) expect(r.deliveredDoseMg).toBeLessThanOrEqual(reg.maxDoseMg + 1e-6);
              if (r.dailyDoseMg !== null) {
                if (reg.maxDailyMg !== undefined) expect(r.dailyDoseMg).toBeLessThanOrEqual(reg.maxDailyMg + 1e-6);
                if (reg.maxDailyMgPerKg !== undefined) {
                  expect(r.dailyDoseMg).toBeLessThanOrEqual(reg.maxDailyMgPerKg * w + 1e-6);
                }
              }
            }
          }
        });
      }
    }
  }
});
