import { fmt } from './calculate';
import type { CalcResult, PresentationForm } from './types';

const ROUTE: Record<PresentationForm, string> = {
  gotas: 'VO',
  solucao: 'VO',
  comprimido: 'VO',
  capsula: 'VO',
  nebulizacao: 'por nebulização',
  spray: 'via inalatória com espaçador',
  injetavel: 'VO, IM ou EV',
};

/** Texto pronto para servir de rascunho de prescrição. */
export function prescriptionText(r: CalcResult): string | null {
  if (r.blocked || !r.administration) return null;
  const { amount, unit } = r.administration;
  const qty = unit === 'comprimido' || unit === 'cápsula' ? `${fmt(amount)} ${unit}${amount > 1 ? 's' : ''}` : `${fmt(amount)} ${unit}`;
  const schedule = r.regimen.intervalHours === null ? r.scheduleText.toLowerCase() : r.scheduleText.replace('De', 'de');
  const duration = r.regimen.durationLabel ? ` — duração: ${r.regimen.durationLabel}` : '';
  return `${r.drug.name} — ${r.presentation.label}: ${qty} ${ROUTE[r.presentation.form]}, ${schedule}${duration}.`;
}
