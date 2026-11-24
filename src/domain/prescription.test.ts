import { describe, expect, it } from 'vitest';
import { calculate } from './calculate';
import { buildPrescription, formatUnits } from './prescription';

describe('prescrição formatada', () => {
  it('paracetamol em gotas, com condição de uso', () => {
    const p = buildPrescription(calculate({ drugId: 'paracetamol', weightKg: 10, ageMonths: 12, presentationId: 'gotas-200' }))!;
    expect(p.header).toBe('USO ORAL');
    expect(p.item).toBe('Paracetamol — Gotas 200 mg/mL');
    expect(p.instruction).toBe('Dar 11 gotas (146,67 mg) por via oral, de 6/6h, se dor ou febre.');
    expect(p.text.split('\n')).toHaveLength(3);
  });

  it('antibiótico inclui volume e duração', () => {
    const p = buildPrescription(
      calculate({ drugId: 'amoxicilina', weightKg: 15, ageMonths: 36, regimenId: 'alta', presentationId: 'susp-100' }),
    )!;
    expect(p.instruction).toBe('Dar 6,8 mL (680 mg) por via oral, de 12/12h.');
    expect(p.notes.some((n) => n.startsWith('Duração:'))).toBe(true);
  });

  it('nebulização traz a diluição', () => {
    const p = buildPrescription(calculate({ drugId: 'salbutamol', weightKg: 10, regimenId: 'nebulizacao' }))!;
    expect(p.header).toBe('USO INALATÓRIO');
    expect(p.instruction.startsWith('Nebulizar com 10 gotas (2,5 mg), a cada 20 min')).toBe(true);
    expect(p.notes).toContain('Diluir em 3 a 4 mL de SF 0,9%.');
  });

  it('dexametasona em dose única', () => {
    const p = buildPrescription(calculate({ drugId: 'dexametasona', weightKg: 15, ageMonths: 30 }))!;
    expect(p.instruction).toContain('em dose única');
  });

  it('comprimido partido aparece como fração', () => {
    const r = calculate({ drugId: 'prednisolona', weightKg: 17.5, ageMonths: 60, presentationId: 'comp-5' });
    expect(buildPrescription(r)!.instruction).toContain('3 e ½ comprimidos');
    expect(formatUnits(0.5)).toBe('½');
  });

  it('não gera prescrição quando bloqueado', () => {
    expect(buildPrescription(calculate({ drugId: 'ibuprofeno', weightKg: 6, ageMonths: 4 }))).toBeNull();
  });
});
