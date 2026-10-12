import { describe, expect, it } from 'vitest';
import en from './en';
import fr from './fr';
import ar from './ar';
import i18n, { INTL_LOCALE, SUPPORTED_LANGUAGES, detectInitialLanguage, dirFor, isSupportedLanguage } from './index';

type Tree = { [key: string]: string | Tree };

/** Flattens a nested translation object into dotted keys. */
function flatten(node: Tree, prefix = '', out: string[] = []): string[] {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.push(path);
    else flatten(value as Tree, path, out);
  }
  return out;
}

/** Reads a dotted key out of a raw bundle. */
function lookup(bundle: Tree, path: string): string {
  let node: string | Tree = bundle;
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null) return '';
    node = (node as Tree)[part] ?? '';
  }
  return typeof node === 'string' ? node : '';
}

const enKeys = flatten(en as unknown as Tree).sort();
const frKeys = flatten(fr as unknown as Tree).sort();
const arKeys = flatten(ar as unknown as Tree).sort();

const BUNDLES: Record<'ar' | 'fr' | 'en', Tree> = {
  ar: ar as unknown as Tree,
  fr: fr as unknown as Tree,
  en: en as unknown as Tree,
};

describe('translation key parity', () => {
  it('has the same keys in French as in English', () => {
    expect(frKeys).toEqual(enKeys);
  });

  it('has the same keys in Arabic as in English', () => {
    expect(arKeys).toEqual(enKeys);
  });

  it('has no empty strings in any language', () => {
    for (const key of enKeys) {
      expect(lookup(en as unknown as Tree, key) ?? '').not.toBe('');
      expect(lookup(fr as unknown as Tree, key) ?? '').not.toBe('');
      expect(lookup(ar as unknown as Tree, key) ?? '').not.toBe('');
    }
  });

  it('keeps every interpolation placeholder identical across languages', () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort().join(',');

    for (const key of enKeys) {
      const enValue = String(lookup(en as unknown as Tree, key) ?? '');
      const expected = placeholders(enValue);
      if (!expected) continue;
      expect(placeholders(String(lookup(fr as unknown as Tree, key) ?? '')), `fr:${key}`).toBe(expected);
      expect(placeholders(String(lookup(ar as unknown as Tree, key) ?? '')), `ar:${key}`).toBe(expected);
    }
  });

  it('translates the primary navigation in all three languages', () => {
    for (const lng of SUPPORTED_LANGUAGES) {
      for (const key of [
        'nav.home', 'nav.prayerTimes', 'nav.adhan', 'nav.quran', 'nav.dua',
        'nav.adhkar', 'nav.hadith', 'nav.qibla', 'nav.settings',
      ]) {
        const value = lookup(BUNDLES[lng], key);
        expect(value.length, `${lng}:${key}`).toBeGreaterThan(1);
      }
    }
  });

  it('translates the five prayer names in all three languages', () => {
    for (const lng of SUPPORTED_LANGUAGES) {
      for (const prayer of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
        const value = lookup(BUNDLES[lng], `prayers.${prayer}`);
        expect(value.length, `${lng}:prayers.${prayer}`).toBeGreaterThan(1);
      }
    }
  });

  it('does not leave Arabic interface strings in Latin script', () => {
    const arabic = /[\u0600-\u06FF]/;
    for (const key of ['nav.home', 'nav.quran', 'nav.qibla', 'settings.title', 'prayers.fajr']) {
      expect(arabic.test(String(lookup(ar as unknown as Tree, key) ?? '')), key).toBe(true);
    }
  });

  it('does not leave French interface strings identical to English everywhere', () => {
    // Some words legitimately coincide ("Ramadan"), so sample navigation only.
    const differing = ['nav.home', 'nav.settings', 'nav.qibla', 'settings.appearance'].filter(
      (key) => lookup(fr as unknown as Tree, key) !== lookup(en as unknown as Tree, key),
    );
    expect(differing.length).toBeGreaterThanOrEqual(3);
  });
});

describe('language helpers', () => {
  it('validates supported languages', () => {
    expect(isSupportedLanguage('ar')).toBe(true);
    expect(isSupportedLanguage('fr')).toBe(true);
    expect(isSupportedLanguage('en')).toBe(true);
    expect(isSupportedLanguage('de')).toBe(false);
    expect(isSupportedLanguage(null)).toBe(false);
    expect(isSupportedLanguage(42)).toBe(false);
  });

  it('marks Arabic as RTL and the others as LTR', () => {
    expect(dirFor('ar')).toBe('rtl');
    expect(dirFor('fr')).toBe('ltr');
    expect(dirFor('en')).toBe('ltr');
  });

  it('maps every language to an Intl locale', () => {
    for (const lng of SUPPORTED_LANGUAGES) {
      expect(INTL_LOCALE[lng]).toBeTruthy();
      expect(() => new Intl.DateTimeFormat(INTL_LOCALE[lng])).not.toThrow();
    }
  });

  it('falls back to English when the browser language is unsupported', () => {
    const original = navigator.languages;
    Object.defineProperty(navigator, 'languages', { value: ['de-DE', 'ja-JP'], configurable: true });
    expect(detectInitialLanguage()).toBe('en');
    Object.defineProperty(navigator, 'languages', { value: original, configurable: true });
  });

  it('detects a supported browser language', () => {
    const original = navigator.languages;
    Object.defineProperty(navigator, 'languages', { value: ['fr-FR', 'en-GB'], configurable: true });
    expect(detectInitialLanguage()).toBe('fr');
    Object.defineProperty(navigator, 'languages', { value: ['ar-MA'], configurable: true });
    expect(detectInitialLanguage()).toBe('ar');
    Object.defineProperty(navigator, 'languages', { value: original, configurable: true });
  });
});

describe('i18n instance', () => {
  it('is initialised with all three resources', () => {
    expect(i18n.isInitialized).toBe(true);
    for (const lng of SUPPORTED_LANGUAGES) {
      expect(i18n.hasResourceBundle(lng, 'translation')).toBe(true);
    }
  });

  it('falls back to English for an unknown language', () => {
    // i18next normalises fallbackLng to an array.
    expect(i18n.options.fallbackLng).toEqual(['en']);
  });
});
