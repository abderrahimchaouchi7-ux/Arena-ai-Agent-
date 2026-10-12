/** Theme catalogue. The actual colours live in `src/index.css` under
 *  `[data-theme="..."][data-mode="..."]`; this file is the typed registry the
 *  UI reads to build the settings pickers. */

import type { LanguageId } from '@/lib/types';

export type { LanguageId };

export type ThemeId = 'classic' | 'dark' | 'minimal' | 'blue' | 'sand';
export type ModeId = 'light' | 'dark' | 'auto';
export type AccentId = 'gold' | 'emerald' | 'teal' | 'blue' | 'rose' | 'violet';

export interface ThemeMeta {
  id: ThemeId;
  /** i18n key for the display name. */
  nameKey: string;
  /** i18n key for the one-line description. */
  descKey: string;
  /** Swatch colours, light mode then dark mode. */
  swatch: [string, string];
  /** Theme C deliberately ships no geometric ornamentation. */
  ornamented: boolean;
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'classic',
    nameKey: 'themes.classic',
    descKey: 'themes.classicDesc',
    swatch: ['#0b3d33', '#b08d3c'],
    ornamented: true,
  },
  {
    id: 'dark',
    nameKey: 'themes.darkPremium',
    descKey: 'themes.darkPremiumDesc',
    swatch: ['#14171d', '#c4a45c'],
    ornamented: true,
  },
  {
    id: 'minimal',
    nameKey: 'themes.minimal',
    descKey: 'themes.minimalDesc',
    swatch: ['#fafafa', '#18181b'],
    ornamented: false,
  },
  {
    id: 'blue',
    nameKey: 'themes.blue',
    descKey: 'themes.blueDesc',
    swatch: ['#1a427a', '#5898e8'],
    ornamented: true,
  },
  {
    id: 'sand',
    nameKey: 'themes.sand',
    descKey: 'themes.sandDesc',
    swatch: ['#7a5230', '#cd9860'],
    ornamented: true,
  },
];

export const MODES: { id: ModeId; key: string }[] = [
  { id: 'light', key: 'settings.modeLight' },
  { id: 'dark', key: 'settings.modeDark' },
  { id: 'auto', key: 'settings.modeAuto' },
];

export const ACCENTS: { id: AccentId; key: string; color: string }[] = [
  { id: 'gold', key: 'accents.gold', color: '#ba913a' },
  { id: 'emerald', key: 'accents.emerald', color: '#109474' },
  { id: 'teal', key: 'accents.teal', color: '#0d9498' },
  { id: 'blue', key: 'accents.blue', color: '#2d74d0' },
  { id: 'rose', key: 'accents.rose', color: '#be4460' },
  { id: 'violet', key: 'accents.violet', color: '#7a58c4' },
];

export const LANGUAGES: {
  id: LanguageId;
  native: string;
  english: string;
  dir: 'rtl' | 'ltr';
}[] = [
  { id: 'ar', native: 'العربية', english: 'Arabic', dir: 'rtl' },
  { id: 'fr', native: 'Français', english: 'French', dir: 'ltr' },
  { id: 'en', native: 'English', english: 'English', dir: 'ltr' },
];

/** Writes the persisted theme onto <html> so CSS variables + dir take effect. */
export function applyThemeToDocument(opts: {
  theme: ThemeId;
  mode: ModeId;
  accent: AccentId;
  language: LanguageId;
  quranFontSize: number;
}): void {
  const root = document.documentElement;
  const resolvedMode: 'light' | 'dark' =
    opts.mode === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : opts.mode;

  // Brief transition class so theme switches feel smooth instead of snapping.
  document.body.classList.add('theme-transitioning');
  window.setTimeout(() => document.body.classList.remove('theme-transitioning'), 260);

  root.setAttribute('data-theme', opts.theme);
  root.setAttribute('data-accent', opts.accent);
  root.setAttribute('data-mode', resolvedMode);
  root.setAttribute('lang', opts.language);
  root.setAttribute('dir', opts.language === 'ar' ? 'rtl' : 'ltr');
  root.classList.toggle('dark', resolvedMode === 'dark');
  root.style.setProperty('--quran-font-size', `${opts.quranFontSize}px`);

  // Keep the browser UI (address bar, status bar) in sync with the theme.
  const bg = getComputedStyle(root).getPropertyValue('--c-bg').trim();
  const rgb = bg.split(/\s+/).join(',');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', `rgb(${rgb})`);
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}
