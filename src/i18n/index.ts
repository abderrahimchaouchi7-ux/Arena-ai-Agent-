import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import fr from './fr';
import ar from './ar';
import type { LanguageId } from '@/lib/types';

export const SUPPORTED_LANGUAGES: LanguageId[] = ['ar', 'fr', 'en'];

export function isSupportedLanguage(value: unknown): value is LanguageId {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as string[]).includes(value);
}

export function dirFor(language: LanguageId): 'rtl' | 'ltr' {
  return language === 'ar' ? 'rtl' : 'ltr';
}

/** BCP-47 tags used for Intl formatting (dates, numbers, relative time). */
export const INTL_LOCALE: Record<LanguageId, string> = {
  // ar-EG gives Eastern Arabic numerals; ar-u-nu-latn keeps Latin digits, which
  // read better next to times and verse numbers in a mixed UI.
  ar: 'ar-u-nu-latn',
  fr: 'fr-FR',
  en: 'en-GB',
};

export function detectInitialLanguage(): LanguageId {
  if (typeof navigator === 'undefined') return 'en';
  const candidates = navigator.languages ?? [navigator.language];
  for (const candidate of candidates) {
    const base = candidate.slice(0, 2).toLowerCase();
    if (isSupportedLanguage(base)) return base;
  }
  return 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    ar: { translation: ar },
  },
  lng: 'en', // overwritten by the settings store on boot
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGUAGES,
  load: 'currentOnly',
  interpolation: {
    escapeValue: false, // React already escapes
  },
  returnNull: false,
});

export default i18n;
