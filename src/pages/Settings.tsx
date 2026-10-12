import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Palette,
  Languages,
  Clock3,
  MapPin,
  Bell,
  BookOpen,
  HardDrive,
  ShieldCheck,
  Info,
  Trash2,
  RotateCcw,
  Check,
  AlertTriangle,
  RefreshCcw,
  Download,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  Button,
  Card,
  CardHeader,
  Field,
  Notice,
  PageHeader,
  ProgressBar,
  SegmentedControl,
  StatRow,
  Toggle,
} from '@/components/ui';
import { ACCENTS, LANGUAGES, MODES, THEMES, type AccentId, type ModeId, type ThemeId } from '@/theme/themes';
import { useSettings, DEFAULT_DASHBOARD_WIDGETS } from '@/state/settings';
import { useUserData } from '@/state/userData';
import {
  checkNativePermission,
  ensureNotificationChannel,
  getPermissionState,
  isNative,
  requestPermission,
  showNotification,
  type NotificationPermissionState,
} from '@/lib/notifications';
import { estimateStorage, formatBytes, mediaClear, mediaList } from '@/lib/db';
import { ALL_PRAYERS, type LanguageId, type NotificationStyle } from '@/lib/types';
import { CALCULATION_METHODS, HIGH_LATITUDE_RULES, currentTimeZone } from '@/lib/prayer';
import { QURAN_RECITERS } from '@/lib/audio';
import { useRegistration } from '@/lib/pwa';
import type { CalculationMethodId, HighLatitudeRuleId, MadhabId } from '@/lib/types';
import { dataSources, quranMeta, adhkarCategories, morningEveningItems, hadithCollections } from '@/lib/data';
import { TOTAL_VERSES } from '@/lib/data';

function AppearanceSection() {
  const { t } = useTranslation();
  const theme = useSettings((s) => s.theme);
  const mode = useSettings((s) => s.mode);
  const accent = useSettings((s) => s.accent);
  const reduceMotion = useSettings((s) => s.reduceMotion);
  const setTheme = useSettings((s) => s.setTheme);
  const setMode = useSettings((s) => s.setMode);
  const setAccent = useSettings((s) => s.setAccent);
  const setReduceMotion = useSettings((s) => s.setReduceMotion);

  return (
    <Card>
      <CardHeader icon={<Palette className="h-5 w-5" aria-hidden />} title={t('settings.appearance')} />

      <p className="label">{t('settings.theme')}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {THEMES.map((option) => {
          const active = option.id === theme;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setTheme(option.id as ThemeId)}
              aria-pressed={active}
              className={clsx(
                'flex items-center gap-3 rounded-xl border p-3 text-start transition-all duration-150 active:scale-[0.99]',
                active ? 'border-accent bg-accent/5' : 'border-border bg-surface-2 hover:border-accent/40',
              )}
            >
              <span className="flex shrink-0 gap-1" aria-hidden>
                {option.swatch.map((color) => (
                  <span
                    key={color}
                    className="h-8 w-4 rounded-full border border-border"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{t(option.nameKey)}</span>
                <span className="block text-xs text-muted">{t(option.descKey)}</span>
              </span>
              {active ? <Check className="ms-auto h-4 w-4 shrink-0 text-accent" aria-hidden /> : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <p className="label">{t('settings.mode')}</p>
        <SegmentedControl<ModeId>
          ariaLabel={t('settings.mode')}
          value={mode}
          onChange={setMode}
          options={MODES.map((m) => ({ value: m.id, label: t(m.key) }))}
        />
      </div>

      <div className="mt-4">
        <p className="label">{t('settings.accent')}</p>
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((option) => {
            const active = option.id === accent;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setAccent(option.id as AccentId)}
                aria-label={t(option.key)}
                aria-pressed={active}
                className={clsx(
                  'h-9 w-9 rounded-full border-2 transition-transform duration-150 active:scale-90',
                  active ? 'border-fg' : 'border-transparent',
                )}
                style={{ backgroundColor: option.color }}
              >
                {active ? <Check className="mx-auto h-4 w-4 text-white" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 border-t border-border">
        <Toggle
          id="reduce-motion"
          checked={reduceMotion}
          onChange={setReduceMotion}
          label={t('settings.reduceMotion')}
          description={t('settings.reduceMotionNote')}
        />
      </div>
    </Card>
  );
}

function LanguageSection() {
  const { t, i18n } = useTranslation();
  const language = useSettings((s) => s.language);
  const setLanguage = useSettings((s) => s.setLanguage);

  return (
    <Card>
      <CardHeader icon={<Languages className="h-5 w-5" aria-hidden />} title={t('settings.language')} subtitle={t('settings.languageNote')} />
      <div className="grid gap-2 sm:grid-cols-3">
        {LANGUAGES.map((option) => {
          const active = option.id === language;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setLanguage(option.id as LanguageId);
                void i18n.changeLanguage(option.id);
              }}
              aria-pressed={active}
              className={clsx(
                'flex flex-col items-center gap-1 rounded-xl border p-3 transition-all duration-150 active:scale-[0.99]',
                active ? 'border-accent bg-accent/5' : 'border-border bg-surface-2 hover:border-accent/40',
              )}
            >
              <span className="text-base font-bold" dir={option.dir} lang={option.id}>
                {option.native}
              </span>
              <span className="text-xs text-muted">{option.english}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted">{option.dir}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function PrayerSection() {
  const { t } = useTranslation();
  const method = useSettings((s) => s.method);
  const madhab = useSettings((s) => s.madhab);
  const highLatitudeRule = useSettings((s) => s.highLatitudeRule);
  const hijriOffset = useSettings((s) => s.hijriOffset);
  const hour12 = useSettings((s) => s.hour12);
  const location = useSettings((s) => s.location);
  const setMethod = useSettings((s) => s.setMethod);
  const setMadhab = useSettings((s) => s.setMadhab);
  const setHighLatitudeRule = useSettings((s) => s.setHighLatitudeRule);
  const setHijriOffset = useSettings((s) => s.setHijriOffset);
  const setHour12 = useSettings((s) => s.setHour12);

  return (
    <Card>
      <CardHeader icon={<Clock3 className="h-5 w-5" aria-hidden />} title={t('settings.prayer')} />

      <Field label={t('prayers.method')} htmlFor="method-select" hint={CALCULATION_METHODS.find((m) => m.id === method)?.convention}>
        <select
          id="method-select"
          className="field"
          value={method}
          onChange={(e) => setMethod(e.target.value as CalculationMethodId)}
        >
          {CALCULATION_METHODS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="mt-4">
        <p className="label">{t('prayers.asrMadhab')}</p>
        <SegmentedControl<MadhabId>
          ariaLabel={t('prayers.asrMadhab')}
          value={madhab}
          onChange={setMadhab}
          options={[
            { value: 'shafi', label: t('prayers.madhabShafi') },
            { value: 'hanafi', label: t('prayers.madhabHanafi') },
          ]}
        />
      </div>

      <div className="mt-4">
        <p className="label">{t('prayers.highLatitude')}</p>
        <SegmentedControl<HighLatitudeRuleId>
          ariaLabel={t('prayers.highLatitude')}
          size="sm"
          value={highLatitudeRule}
          onChange={setHighLatitudeRule}
          options={HIGH_LATITUDE_RULES.map((r) => ({ value: r.id, label: t(r.key) }))}
        />
      </div>

      <div className="mt-4">
        <p className="label">
          {t('settings.hijriOffset')}:{' '}
          <span className="tabular">
            {hijriOffset === 0
              ? '0'
              : t('settings.hijriOffsetValue', { count: Math.abs(hijriOffset) })}
          </span>
        </p>
        <input
          type="range"
          min={-2}
          max={2}
          step={1}
          value={hijriOffset}
          onChange={(e) => setHijriOffset(Number(e.target.value))}
          aria-label={t('settings.hijriOffset')}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-2 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
        />
        <p className="mt-1.5 text-xs text-muted">{t('settings.hijriOffsetNote')}</p>
      </div>

      <div className="mt-4">
        <p className="label">{t('settings.hour12')}</p>
        <SegmentedControl<'auto' | 'yes' | 'no'>
          ariaLabel={t('settings.hour12')}
          size="sm"
          value={hour12 === null ? 'auto' : hour12 ? 'yes' : 'no'}
          onChange={(v) => setHour12(v === 'auto' ? null : v === 'yes')}
          options={[
            { value: 'auto', label: t('settings.hour12Auto') },
            { value: 'yes', label: t('settings.hour12Yes') },
            { value: 'no', label: t('settings.hour12No') },
          ]}
        />
      </div>

      <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
        <StatRow label={t('prayers.location')} value={location.label} />
        <StatRow
          label={t('prayers.coordinates')}
          value={`${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
        />
        <StatRow label={t('prayers.timezone')} value={currentTimeZone() ?? '—'} />
      </div>
      <Link to="/prayer-times" className="btn-outline btn-sm mt-3">
        <MapPin className="h-4 w-4" aria-hidden />
        {t('settings.locationSection')}
      </Link>
    </Card>
  );
}

function NotificationsSection() {
  const { t } = useTranslation();
  const enabled = useSettings((s) => s.notificationsEnabled);
  const notifications = useSettings((s) => s.notifications);
  const setEnabled = useSettings((s) => s.setNotificationsEnabled);
  const setNotification = useSettings((s) => s.setNotification);
  const resetNotifications = useSettings((s) => s.resetNotifications);
  const preferredAdhanId = useSettings((s) => s.preferredAdhanId);
  const setPreferredAdhan = useSettings((s) => s.setPreferredAdhan);
  const volume = useSettings((s) => s.volume);
  const setVolume = useSettings((s) => s.setVolume);
  const autoPlayAdhan = useSettings((s) => s.autoPlayAdhan);
  const setAutoPlayAdhan = useSettings((s) => s.setAutoPlayAdhan);

  const [permission, setPermission] = useState<NotificationPermissionState>(getPermissionState());
  const [pending, setPending] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkNativePermission()
      .then((state) => {
        if (!cancelled) setPermission(state);
      })
      .catch(() => {
        if (!cancelled) setPermission('unsupported');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEnable = async () => {
    setPending(true);
    const state = await requestPermission();
    setPermission(state);
    setPending(false);
    if (state === 'granted') {
      setEnabled(true);
      await ensureNotificationChannel({
        name: t('notifications.channelName'),
        description: t('notifications.channelDescription'),
      });
    }
  };

  const handleTest = async () => {
    const ok = await showNotification({
      title: t('nav.prayerTimes'),
      body: t('notifications.testSent'),
      tag: 'test',
    });
    setTestSent(ok);
    window.setTimeout(() => setTestSent(false), 3000);
  };

  const styles: { value: NotificationStyle; key: string }[] = [
    { value: 'adhan', key: 'notifications.styleAdhan' },
    { value: 'tone', key: 'notifications.styleTone' },
    { value: 'silent', key: 'notifications.styleSilent' },
    { value: 'off', key: 'notifications.styleOff' },
  ];

  return (
    <Card>
      <CardHeader
        icon={<Bell className="h-5 w-5" aria-hidden />}
        title={t('notifications.title')}
        subtitle={enabled ? t('notifications.enabled') : t('notifications.subtitle')}
      />

      <div className="space-y-2">
        {permission === 'unsupported' ? (
          <Notice tone="warning">{t('notifications.unsupported')}</Notice>
        ) : null}
        {permission === 'denied' ? (
          <Notice tone="warning" title={t('notifications.denied')}>
            {t('notifications.deniedHowTo')}
          </Notice>
        ) : null}
        {permission === 'granted' ? (
          <Notice tone="success">
            {t('notifications.enabled')}
            {isNative() ? ` — ${t('notifications.androidNote')}` : ''}
          </Notice>
        ) : null}
        {permission === 'default' ? (
          <Button variant="primary" loading={pending} onClick={handleEnable}>
            {pending ? t('notifications.permissionPending') : t('notifications.enable')}
          </Button>
        ) : null}
      </div>

      <div className="mt-4 divide-y divide-border border-t border-border">
        {ALL_PRAYERS.map((prayer) => (
          <div key={prayer} className="py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{t(`prayers.${prayer}`)}</p>
            </div>
            <SegmentedControl<NotificationStyle>
              ariaLabel={`${t('notifications.title')} — ${t(`prayers.${prayer}`)}`}
              size="sm"
              value={notifications[prayer].style}
              onChange={(style) => setNotification(prayer, { style })}
              options={styles.map((s) => ({ value: s.value, label: t(s.key) }))}
            />
            {notifications[prayer].style !== 'off' ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted">
                  {t('notifications.reminder')}
                  <select
                    className="field w-auto py-1 text-xs"
                    value={notifications[prayer].reminderMinutes}
                    onChange={(e) =>
                      setNotification(prayer, { reminderMinutes: Number(e.target.value) })
                    }
                    aria-label={t('notifications.reminder')}
                  >
                    <option value={0}>{t('notifications.reminderNone')}</option>
                    {[5, 10, 15, 20, 30, 45, 60].map((m) => (
                      <option key={m} value={m}>
                        {t('notifications.reminderMinutes', { count: m })}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <Button variant="ghost" size="sm" className="mt-3" onClick={resetNotifications} icon={<RotateCcw className="h-4 w-4" aria-hidden />}>
        {t('common.clear')}
      </Button>

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <Field label={t('settings.preferredAdhan')} htmlFor="adhan-select">
          <select
            id="adhan-select"
            className="field"
            value={preferredAdhanId}
            onChange={(e) => setPreferredAdhan(e.target.value)}
          >
            <option value="__tone__">{t('adhan.toneTitle')}</option>
            <option value="__silent__">{t('adhan.silentTitle')}</option>
          </select>
        </Field>
        <Link to="/adhan" className="btn-outline btn-sm">
          {t('adhan.library')}
        </Link>

        <Field label={`${t('settings.volume')} — ${Math.round(volume * 100)}%`} htmlFor="volume">
          <input
            id="volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-2 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
          />
        </Field>

        <Toggle
          id="autoplay-adhan"
          checked={autoPlayAdhan}
          onChange={setAutoPlayAdhan}
          label={t('settings.autoPlayAdhan')}
        />

        <Button variant="outline" size="sm" onClick={handleTest} icon={<Bell className="h-4 w-4" aria-hidden />}>
          {testSent ? t('notifications.testSent') : t('notifications.testNotification')}
        </Button>
      </div>

      <Notice tone="warning" title={t('notifications.schedulingTitle')} icon={<AlertTriangle className="h-4 w-4 text-warning" aria-hidden />} className="mt-4">
        {t('notifications.schedulingBody')}
      </Notice>
    </Card>
  );
}

function QuranSection() {
  const { t } = useTranslation();
  const fontSize = useSettings((s) => s.quranFontSize);
  const translation = useSettings((s) => s.quranTranslation);
  const reciter = useSettings((s) => s.quranReciter);
  const setFontSize = useSettings((s) => s.setQuranFontSize);
  const setTranslation = useSettings((s) => s.setQuranTranslation);
  const setReciter = useSettings((s) => s.setQuranReciter);

  return (
    <Card>
      <CardHeader icon={<BookOpen className="h-5 w-5" aria-hidden />} title={t('settings.quran')} />

      <Field label={`${t('quran.fontSize')} — ${fontSize}px`} htmlFor="quran-font">
        <input
          id="quran-font"
          type="range"
          min={18}
          max={56}
          step={1}
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-2 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
        />
      </Field>
      <p
        className="quran-text mt-3 rounded-lg bg-surface-2 p-3"
        dir="rtl"
        lang="ar"
        aria-hidden
      >
        بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
      </p>

      <div className="mt-4">
        <p className="label">{t('quran.translationLabel')}</p>
        <SegmentedControl<'none' | 'en' | 'fr' | 'ar'>
          ariaLabel={t('quran.translationLabel')}
          size="sm"
          value={translation}
          onChange={setTranslation}
          options={[
            { value: 'none', label: t('common.none') },
            { value: 'en', label: 'English' },
            { value: 'fr', label: 'Français' },
            { value: 'ar', label: t('common.arabic') },
          ]}
        />
        {translation === 'ar' ? (
          <p className="mt-2 text-xs text-muted">{t('common.translationUnavailable')}</p>
        ) : null}
      </div>

      <Field className="mt-4" label={t('settings.defaultReciter')} htmlFor="reciter">
        <select
          id="reciter"
          className="field"
          value={reciter}
          onChange={(e) => setReciter(e.target.value)}
        >
          {QURAN_RECITERS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} — {r.bitrate}
            </option>
          ))}
        </select>
      </Field>

      <p className="mt-3 text-xs text-muted">{t('quran.attribution')}</p>
    </Card>
  );
}

function StorageSection() {
  const { t } = useTranslation();
  const [estimate, setEstimate] = useState<Awaited<ReturnType<typeof estimateStorage>> | null>(null);
  const [media, setMedia] = useState<Awaited<ReturnType<typeof mediaList>>>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const { registration, needsRefresh, updateServiceWorker } = useRegistration();

  const refresh = () => {
    // Both read IndexedDB / the Storage API, and both are unavailable in some
    // private-browsing modes. Surface "unavailable" rather than rejecting.
    estimateStorage()
      .then(setEstimate)
      .catch(() => setEstimate(null));
    mediaList()
      .then(setMedia)
      .catch(() => setMedia([]));
  };

  useEffect(refresh, []);

  const totalMedia = media.reduce((n, m) => n + m.bytes, 0);

  return (
    <Card>
      <CardHeader icon={<HardDrive className="h-5 w-5" aria-hidden />} title={t('settings.storage')} />

      <dl className="space-y-1 text-sm">
        <StatRow label={t('nav.quran')} value={`${quranMeta.chapters.length} · ${TOTAL_VERSES.toLocaleString()} ${t('common.verses')}`} />
        <StatRow label={t('nav.adhkar')} value={`${adhkarCategories.length} / ${morningEveningItems.length}`} />
        <StatRow label={t('nav.hadith')} value={hadithCollections.reduce((n, c) => n + c.offlineCount, 0).toLocaleString()} />
      </dl>

      {estimate ? (
        estimate.unavailable ? (
          <p className="mt-3 text-xs text-muted">{t('settings.storageUnavailable')}</p>
        ) : (
          <div className="mt-3">
            <ProgressBar
              value={estimate.usage}
              max={estimate.quota || 1}
              label={t('settings.storageUsage')}
            />
            <p className="mt-1 text-xs text-muted tabular">
              {formatBytes(estimate.usage)} {t('settings.storageQuota', { quota: formatBytes(estimate.quota) })}
            </p>
          </div>
        )
      ) : null}

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-sm font-semibold">{t('settings.downloadedMedia')}</p>
        {media.length === 0 ? (
          <p className="mt-1 text-xs text-muted">{t('settings.noDownloadedMedia')}</p>
        ) : (
          <>
            <ul className="mt-2 space-y-1">
              {media.map((m) => (
                <li key={m.key} className="flex justify-between gap-3 text-xs">
                  <span className="truncate">{m.title ?? m.key}</span>
                  <span className="shrink-0 text-muted tabular">{formatBytes(m.bytes)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs font-medium tabular">
              {t('settings.storageUsage')}: {formatBytes(totalMedia)}
            </p>
          </>
        )}

        {confirmClear ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted">{t('settings.clearMediaConfirm')}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="danger"
                onClick={async () => {
                  await mediaClear();
                  setConfirmClear(false);
                  refresh();
                }}
              >
                {t('common.confirm')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            disabled={media.length === 0}
            onClick={() => setConfirmClear(true)}
            icon={<Trash2 className="h-4 w-4" aria-hidden />}
          >
            {t('settings.clearMedia')}
          </Button>
        )}
      </div>

      <div className="mt-4 space-y-2 border-t border-border pt-4">
        <p className="text-sm font-semibold">{t('settings.offlineStatus')}</p>
        <p className="text-xs text-muted">
          {registration ? t('settings.appShellInstalled') : t('common.offlineNotice')}
        </p>
        {needsRefresh ? (
          <Button size="sm" variant="primary" onClick={() => void updateServiceWorker(true)} icon={<RefreshCcw className="h-4 w-4" aria-hidden />}>
            {t('settings.applyUpdate')}
          </Button>
        ) : (
          <span className="chip">
            <Download className="h-3.5 w-3.5" aria-hidden />
            {t('settings.updateReady')}
          </span>
        )}
      </div>
    </Card>
  );
}

function UserDataSection() {
  const { t } = useTranslation();
  const clearUserData = useUserData((s) => s.clearUserData);
  const bookmarks = useUserData((s) => s.bookmarks);
  const quranBookmarks = useUserData((s) => s.quranBookmarks);
  const history = useUserData((s) => s.history);
  const [confirming, setConfirming] = useState(false);

  return (
    <Card>
      <CardHeader icon={<ShieldCheck className="h-5 w-5" aria-hidden />} title={t('settings.userData')} subtitle={t('settings.userDataBody')} />
      <dl className="space-y-1 text-sm">
        <StatRow label={t('bookmarks.title')} value={bookmarks.length + quranBookmarks.length} />
        <StatRow label={t('search.recent')} value={history.length} />
      </dl>
      <Link to="/bookmarks" className="btn-outline btn-sm mt-3">
        {t('bookmarks.title')}
      </Link>

      <div className="mt-4 border-t border-border pt-4">
        {confirming ? (
          <div className="space-y-2">
            <p className="text-xs text-muted">{t('settings.clearUserDataConfirm')}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  clearUserData();
                  setConfirming(false);
                }}
              >
                {t('common.confirm')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} icon={<Trash2 className="h-4 w-4" aria-hidden />}>
            {t('settings.clearUserData')}
          </Button>
        )}
      </div>
    </Card>
  );
}

function DashboardSection() {
  const { t } = useTranslation();
  const widgets = useSettings((s) => s.dashboardWidgets);
  const toggleWidget = useSettings((s) => s.toggleDashboardWidget);

  return (
    <Card>
      <CardHeader title={t('dashboard.customise')} subtitle={t('dashboard.customiseHint')} />
      <div className="flex flex-wrap gap-2">
        {DEFAULT_DASHBOARD_WIDGETS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => toggleWidget(id)}
            aria-pressed={widgets.includes(id)}
            className={clsx('chip', widgets.includes(id) && 'chip-active')}
          >
            {t(`dashboard.widgets.${id}`)}
          </button>
        ))}
      </div>
    </Card>
  );
}

function AboutSection() {
  const { t } = useTranslation();
  const resetAll = useSettings((s) => s.resetAll);
  const [confirming, setConfirming] = useState(false);
  const sources = dataSources as unknown as {
    quran: { text: string; translations: Record<string, string> };
    adhkar: Record<string, number>;
    upstream: Record<string, string>;
  };

  const sourceList = useMemo(
    () =>
      Object.entries(sources.upstream ?? {}).map(([key, value]) => ({
        key,
        value,
      })),
    [sources],
  );

  return (
    <Card>
      <CardHeader icon={<Info className="h-5 w-5" aria-hidden />} title={t('settings.about')} />

      <dl className="space-y-1 text-sm">
        <StatRow label={t('settings.version')} value="1.0.0" />
      </dl>

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-sm font-semibold">{t('settings.privacy')}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">{t('settings.privacyBody')}</p>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-sm font-semibold">{t('settings.sources')}</p>
        <p className="mt-1 text-xs text-muted">{sources.quran?.text}</p>
        <ul className="mt-2 space-y-1 text-xs text-muted">
          <li>EN: {sources.quran?.translations?.en}</li>
          <li>FR: {sources.quran?.translations?.fr}</li>
          <li>{t('adhan.library')}: {t('adhan.licenceNote')}</li>
        </ul>
        <ul className="mt-3 space-y-1 text-[11px] text-muted">
          {sourceList.map((entry) => (
            <li key={entry.key} className="break-all" dir="ltr">
              {entry.value}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">{t('hadith.gradeDisclaimer')}</p>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        {confirming ? (
          <div className="space-y-2">
            <p className="text-xs text-muted">{t('settings.resetAllConfirm')}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  resetAll();
                  setConfirming(false);
                }}
              >
                {t('common.confirm')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} icon={<RotateCcw className="h-4 w-4" aria-hidden />}>
            {t('settings.resetAll')}
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <PageHeader title={t('settings.title')} />
      <AppearanceSection />
      <LanguageSection />
      <PrayerSection />
      <NotificationsSection />
      <QuranSection />
      <DashboardSection />
      <StorageSection />
      <UserDataSection />
      <AboutSection />
    </div>
  );
}
