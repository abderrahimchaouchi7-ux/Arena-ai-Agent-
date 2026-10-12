import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Compass,
  HandHeart,
  CalendarDays,
  BookOpen,
  ScrollText,
  Repeat,
  Settings2,
  ArrowRight,
  MapPin,
} from 'lucide-react';
import { Card, CardHeader, Notice, Button, ProgressBar } from '@/components/ui';
import { ArabicText } from '@/components/content';
import { useCountdown } from '@/hooks';
import { useSettings } from '@/state/settings';
import { formatCountdown, formatTime } from '@/lib/prayer';
import { formatHijri, specialDay } from '@/lib/hijri';
import {
  DAILY_VERSE_POOL,
  adhkarCategories,
  chapterVerses,
  daySeed,
  getChapter,
  morningEveningItems,
  pickDaily,
  quranMeta,
} from '@/lib/data';
import { KAABA, compassPoint, distanceKm, qiblaBearing } from '@/lib/qibla';
import type { LanguageId } from '@/lib/types';

function NextPrayerCard() {
  const { t, i18n } = useTranslation();
  const language = i18n.language as LanguageId;
  const hour12 = useSettings((s) => s.hour12);
  const { next, error } = useCountdown();
  const location = useSettings((s) => s.location);

  if (error || !next) {
    return (
      <Card>
        <Notice tone="warning" title={t('common.error')}>
          {error ?? t('common.errorGeneric')}
        </Notice>
      </Card>
    );
  }

  const isAr = language === 'ar';
  const BackIcon = isAr ? ChevronRight : ChevronLeft;
  const ForwardIcon = isAr ? ChevronLeft : ChevronRight;

  return (
    <Card ornament className="relative overflow-hidden">
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t('prayers.nextPrayer')}
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {t(`prayers.${next.key}`)}
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <Clock3 className="h-4 w-4" aria-hidden />
              <span className="tabular">{formatTime(next.time, language, hour12 ?? undefined)}</span>
              {next.isTomorrow ? <span>· {t('common.tomorrow')}</span> : null}
            </p>
          </div>
          <div className="text-end">
            <p
              className="text-3xl font-bold tabular text-accent sm:text-4xl"
              aria-live="polite"
              aria-atomic="true"
            >
              {formatCountdown(next.msUntil)}
            </p>
            <p className="text-xs text-muted">{t('prayers.timeRemaining')}</p>
          </div>
        </div>

        <ProgressBar
          className="mt-4"
          value={next.progress * 100}
          label={
            next.previousKey
              ? `${t(`prayers.${next.previousKey}`)} → ${t(`prayers.${next.key}`)}`
              : undefined
          }
        />

        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{location.label}</span>
          </p>
          <Link to="/prayer-times" className="btn-ghost btn-sm shrink-0">
            {t('prayers.todaySchedule')}
            {isAr ? <BackIcon className="h-4 w-4" aria-hidden /> : <ForwardIcon className="h-4 w-4" aria-hidden />}
          </Link>
        </div>
      </div>
    </Card>
  );
}

function HijriCard() {
  const { t, i18n } = useTranslation();
  const language = i18n.language as LanguageId;
  const offset = useSettings((s) => s.hijriOffset);
  const today = useMemo(() => new Date(), []);
  const hijri = formatHijri(today, language, offset);
  const special = specialDay(hijri);

  return (
    <Card>
      <CardHeader icon={<CalendarDays className="h-5 w-5" aria-hidden />} title={t('dashboard.hijriDate')} />
      <p className="text-xl font-bold" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        {hijri.formatted}
      </p>
      {hijri.adjusted ? (
        <p className="mt-1 text-xs text-muted">{t('dashboard.hijriAdjusted')}</p>
      ) : null}
      {special ? (
        <p className="mt-2 inline-flex rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">
          {t(`dashboard.specialDays.${special}`)}
        </p>
      ) : null}
      <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted">
        {t('dashboard.hijriDisclaimer')}
      </p>
    </Card>
  );
}

function DailyVerseCard() {
  const { t, i18n } = useTranslation();
  const language = i18n.language as LanguageId;
  const offset = useSettings((s) => s.hijriOffset);
  const seed = daySeed(new Date(), offset);
  const pick = pickDaily(DAILY_VERSE_POOL, seed);

  if (!pick) return null;
  const chapter = getChapter(pick.surah);
  const verse = chapterVerses(pick.surah)[pick.ayah - 1];
  if (!chapter || !verse) return null;

  return (
    <Card>
      <CardHeader
        icon={<BookOpen className="h-5 w-5" aria-hidden />}
        title={t('dashboard.dailyVerse')}
        action={
          <Link to={`/quran/${pick.surah}?ayah=${pick.ayah}`} className="btn-ghost btn-sm">
            {t('quran.readSurah')}
          </Link>
        }
      />
      <ArabicText>{verse}</ArabicText>
      <p className="mt-3 text-xs text-muted">
        {t('common.surah')} {chapter.id} · {chapter.name} — {pick.surah}:{pick.ayah}
      </p>
      <p className="sr-only" lang={language === 'ar' ? 'ar' : 'en'}>
        {chapter.transliteration}
      </p>
    </Card>
  );
}

function QiblaCard() {
  const { t } = useTranslation();
  const location = useSettings((s) => s.location);
  const bearing = qiblaBearing(location);
  const km = distanceKm(location, KAABA);

  return (
    <Card>
      <CardHeader
        icon={<Compass className="h-5 w-5" aria-hidden />}
        title={t('qibla.title')}
        action={
          <Link to="/qibla" className="btn-ghost btn-sm">
            {t('quran.readSurah') === '' ? '' : t('nav.qibla')}
          </Link>
        }
      />
      <div className="flex items-center gap-4">
        <div
          className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2"
          aria-hidden
        >
          <span className="absolute top-1 text-[9px] font-bold text-muted">N</span>
          <span
            className="h-8 w-0.5 origin-bottom bg-accent"
            style={{ transform: `rotate(${bearing}deg) translateY(-14px)` }}
          />
          <span className="h-1.5 w-1.5 rounded-full bg-fg" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tabular">{Math.round(bearing)}°</p>
          <p className="text-xs text-muted">
            {compassPoint(bearing)} · {t('qibla.fromNorth')}
          </p>
          <p className="mt-1 text-xs text-muted tabular">
            {t('qibla.distance')}: {Math.round(km).toLocaleString()} km
          </p>
        </div>
      </div>
    </Card>
  );
}

function ResumeReadingCard() {
  const { t } = useTranslation();
  const lastRead = useSettings((s) => s.lastRead);
  const chapter = lastRead ? getChapter(lastRead.surah) : undefined;

  if (!lastRead || !chapter) {
    return (
      <Card>
        <CardHeader icon={<BookOpen className="h-5 w-5" aria-hidden />} title={t('dashboard.resumeReading')} />
        <p className="text-sm text-muted">{t('quran.noBookmarks')}</p>
        <Link to="/quran" className="btn-outline btn-sm mt-3">
          {t('nav.quran')}
        </Link>
      </Card>
    );
  }

  const totalVerses = quranMeta.chapters
    .slice(0, chapter.id - 1)
    .reduce((sum, c) => sum + c.verses, 0);
  const progress = ((totalVerses + lastRead.ayah) / 6236) * 100;

  return (
    <Card>
      <CardHeader icon={<BookOpen className="h-5 w-5" aria-hidden />} title={t('dashboard.resumeReading')} />
      <p className="text-lg font-semibold">
        {chapter.name} <span className="text-muted">· {chapter.transliteration}</span>
      </p>
      <p className="text-sm text-muted tabular">
        {lastRead.surah}:{lastRead.ayah}
      </p>
      <ProgressBar className="mt-3" value={progress} label={t('quran.readingProgress')} />
      <Link to={`/quran/${lastRead.surah}?ayah=${lastRead.ayah}`} className="btn-primary btn-sm mt-3 w-full">
        {t('dashboard.resumeReading')}
        <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
      </Link>
    </Card>
  );
}

function DailyDuaCard() {
  const { t } = useTranslation();
  const offset = useSettings((s) => s.hijriOffset);
  const seed = daySeed(new Date(), offset);
  const pool = adhkarCategories.flatMap((c) => c.items);
  const pick = pickDaily(pool, seed);

  if (!pick) return null;

  return (
    <Card>
      <CardHeader
        icon={<HandHeart className="h-5 w-5" aria-hidden />}
        title={t('dashboard.dailyDua')}
        action={
          <Link to="/dua" className="btn-ghost btn-sm">
            {t('nav.dua')}
          </Link>
        }
      />
      <ArabicText>{pick.arabic}</ArabicText>
      {pick.english ? (
        <p className="mt-3 border-t border-border pt-3 text-sm text-muted">{pick.english}</p>
      ) : null}
    </Card>
  );
}

function AdhkarProgressCard() {
  const { t } = useTranslation();
  const counters = useCountersSnapshot();
  const morning = morningEveningItems.filter((i) => i.period === 'morning');
  const completed = morning.filter((i) => (counters[i.id]?.done ?? 0) >= i.count).length;

  return (
    <Card>
      <CardHeader icon={<Repeat className="h-5 w-5" aria-hidden />} title={t('adhkar.morning')} />
      <ProgressBar value={completed} max={Math.max(1, morning.length)} />
      <p className="mt-2 text-xs text-muted tabular">
        {completed} / {morning.length}
      </p>
      <Link to="/adhkar/morning" className="btn-outline btn-sm mt-3 w-full">
        {t('adhkar.morning')}
      </Link>
    </Card>
  );
}

/** Reads the counter map once per render without re-subscribing on every tick. */
function useCountersSnapshot() {
  const counters = useUserDataCounters();
  return counters;
}

function DailyHadithCard() {
  const { t } = useTranslation();
  const [pack, setPack] = useState<{ numberLabel: string; english: string; arabic: string } | null>(null);
  const offset = useSettings((s) => s.hijriOffset);
  const seed = daySeed(new Date(), offset);

  useMemo(() => {
    void import('@/data/generated/hadith-sahih-bukhari.json').then((mod) => {
      const data = (mod.default ?? mod) as unknown as {
        hadiths: { numberLabel: string; english: string; arabic: string }[];
      };
      const pick = pickDaily(data.hadiths, seed);
      if (pick) setPack(pick);
    });
  }, [seed]);

  if (!pack) return null;

  return (
    <Card>
      <CardHeader
        icon={<ScrollText className="h-5 w-5" aria-hidden />}
        title={t('dashboard.dailyHadith')}
        action={
          <Link to="/hadith/sahih-bukhari" className="btn-ghost btn-sm">
            {t('nav.hadith')}
          </Link>
        }
      />
      <p className="text-xs font-semibold text-muted tabular">Sahih al-Bukhari {pack.numberLabel}</p>
      <ArabicText className="mt-2">{pack.arabic}</ArabicText>
      <p className="mt-3 border-t border-border pt-3 text-sm text-muted">{pack.english}</p>
    </Card>
  );
}

const WIDGET_MAP: Record<string, () => React.JSX.Element | null> = {
  nextPrayer: NextPrayerCard,
  hijriDate: HijriCard,
  dailyVerse: DailyVerseCard,
  qibla: QiblaCard,
  resumeReading: ResumeReadingCard,
  dailyDua: DailyDuaCard,
  dailyHadith: DailyHadithCard,
  adhkar: AdhkarProgressCard,
};

const QUICK_LINKS = [
  { to: '/prayer-times', key: 'nav.prayerTimes', icon: Clock3 },
  { to: '/quran', key: 'nav.quran', icon: BookOpen },
  { to: '/adhkar', key: 'nav.adhkar', icon: Repeat },
  { to: '/dua', key: 'nav.dua', icon: HandHeart },
  { to: '/hadith', key: 'nav.hadith', icon: ScrollText },
  { to: '/adhan', key: 'nav.adhan', icon: Compass },
];

export default function HomePage() {
  const { t } = useTranslation();
  const widgets = useSettings((s) => s.dashboardWidgets);
  const [editing, setEditing] = useState(false);
  const toggleWidget = useSettings((s) => s.toggleDashboardWidget);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t('dashboard.greeting')}</h1>
          <p className="mt-0.5 text-sm text-muted">{t('app.tagline')}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setEditing((v) => !v)} icon={<Settings2 className="h-4 w-4" aria-hidden />}>
          {t('dashboard.customise')}
        </Button>
      </div>

      {editing ? (
        <Card>
          <CardHeader title={t('dashboard.customise')} subtitle={t('dashboard.customiseHint')} />
          <div className="flex flex-wrap gap-2">
            {Object.keys(WIDGET_MAP).map((id) => {
              const active = widgets.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleWidget(id)}
                  aria-pressed={active}
                  className={`chip ${active ? 'chip-active' : ''}`}
                >
                  {t(`dashboard.widgets.${id}`)}
                </button>
              );
            })}
          </div>
        </Card>
      ) : null}

      {/* Next prayer is always first — it is the reason most people open the app. */}
      <NextPrayerCard />

      <div className="grid gap-4 sm:grid-cols-2">
        {widgets
          .filter((id) => id !== 'nextPrayer' && WIDGET_MAP[id])
          .map((id) => {
            const Widget = WIDGET_MAP[id];
            return <Widget key={id} />;
          })}
      </div>

      <Card>
        <CardHeader title={t('dashboard.quickAccess')} />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface-2 p-3 text-center transition-all duration-150 hover:border-accent/40 hover:bg-accent/5 active:scale-95"
              >
                <Icon className="h-5 w-5 text-accent" aria-hidden />
                <span className="text-[11px] font-medium leading-tight">{t(link.key)}</span>
              </Link>
            );
          })}
        </div>
      </Card>

      <p className="pb-2 text-center text-[11px] leading-relaxed text-muted">
        {t('quran.attribution')}
      </p>
    </div>
  );
}

/* Import placed last to keep the widget map readable above. */
import { useUserData } from '@/state/userData';
function useUserDataCounters() {
  return useUserData((s) => s.counters);
}
