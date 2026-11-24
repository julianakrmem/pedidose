/**
 * Tipos do domínio clínico. Nada aqui conhece React ou a interface:
 * a mesma camada pode ser reaproveitada num app React Native, numa CLI ou numa API.
 */

export type PresentationForm =
  | 'gotas'
  | 'solucao' // solução / suspensão / xarope / elixir — dose em mL
  | 'comprimido'
  | 'capsula'
  | 'nebulizacao' // solução para nebulização, dosada em gotas
  | 'spray' // aerossol dosimetrado, dosado em jatos
  | 'injetavel';

export interface Presentation {
  id: string;
  label: string;
  form: PresentationForm;
  /** Concentração em mg/mL (formas líquidas). */
  mgPerMl?: number;
  /** Gotas por mL — varia por fabricante; o valor usado aparece no resultado. */
  dropsPerMl?: number;
  /** mg por unidade (comprimido, cápsula, jato). */
  mgPerUnit?: number;
  /** Menor fração administrável da unidade: 1 = inteiro, 0,5 = meio comprimido (sulcado). */
  divisibleBy?: number;
  /** Volume acima do qual a apresentação deixa de ser prática (mL). */
  maxPracticalVolumeMl?: number;
  minAgeMonths?: number;
  minWeightKg?: number;
  note?: string;
}

export interface Regimen {
  id: string;
  label: string;
  /** 'dose' = mg/kg por tomada; 'dia' = mg/kg/dia, dividido pelas tomadas. */
  basis: 'dose' | 'dia';
  /** Valor padrão de mg/kg. */
  mgPerKg: number;
  /** Faixa aceitável de mg/kg que o usuário pode escolher. */
  mgPerKgRange: [number, number];
  /** Intervalo entre tomadas em horas. null = dose única / esquema especial. */
  intervalHours: number | null;
  /** Texto de posologia quando o intervalo não é fixo (ex.: crise asmática). */
  scheduleLabel?: string;
  minDoseMg?: number;
  maxDoseMg?: number;
  maxDailyMg?: number;
  maxDailyMgPerKg?: number;
  durationLabel?: string;
  /** Condição de uso "se necessário", que entra na prescrição (ex.: "se dor ou febre"). */
  prn?: string;
  /** Instrução extra de administração para a prescrição (ex.: diluição). */
  adminNote?: string;
  /** Apresentações aceitas neste esquema (se omitido, todas). */
  presentationIds?: string[];
  note?: string;
}

export interface AgeRule {
  belowMonths: number;
  level: AlertLevel;
  /** true = bloqueia o cálculo (contraindicação). */
  blocks?: boolean;
  message: string;
}

export interface Drug {
  id: string;
  name: string;
  group: string;
  regimens: Regimen[];
  presentations: Presentation[];
  minAgeMonths?: number;
  minWeightKg?: number;
  ageRules?: AgeRule[];
  /** Alertas clínicos fixos, sempre exibidos. */
  warnings?: string[];
  references: string[];
}

export type AlertLevel = 'danger' | 'warning' | 'info';

export type AlertCode =
  | 'invalid-weight'
  | 'invalid-age'
  | 'neonate'
  | 'weight-unusual'
  | 'weight-age-mismatch'
  | 'age-contraindication'
  | 'age-caution'
  | 'age-unknown'
  | 'weight-below-min'
  | 'presentation-age'
  | 'presentation-weight'
  | 'presentation-unsuitable'
  | 'presentation-not-in-regimen'
  | 'dose-capped'
  | 'daily-capped'
  | 'daily-per-kg-capped'
  | 'dose-raised-to-min'
  | 'mgkg-out-of-range'
  | 'rounding'
  | 'volume-high'
  | 'drops-vary'
  | 'clinical';

export interface Alert {
  level: AlertLevel;
  code: AlertCode;
  message: string;
}

export interface CalcInput {
  weightKg: number;
  /** Idade em meses (opcional, mas recomendada). */
  ageMonths?: number;
  drugId: string;
  regimenId?: string;
  presentationId?: string;
  /** Sobrescreve o mg/kg padrão do esquema (dentro da faixa). */
  mgPerKg?: number;
}

export interface Administration {
  /** Quantidade a administrar por tomada, já arredondada. */
  amount: number;
  unit: 'mL' | 'gotas' | 'comprimido' | 'cápsula' | 'jatos';
  /** mL equivalentes (formas líquidas). */
  ml?: number;
  /** Dispositivo de medida recomendado (seringa, conta-gotas...). */
  device?: string;
}

export interface CalcResult {
  blocked: boolean;
  drug: Drug;
  regimen: Regimen;
  presentation: Presentation;
  mgPerKgUsed: number;
  dosesPerDay: number | null;
  /** Dose teórica por tomada após aplicar limites (antes do arredondamento da apresentação). */
  doseMg: number;
  /** Dose realmente entregue após arredondar para mL/gotas/comprimidos. */
  deliveredDoseMg: number;
  dailyDoseMg: number | null;
  administration: Administration | null;
  scheduleText: string;
  alerts: Alert[];
}
