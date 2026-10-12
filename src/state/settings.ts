/**
 * Settings store.
 *
 * Everything the user personalises lives here and is persisted to localStorage
 * under `nur-settings`. The same key is read by the inline script in
 * `index.html` so the theme, mode, direction and language are correct before
 * React mounts (no flash, no LTR-then-RTL jump).
 *
 * Religious source content is *never* stored here — see `src/data`.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  CalculationMethodId,
  GeoLocation,
  HighLatitudeRuleId,
  LanguageId,
  LocationStatus,
  MadhabId,
  NotificationStyle,
  PrayerKey,
  PrayerNotificationConfig,
} from '@/lib/types';
import type { AccentId, ModeId, ThemeId } from '@/theme/themes';
import { ALL_PRAYERS, OBLIGATORY_PRAYERS } from '@/lib/types';
import { DEFAULT_PRAYER_SETTINGS } from '@/lib/prayer';
import { applyThemeToDocument } from '@/theme/themes';

export const SETTINGS_STORAGE_KEY = 'nur-settings';

/** Makkah is the default so the app is useful before any permission is given. */
export const DEFAULT_LOCATION: GeoLocation = {
  latitude: 21.4224779,
  longitude: 39.8251832,
  label: 'Makkah, Saudi Arabia',
  country: 'SA',
  timezone: 'Asia/Riyadh',
  automatic: false,
  updatedAt: 0,
};

export const DEFAULT_NOTIFICATIONS: Record<PrayerKey, PrayerNotificationConfig> = {
  fajr: { style: 'adhan', reminderMinutes: 15, bypassSilent: false },
  sunrise: { style: 'off', reminderMinutes: 0, bypassSilent: false },
  dhuhr: { style: 'tone', reminderMinutes: 10, bypassSilent: false },
  asr: { style: 'tone', reminderMinutes: 10, bypassSilent: false },
  maghrib: { style: 'tone', reminderMinutes: 5, bypassSilent: false },
  isha: { style: 'tone', reminderMinutes: 10, bypassSilent: false },
};

export type QuranTranslationId = 'none' | 'ar' | 'en' | 'fr';

export interface SettingsState {
  /* appearance */
  theme: ThemeId;
  mode: ModeId;
  accent: AccentId;
  language: LanguageId;
  reduceMotion: boolean;

  /* location + prayer maths */
  location: GeoLocation;
  locationStatus: LocationStatus;
  method: CalculationMethodId;
  madhab: MadhabId;
  highLatitudeRule: HighLatitudeRuleId;
  adjustments: Record<PrayerKey, number>;
  hijriOffset: number;
  hour12: boolean | null; // null = follow locale

  /* notifications + audio */
  notificationsEnabled: boolean;
  notifications: Record<PrayerKey, PrayerNotificationConfig>;
  preferredAdhanId: string;
  volume: number;
  autoPlayAdhan: boolean;

  /* Quran reading */
  quranFontSize: number;
  quranTranslation: QuranTranslationId;
  quranReciter: string;
  quranShowTransliteration: boolean;
  lastRead: { surah: number; ayah: number } | null;

  /* dashboard */
  dashboardWidgets: string[];

  /* actions */
  setTheme: (theme: ThemeId) => void;
  setMode: (mode: ModeId) => void;
  setAccent: (accent: AccentId) => void;
  setLanguage: (language: LanguageId) => void;
  setReduceMotion: (on: boolean) => void;
  setLocation: (location: GeoLocation) => void;
  setLocationStatus: (status: LocationStatus) => void;
  setMethod: (method: CalculationMethodId) => void;
  setMadhab: (madhab: MadhabId) => void;
  setHighLatitudeRule: (rule: HighLatitudeRuleId) => void;
  setAdjustment: (prayer: PrayerKey, minutes: number) => void;
  resetAdjustments: () => void;
  setHijriOffset: (offset: number) => void;
  setHour12: (v: boolean | null) => void;
  setNotificationsEnabled: (on: boolean) => void;
  setNotification: (prayer: PrayerKey, patch: Partial<PrayerNotificationConfig>) => void;
  resetNotifications: () => void;
  setPreferredAdhan: (id: string) => void;
  setVolume: (v: number) => void;
  setAutoPlayAdhan: (v: boolean) => void;
  setQuranFontSize: (size: number) => void;
  setQuranTranslation: (id: QuranTranslationId) => void;
  setQuranReciter: (id: string) => void;
  setQuranShowTransliteration: (v: boolean) => void;
  setLastRead: (surah: number, ayah: number) => void;
  toggleDashboardWidget: (id: string) => void;
  resetAll: () => void;
}

export const DEFAULT_DASHBOARD_WIDGETS = [
  'nextPrayer',
  'hijriDate',
  'dailyVerse',
  'qibla',
  'resumeReading',
  'dailyDua',
];

const zeroAdjustments = (): Record<PrayerKey, number> => ({
  ...DEFAULT_PRAYER_SETTINGS.adjustments,
});

const cloneDefaults = () => ({
  notifications: {
    ...Object.fromEntries(
      ALL_PRAYERS.map((p) => [p, { ...DEFAULT_NOTIFICATIONS[p] }]),
    ),
  } as Record<PrayerKey, PrayerNotificationConfig>,
});

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'classic',
      mode: 'light',
      accent: 'gold',
      language: 'en',
      reduceMotion: false,

      location: DEFAULT_LOCATION,
      locationStatus: { state: 'idle' },
      method: 'MuslimWorldLeague',
      madhab: 'shafi',
      highLatitudeRule: 'middleofthenight',
      adjustments: zeroAdjustments(),
      hijriOffset: 0,
      hour12: null,

      notificationsEnabled: false,
      ...cloneDefaults(),
      preferredAdhanId: 'makkah-haram',
      volume: 0.9,
      autoPlayAdhan: false,

      quranFontSize: 30,
      quranTranslation: 'none',
      quranReciter: 'ar.alafasy',
      quranShowTransliteration: false,
      lastRead: null,

      dashboardWidgets: [...DEFAULT_DASHBOARD_WIDGETS],

      setTheme: (theme) => set({ theme }),
      setMode: (mode) => set({ mode }),
      setAccent: (accent) => set({ accent }),
      setLanguage: (language) => set({ language }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),

      setLocation: (location) =>
        set({ location: { ...location, updatedAt: Date.now() }, locationStatus: { state: 'granted' } }),
      setLocationStatus: (locationStatus) => set({ locationStatus }),

      setMethod: (method) => set({ method }),
      setMadhab: (madhab) => set({ madhab }),
      setHighLatitudeRule: (highLatitudeRule) => set({ highLatitudeRule }),
      setAdjustment: (prayer, minutes) =>
        set((s) => ({
          adjustments: { ...s.adjustments, [prayer]: Math.max(-60, Math.min(60, minutes)) },
        })),
      resetAdjustments: () => set({ adjustments: zeroAdjustments() }),
      setHijriOffset: (hijriOffset) => set({ hijriOffset: Math.max(-2, Math.min(2, hijriOffset)) }),
      setHour12: (hour12) => set({ hour12 }),

      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      setNotification: (prayer, patch) =>
        set((s) => ({
          notifications: {
            ...s.notifications,
            [prayer]: { ...s.notifications[prayer], ...patch },
          },
        })),
      resetNotifications: () => set(cloneDefaults()),

      setPreferredAdhan: (preferredAdhanId) => set({ preferredAdhanId }),
      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),
      setAutoPlayAdhan: (autoPlayAdhan) => set({ autoPlayAdhan }),

      setQuranFontSize: (quranFontSize) =>
        set({ quranFontSize: Math.min(56, Math.max(18, quranFontSize)) }),
      setQuranTranslation: (quranTranslation) => set({ quranTranslation }),
      setQuranReciter: (quranReciter) => set({ quranReciter }),
      setQuranShowTransliteration: (quranShowTransliteration) => set({ quranShowTransliteration }),
      setLastRead: (surah, ayah) => set({ lastRead: { surah, ayah } }),

      toggleDashboardWidget: (id) =>
        set((s) => ({
          dashboardWidgets: s.dashboardWidgets.includes(id)
            ? s.dashboardWidgets.filter((w) => w !== id)
            : [...s.dashboardWidgets, id],
        })),

      resetAll: () => {
        const s = get();
        set({
          theme: 'classic',
          mode: 'light',
          accent: 'gold',
          language: s.language,
          reduceMotion: false,
          location: DEFAULT_LOCATION,
          locationStatus: { state: 'idle' },
          method: 'MuslimWorldLeague',
          madhab: 'shafi',
          highLatitudeRule: 'middleofthenight',
          adjustments: zeroAdjustments(),
          hijriOffset: 0,
          hour12: null,
          notificationsEnabled: false,
          ...cloneDefaults(),
          preferredAdhanId: 'makkah-haram',
          volume: 0.9,
          autoPlayAdhan: false,
          quranFontSize: 30,
          quranTranslation: 'none',
          quranReciter: 'ar.alafasy',
          quranShowTransliteration: false,
          lastRead: null,
          dashboardWidgets: [...DEFAULT_DASHBOARD_WIDGETS],
        });
      },
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Only persist real preferences — runtime status must not be stored.
      partialize: (s) => {
        const { locationStatus: _ls, ...rest } = s;
        const { ...actions } = rest as Record<string, unknown>;
        for (const key of Object.keys(actions)) {
          if (typeof actions[key] === 'function') delete actions[key];
        }
        return actions as never;
      },
    },
  ),
);

/** Push the persisted appearance settings onto <html>. Call on boot + on change. */
export function syncAppearance(): void {
  const s = useSettings.getState();
  applyThemeToDocument({
    theme: s.theme,
    mode: s.mode,
    accent: s.accent,
    language: s.language,
    quranFontSize: s.quranFontSize,
  });
  document.documentElement.style.setProperty(
    'scroll-behavior',
    s.reduceMotion ? 'auto' : 'smooth',
  );
}

export function prayerSettingsFrom(s: SettingsState) {
  return {
    method: s.method,
    madhab: s.madhab,
    highLatitudeRule: s.highLatitudeRule,
    adjustments: s.adjustments,
  };
}

export { OBLIGATORY_PRAYERS, ALL_PRAYERS };
export type { NotificationStyle };
