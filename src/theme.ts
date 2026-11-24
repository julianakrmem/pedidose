import { useEffect, useState } from 'react';

export type ThemeChoice = 'auto' | 'light' | 'dark' | 'contrast';
type Resolved = Exclude<ThemeChoice, 'auto'>;

export const THEME_ORDER: ThemeChoice[] = ['auto', 'light', 'dark', 'contrast'];
export const THEME_LABEL: Record<ThemeChoice, string> = {
  auto: 'Automático',
  light: 'Claro',
  dark: 'Escuro',
  contrast: 'Alto contraste',
};

const KEY = 'pedidose-theme';

function readStored(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return THEME_ORDER.includes(v as ThemeChoice) ? (v as ThemeChoice) : 'auto';
  } catch {
    return 'auto';
  }
}

function systemTheme(): Resolved {
  const host = document.documentElement.dataset.theme; // definido por alguns visualizadores
  if (host === 'dark' || host === 'light') return host;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Tema escolhido pelo usuário, salvo no navegador; "auto" segue o sistema. */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(readStored);

  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.mode = choice === 'auto' ? systemTheme() : choice;
    };
    apply();
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      /* armazenamento indisponível */
    }
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener('change', apply);
    return () => mq?.removeEventListener('change', apply);
  }, [choice]);

  const cycle = () => setChoice((c) => THEME_ORDER[(THEME_ORDER.indexOf(c) + 1) % THEME_ORDER.length]);
  return { choice, cycle };
}
