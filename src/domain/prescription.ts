import { fmt } from './calculate';
import type { Administration, CalcResult, PresentationForm } from './types';

interface Route {
  header: string;
  verb: string;
  via: string;
}

const ROUTES: Record<PresentationForm, Route> = {
  gotas: { header: 'USO ORAL', verb: 'Dar', via: 'por via oral' },
  solucao: { header: 'USO ORAL', verb: 'Dar', via: 'por via oral' },
  comprimido: { header: 'USO ORAL', verb: 'Dar', via: 'por via oral' },
  capsula: { header: 'USO ORAL', verb: 'Dar', via: 'por via oral' },
  nebulizacao: { header: 'USO INALATÓRIO', verb: 'Nebulizar com', via: '' },
  spray: { header: 'USO INALATÓRIO', verb: 'Fazer', via: 'com espaçador' },
  injetavel: { header: 'USO ORAL OU PARENTERAL', verb: 'Administrar', via: 'por via oral, IM ou EV' },
};

export interface Prescription {
  header: string;
  item: string;
  instruction: string;
  notes: string[];
  /** Texto completo, pronto para colar no prontuário ou receituário. */
  text: string;
}

/** "½", "1", "1 e ½" — frações de comprimido como se escreve em receita. */
export function formatUnits(n: number): string {
  const whole = Math.floor(n);
  const half = Math.abs(n - whole - 0.5) < 1e-9;
  if (!half) return fmt(n);
  return whole === 0 ? '½' : `${whole} e ½`;
}

export function formatAmount(adm: Administration): string {
  const { amount, unit } = adm;
  if (unit === 'comprimido' || unit === 'cápsula') {
    const plural = amount > 1 ? (unit === 'comprimido' ? 'comprimidos' : 'cápsulas') : unit;
    return `${formatUnits(amount)} ${plural}`;
  }
  if (unit === 'jatos') return `${fmt(amount)} ${amount === 1 ? 'jato' : 'jatos'}`;
  if (unit === 'gotas') return `${fmt(amount)} ${amount === 1 ? 'gota' : 'gotas'}`;
  return `${fmt(amount)} mL`;
}

function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Prescrição formatada a partir de um resultado de cálculo. Retorna null se bloqueado. */
export function buildPrescription(r: CalcResult): Prescription | null {
  if (r.blocked || !r.administration) return null;

  const route = ROUTES[r.presentation.form];
  const amount = formatAmount(r.administration);
  const schedule =
    r.regimen.intervalHours === null
      ? r.scheduleText === 'Dose única'
        ? 'em dose única'
        : lowerFirst(r.scheduleText)
      : lowerFirst(r.scheduleText);

  const parts = [`${route.verb} ${amount} (${fmt(r.deliveredDoseMg)} mg)`];
  if (route.via) parts.push(route.via);
  let instruction = `${parts.join(' ')}, ${schedule}`;
  if (r.regimen.prn) instruction += `, ${r.regimen.prn}`;
  instruction += '.';

  const notes: string[] = [];
  if (r.regimen.adminNote) notes.push(r.regimen.adminNote);
  if (r.regimen.durationLabel) notes.push(`Duração: ${r.regimen.durationLabel}.`);

  const item = `${r.drug.name} — ${r.presentation.label}`;
  const text = [route.header, item, instruction, ...notes].join('\n');
  return { header: route.header, item, instruction, notes, text };
}

/** Atalho: só o texto completo. */
export function prescriptionText(r: CalcResult): string | null {
  return buildPrescription(r)?.text ?? null;
}
