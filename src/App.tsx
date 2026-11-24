import { useMemo, useState, type ReactNode } from 'react';
import { DRUGS } from './data/drugs';
import { allowedPresentations, calculate, fmt } from './domain/calculate';
import { prescriptionText } from './domain/prescription';
import type { Alert, CalcResult } from './domain/types';

const parseNumber = (raw: string) => (raw.trim() === '' ? undefined : Number(raw.replace(',', '.')));

export default function App() {
  const [weightRaw, setWeightRaw] = useState('');
  const [ageRaw, setAgeRaw] = useState('');
  const [ageUnit, setAgeUnit] = useState<'meses' | 'anos'>('anos');
  const [drugId, setDrugId] = useState(DRUGS[0].id);
  const [regimenId, setRegimenId] = useState(DRUGS[0].regimens[0].id);
  const [presentationId, setPresentationId] = useState(DRUGS[0].presentations[0].id);
  const [mgPerKg, setMgPerKg] = useState<number | undefined>();

  const drug = DRUGS.find((d) => d.id === drugId)!;
  const regimen = drug.regimens.find((r) => r.id === regimenId) ?? drug.regimens[0];
  const presentations = allowedPresentations(drug, regimen);

  const weightKg = parseNumber(weightRaw);
  const ageValue = parseNumber(ageRaw);
  const ageMonths = ageValue === undefined ? undefined : ageUnit === 'anos' ? ageValue * 12 : ageValue;

  const result = useMemo<CalcResult | null>(() => {
    if (weightKg === undefined) return null;
    return calculate({ weightKg, ageMonths, drugId, regimenId, presentationId, mgPerKg });
  }, [weightKg, ageMonths, drugId, regimenId, presentationId, mgPerKg]);

  function selectDrug(id: string) {
    const d = DRUGS.find((x) => x.id === id)!;
    setDrugId(id);
    setRegimenId(d.regimens[0].id);
    setPresentationId(allowedPresentations(d, d.regimens[0])[0].id);
    setMgPerKg(undefined);
  }

  function selectRegimen(id: string) {
    const r = drug.regimens.find((x) => x.id === id)!;
    setRegimenId(id);
    const allowed = allowedPresentations(drug, r);
    if (!allowed.some((p) => p.id === presentationId)) setPresentationId(allowed[0].id);
    setMgPerKg(undefined);
  }

  const [minKg, maxKg] = regimen.mgPerKgRange;
  const showSlider = minKg !== maxKg;
  const sliderStep = maxKg - minKg <= 1 ? 0.01 : 1;
  const unitLabel = regimen.basis === 'dose' ? 'mg/kg/dose' : 'mg/kg/dia';

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="border-b border-line bg-paper/90 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Logo />
          <div className="leading-tight">
            <h1 className="font-semibold tracking-tight">PediDose</h1>
            <p className="text-xs text-muted">Cálculo de doses pediátricas por peso</p>
          </div>
          <span className="ml-auto shrink-0 whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
            Uso educacional
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 md:grid-cols-[1fr_minmax(0,26rem)]">
        <div className="space-y-6">
          <Section step={1} title="Paciente">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="label">Peso</span>
                <div className="field">
                  <input
                    inputMode="decimal"
                    placeholder="0,0"
                    value={weightRaw}
                    onChange={(e) => setWeightRaw(e.target.value)}
                    className="w-full bg-transparent text-2xl font-semibold tabular-nums outline-none placeholder:text-line"
                    aria-label="Peso em quilogramas"
                    autoFocus
                  />
                  <span className="text-sm text-muted">kg</span>
                </div>
              </label>
              <label className="block">
                <span className="label">
                  Idade <span className="font-normal text-muted">(recomendado)</span>
                </span>
                <div className="field">
                  <input
                    inputMode="decimal"
                    placeholder="—"
                    value={ageRaw}
                    onChange={(e) => setAgeRaw(e.target.value)}
                    className="w-full min-w-0 bg-transparent text-2xl font-semibold tabular-nums outline-none placeholder:text-line"
                    aria-label="Idade"
                  />
                  <div className="flex shrink-0 rounded-lg bg-paper p-0.5 text-xs">
                    {(['meses', 'anos'] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setAgeUnit(u)}
                        className={`rounded-md px-2 py-1 ${ageUnit === u ? 'bg-ink text-white' : 'text-muted'}`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </label>
            </div>
          </Section>

          <Section step={2} title="Medicamento">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DRUGS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => selectDrug(d.id)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${
                    d.id === drugId
                      ? 'border-teal bg-teal text-white shadow-sm'
                      : 'border-line bg-white hover:border-teal/50'
                  }`}
                >
                  <span className="block text-sm font-medium leading-snug">{d.name}</span>
                  <span className={`block text-[11px] ${d.id === drugId ? 'text-white/75' : 'text-muted'}`}>
                    {d.group}
                  </span>
                </button>
              ))}
            </div>
          </Section>

          <Section step={3} title="Esquema e apresentação">
            {drug.regimens.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {drug.regimens.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => selectRegimen(r.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      r.id === regimen.id ? 'border-ink bg-ink text-white' : 'border-line bg-white'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}

            <fieldset className="space-y-2">
              <legend className="label">Apresentação</legend>
              {presentations.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 ${
                    p.id === presentationId ? 'border-teal bg-teal-50' : 'border-line bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="presentation"
                    checked={p.id === presentationId}
                    onChange={() => setPresentationId(p.id)}
                    className="accent-teal"
                  />
                  <span className="text-sm">{p.label}</span>
                  {p.dropsPerMl && <span className="ml-auto text-xs text-muted">{p.dropsPerMl} gotas/mL</span>}
                </label>
              ))}
            </fieldset>

            {showSlider && (
              <div className="mt-4">
                <div className="flex items-baseline justify-between">
                  <span className="label">Dose escolhida</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {fmt(mgPerKg ?? regimen.mgPerKg, 3)} {unitLabel}
                  </span>
                </div>
                <input
                  type="range"
                  min={minKg}
                  max={maxKg}
                  step={sliderStep}
                  value={mgPerKg ?? regimen.mgPerKg}
                  onChange={(e) => setMgPerKg(Number(e.target.value))}
                  className="w-full accent-teal"
                  aria-label="mg por kg"
                />
                <div className="flex justify-between text-xs text-muted tabular-nums">
                  <span>{fmt(minKg, 3)}</span>
                  <span>faixa do esquema</span>
                  <span>{fmt(maxKg, 3)}</span>
                </div>
              </div>
            )}
          </Section>
        </div>

        <aside className="md:sticky md:top-20 md:self-start">
          <ResultCard result={result} unitLabel={unitLabel} />
        </aside>
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs leading-relaxed text-muted">
        Ferramenta de estudo e apoio. Não substitui o julgamento clínico. Confira sempre a bula vigente e o
        protocolo da sua instituição antes de prescrever. Gotas/mL e concentrações variam entre fabricantes.
      </footer>
    </div>
  );
}

function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white/60 p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="grid size-5 place-items-center rounded-full bg-ink text-[11px] text-white">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function ResultCard({ result, unitLabel }: { result: CalcResult | null; unitLabel: string }) {
  const [copied, setCopied] = useState(false);

  if (!result) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
        Informe o peso para calcular.
      </div>
    );
  }

  const rx = prescriptionText(result);
  const { administration: adm } = result;

  async function copy() {
    if (!rx) return;
    try {
      await navigator.clipboard.writeText(rx);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponível */
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-ink/80 bg-white shadow-[0_1px_0_#1c2421,0_12px_32px_-16px_rgba(28,36,33,.35)]">
      <div className="flex items-center justify-between border-b border-dashed border-line px-5 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Resultado</span>
        <span className="text-xs text-muted">{result.drug.name}</span>
      </div>

      {result.blocked || !adm ? (
        <div className="px-5 py-6">
          <p className="text-lg font-semibold text-danger">Cálculo bloqueado</p>
          <p className="text-sm text-muted">Veja os alertas abaixo.</p>
        </div>
      ) : (
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold tracking-tight tabular-nums">{fmt(adm.amount)}</span>
            <span className="text-xl font-medium">{adm.unit}</span>
          </div>
          <p className="mt-1 text-base font-medium text-teal">{result.scheduleText}</p>
          {adm.unit === 'gotas' && adm.ml !== undefined && (
            <p className="text-xs text-muted">≈ {fmt(adm.ml)} mL</p>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
            <Stat label="Dose por tomada" value={`${fmt(result.deliveredDoseMg)} mg`} />
            <Stat
              label="Total diário"
              value={result.dailyDoseMg !== null ? `${fmt(result.dailyDoseMg)} mg` : '—'}
            />
            <Stat label="Base de cálculo" value={`${fmt(result.mgPerKgUsed, 3)} ${unitLabel}`} />
            <Stat label="Duração" value={result.regimen.durationLabel ?? '—'} />
          </dl>

          {rx && (
            <button
              type="button"
              onClick={copy}
              className="mt-4 w-full rounded-xl bg-paper px-3 py-2.5 text-left text-[13px] leading-snug hover:bg-line/50"
            >
              <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                {copied ? 'Copiado ✓' : 'Rascunho de prescrição · toque para copiar'}
              </span>
              {rx}
            </button>
          )}
        </div>
      )}

      {result.alerts.length > 0 && (
        <ul className="space-y-1.5 px-5 pb-4">
          {result.alerts.map((a, i) => (
            <AlertItem key={i} alert={a} />
          ))}
        </ul>
      )}

      <div className="border-t border-dashed border-line bg-paper/60 px-5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Referências</p>
        <ul className="mt-1 text-xs leading-relaxed text-ink/80">
          {result.drug.references.map((ref) => (
            <li key={ref}>• {ref}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

const ALERT_STYLE: Record<Alert['level'], string> = {
  danger: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-slate-200 bg-slate-50 text-slate-700',
};
const ALERT_ICON: Record<Alert['level'], string> = { danger: '⛔', warning: '⚠️', info: 'ℹ️' };

function AlertItem({ alert }: { alert: Alert }) {
  return (
    <li className={`flex gap-2 rounded-lg border px-3 py-2 text-[13px] leading-snug ${ALERT_STYLE[alert.level]}`}>
      <span aria-hidden>{ALERT_ICON[alert.level]}</span>
      <span>{alert.message}</span>
    </li>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#0f5e57" />
      <path d="M16 6c4 5.2 6.5 8.6 6.5 12a6.5 6.5 0 0 1-13 0C9.5 14.6 12 11.2 16 6Z" fill="#fff" />
      <path d="M16 15v7M12.5 18.5h7" stroke="#0f5e57" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
