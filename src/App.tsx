import { Suspense, lazy, useEffect, useMemo, useRef } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { GlobalAudioPlayer } from '@/components/GlobalAudioPlayer';
import { Spinner } from '@/components/ui';
import { useSettings, syncAppearance } from '@/state/settings';
import { useUserData, backupUserDataToIdb } from '@/state/userData';
import { useCountdown } from '@/hooks';
import i18n, { isSupportedLanguage, detectInitialLanguage } from '@/i18n';
import {
  buildSchedule,
  ensureNotificationChannel,
  getPermissionState,
  isNative,
  scheduleNative,
  showNotification,
  startWebScheduler,
  type ScheduledAlert,
} from '@/lib/notifications';
import { playNotificationTone, resolvePlayable } from '@/lib/audio';
import { useAudioPlayer } from '@/state/audioPlayer';
import { App as CapApp } from '@capacitor/app';

const Home = lazy(() => import('@/pages/Home'));
const PrayerTimesPage = lazy(() => import('@/pages/PrayerTimes'));
const AdhanLibraryPage = lazy(() => import('@/pages/AdhanLibrary'));
const QuranIndexPage = lazy(() => import('@/pages/QuranIndex'));
const QuranReaderPage = lazy(() => import('@/pages/QuranReader'));
const DuaPage = lazy(() => import('@/pages/Dua'));
const AdhkarPage = lazy(() => import('@/pages/Adhkar'));
const HadithPage = lazy(() => import('@/pages/Hadith'));
const QiblaPage = lazy(() => import('@/pages/Qibla'));
const SettingsPage = lazy(() => import('@/pages/Settings'));
const SearchPage = lazy(() => import('@/pages/Search'));
const BookmarksPage = lazy(() => import('@/pages/Bookmarks'));
const NotFoundPage = lazy(() => import('@/pages/NotFound'));

/** One-time boot: language, theme, appearance. */
function useBoot() {
  const language = useSettings((s) => s.language);
  const theme = useSettings((s) => s.theme);
  const mode = useSettings((s) => s.mode);
  const accent = useSettings((s) => s.accent);
  const quranFontSize = useSettings((s) => s.quranFontSize);

  useEffect(() => {
    const stored = isSupportedLanguage(language) ? language : detectInitialLanguage();
    if (stored !== language) useSettings.getState().setLanguage(stored);
    void i18n.changeLanguage(stored);
  }, [language]);

  useEffect(() => {
    syncAppearance();
  }, [theme, mode, accent, language, quranFontSize]);

  // Follow the OS when the user picked "auto".
  useEffect(() => {
    if (mode !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => syncAppearance();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);
}

/** Mirrors user data into IndexedDB whenever it changes. */
function useUserDataBackup() {
  const bookmarks = useUserData((s) => s.bookmarks);
  const quranBookmarks = useUserData((s) => s.quranBookmarks);
  const counters = useUserData((s) => s.counters);
  useEffect(() => {
    backupUserDataToIdb();
  }, [bookmarks, quranBookmarks, counters]);
}

/**
 * Schedules prayer alerts.
 *
 * Web: an in-page timer set, rebuilt whenever today's times or the settings
 * change. It survives a backgrounded tab but not a closed one — the Settings
 * page says this explicitly rather than over-promising.
 *
 * Android: real system notifications through @capacitor/local-notifications.
 */
function usePrayerScheduler() {
  const { t } = useTranslation();
  const { next, now } = useCountdown();
  const location = useSettings((s) => s.location);
  const method = useSettings((s) => s.method);
  const madhab = useSettings((s) => s.madhab);
  const highLatitudeRule = useSettings((s) => s.highLatitudeRule);
  const adjustments = useSettings((s) => s.adjustments);
  const enabled = useSettings((s) => s.notificationsEnabled);
  const notifications = useSettings((s) => s.notifications);
  const preferredAdhanId = useSettings((s) => s.preferredAdhanId);
  const volume = useSettings((s) => s.volume);
  const autoPlayAdhan = useSettings((s) => s.autoPlayAdhan);
  const setSource = useAudioPlayer((s) => s.setSource);

  const handleRef = useRef<{ stop: () => void } | null>(null);
  const nativeIdsRef = useRef<number[]>([]);
  // Re-arm only when the day or the config changes, not on every second tick.
  const dayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const configKey = JSON.stringify({ method, madhab, highLatitudeRule, adjustments, notifications, enabled });

  const textFor = useMemo(
    () => (alert: ScheduledAlert) => ({
      title: `${t('prayers.nextPrayer')}: ${t(`prayers.${alert.prayer}`)}`,
      body: alert.reminder
        ? t('notifications.reminderMinutes', { count: notifications[alert.prayer].reminderMinutes })
        : t('app.name'),
    }),
    [t, notifications],
  );

  useEffect(() => {
    if (!enabled || !next) return;
    if (getPermissionState() !== 'granted') return;

    let cancelled = false;
    void (async () => {
      // Import the calculation lazily so the scheduler effect stays cheap.
      const { computePrayerTimes } = await import('@/lib/prayer');
      if (cancelled) return;

      const settings = { method, madhab, highLatitudeRule, adjustments };
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
      const today = computePrayerTimes(location, todayDate, settings);
      const tomorrowDate = new Date(todayDate);
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrow = computePrayerTimes(location, tomorrowDate, settings);

      const alerts = buildSchedule([
        ...(['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((prayer) => ({
          prayer,
          time: today[prayer],
          style: notifications[prayer].style,
          reminderMinutes: notifications[prayer].reminderMinutes,
        })),
        {
          prayer: 'fajr' as const,
          time: tomorrow.fajr,
          style: notifications.fajr.style,
          reminderMinutes: notifications.fajr.reminderMinutes,
        },
      ]);

      if (isNative()) {
        await ensureNotificationChannel({
          name: t('notifications.channelName'),
          description: t('notifications.channelDescription'),
        });
        nativeIdsRef.current = await scheduleNative(alerts, textFor);
      } else {
        handleRef.current?.stop();
        handleRef.current = startWebScheduler(
          alerts,
          async (alert) => {
            const style = notifications[alert.prayer].style;
            await showNotification({
              ...textFor(alert),
              tag: `${alert.prayer}-${alert.reminder ? 'r' : 'p'}`,
              silent: style === 'silent',
            });
            if (style === 'adhan' && autoPlayAdhan && !alert.reminder) {
              const playable = await resolvePlayable(preferredAdhanId);
              if (playable.playable && playable.url) {
                setSource({
                  url: playable.url,
                  origin: 'adhan',
                  title: `${t('adhan.muezzin')}: ${t(`prayers.${alert.prayer}`)}`,
                });
              } else {
                await playNotificationTone(volume);
              }
            }
          },
          { volume },
        );
      }
    })();

    return () => {
      cancelled = true;
      handleRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey, configKey, next?.time.getTime(), location, enabled, t, textFor]);
}

/** Android hardware-back button should behave like the browser back button. */
function useAndroidBackButton() {
  useEffect(() => {
    if (!isNative()) return;
    let listener: { remove: () => void } | null = null;
    void CapApp.addListener('backButton', () => {
      window.history.length > 1 ? window.history.back() : void CapApp.exitApp();
    }).then((handle) => {
      listener = handle;
    });
    return () => listener?.remove();
  }, []);
}

export default function App() {
  useBoot();
  useUserDataBackup();
  usePrayerScheduler();
  useAndroidBackButton();

  return (
    <HashRouter>
      <Layout>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/prayer-times" element={<PrayerTimesPage />} />
            <Route path="/adhan" element={<AdhanLibraryPage />} />
            <Route path="/quran" element={<QuranIndexPage />} />
            <Route path="/quran/:surahId" element={<QuranReaderPage />} />
            <Route path="/dua" element={<DuaPage />} />
            <Route path="/adhkar" element={<AdhkarPage />} />
            <Route path="/adhkar/:groupId" element={<AdhkarPage />} />
            <Route path="/hadith" element={<HadithPage />} />
            <Route path="/hadith/:collectionId" element={<HadithPage />} />
            <Route path="/qibla" element={<QiblaPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/bookmarks" element={<BookmarksPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </Suspense>
      </Layout>
      <GlobalAudioPlayer />
    </HashRouter>
  );
}
