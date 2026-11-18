/**
 * ASAAS Console i18n — Arabic-first with a full English mode.
 *
 * `t()` is a plain function (no hook needed): it reads the active language
 * from module state. `LangRoot` in main.tsx subscribes via `useLang`, applies
 * `lang`/`dir` to <html>, and remounts the tree on switch so every `t()` call
 * re-evaluates. The dictionary lives in `i18n-en.ts` (Arabic source → English).
 */
import { useSyncExternalStore } from 'react';
import { EN } from './i18n-en';

export type Lang = 'ar' | 'en';

const STORAGE_KEY = 'asaas-lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ar') return saved;
  } catch { /* storage unavailable */ }
  return 'ar';
}

let current: Lang = initialLang();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function isRtl(): boolean {
  return current === 'ar';
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  listeners.forEach((fn) => fn());
}

export function toggleLang(): void {
  setLang(current === 'ar' ? 'en' : 'ar');
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Re-render hook — used once at the root. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, () => 'ar' as Lang);
}

/**
 * Translate an Arabic source string. Unknown strings pass through unchanged,
 * so pages keep working while the dictionary is being completed.
 */
export function t(source: string): string {
  if (current === 'ar') return source;
  return EN[source] ?? source;
}

// Apply the saved language before first paint (no flash of wrong direction).
if (typeof document !== 'undefined') {
  document.documentElement.lang = current;
  document.documentElement.dir = current === 'ar' ? 'rtl' : 'ltr';
}
