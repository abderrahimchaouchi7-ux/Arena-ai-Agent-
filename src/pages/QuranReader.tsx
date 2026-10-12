import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Play,
  Square,
  Search,
  BookOpen,
  Info,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Button, Card, EmptyState, IconButton, Notice, Spinner } from '@/components/ui';
import { ContentActions } from '@/components/content';
import { ayahIndexes, chapterVerses, getChapter, loadTranslation } from '@/lib/data';
import { useSettings } from '@/state/settings';
import { useUserData } from '@/state/userData';
import { useAudioPlayer } from '@/state/audioPlayer';
import { quranVerseAudioUrl, QURAN_RECITERS } from '@/lib/audio';
import { formatVerseShare } from '@/lib/share';
import { useOnline } from '@/hooks';
import type { VerseMap } from '@/lib/types';

/**
 * The Tanzil Uthmani text already carries the Basmala as the opening words of
 * verse 1 in all 113 surahs that have one (At-Tawbah has none), so the reader
 * must not print a second copy above the verse.
 */
const BASMALA_SURAH_IDS = [1, 9];

/** Strips harakat and normalises alef forms so orthographic variants match. */
function bareArabic(value: string): string {
  return value
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627');
}

const BASMALA_BARE = bareArabic('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ');

function verseHasEmbeddedBasmala(surah: number, ayah: number, text: string): boolean {
  if (ayah !== 1 || BASMALA_SURAH_IDS.includes(surah)) return false;
  // Surahs 95 and 97 spell the Basmala with a shadda on the ba, so a literal
  // prefix test would miss them.
  return bareArabic(text.trimStart()).startsWith(BASMALA_BARE);
}

export default function QuranReaderPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const navigate = useNavigate();
  const { surahId } = useParams<{ surahId: string }>();
  const [params] = useSearchParams();
  const online = useOnline();

  const surah = Number.parseInt(surahId ?? '1', 10);
  const chapter = getChapter(surah);
  const verses = useMemo(() => chapterVerses(surah), [surah]);

  const translationPref = useSettings((s) => s.quranTranslation);
  const reciter = useSettings((s) => s.quranReciter);
  const setLastRead = useSettings((s) => s.setLastRead);
  const trackView = useUserData((s) => s.trackView);
  const quranBookmarks = useUserData((s) => s.quranBookmarks);
  const toggleQuranBookmark = useUserData((s) => s.toggleQuranBookmark);

  const [translation, setTranslation] = useState<VerseMap | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [jumpValue, setJumpValue] = useState('');

  const playerSource = useAudioPlayer((s) => s.source);
  const playing = useAudioPlayer((s) => s.playing);
  const setSource = useAudioPlayer((s) => s.setSource);
  const stop = useAudioPlayer((s) => s.stop);
  const setQueue = useAudioPlayer((s) => s.setQueue);

  const verseRefs = useRef<Map<number, HTMLElement>>(new Map());

  // Load the requested translation lazily.
  useEffect(() => {
    let cancelled = false;
    if (translationPref === 'en' || translationPref === 'fr') {
      void loadTranslation(translationPref).then((map) => {
        if (!cancelled) setTranslation(map);
      });
    } else {
      setTranslation(null);
    }
    return () => {
      cancelled = true;
    };
  }, [translationPref]);

  // Scroll to ?ayah=N once the surah has rendered.
  useEffect(() => {
    const target = Number.parseInt(params.get('ayah') ?? '', 10);
    if (!Number.isFinite(target)) return;
    const el = verseRefs.current.get(target);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'auto' });
      el.classList.add('animate-scale-in');
    }
  }, [params, surah]);

  // Remember the reading position as the user scrolls.
  useEffect(() => {
    if (!chapter) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const ayah = Number(entry.target.getAttribute('data-ayah'));
            if (Number.isFinite(ayah)) setLastRead(surah, ayah);
          }
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    verseRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [surah, chapter, setLastRead]);

  if (!chapter || verses.length === 0) {
    return (
      <div>
        <EmptyState icon={<BookOpen className="h-8 w-8" aria-hidden />} title={t('errors.dataMissing')} description={t('errors.dataMissingBody')} />
        <Button variant="outline" onClick={() => navigate('/quran')}>
          {t('quran.surahs')}
        </Button>
      </div>
    );
  }

  trackView({
    id: `surah:${surah}`,
    kind: 'surah',
    title: `${chapter.transliteration} (${chapter.name})`,
    path: `/quran/${surah}`,
  });

  const translatedVerses = translation?.[String(surah)] ?? null;
  const filtered = searchQuery.trim()
    ? verses
        .map((text, i) => ({ text, ayah: i + 1 }))
        .filter((v) => v.text.includes(searchQuery.trim()))
    : null;

  const activeVerse =
    playerSource?.origin === 'quran' && playerSource.surah === surah ? playerSource.ayah : null;

  const handlePlayVerse = (ayah: number) => {
    if (activeVerse === ayah && playing) {
      stop();
      return;
    }
    const url = quranVerseAudioUrl(reciter, surah, ayah);
    if (!url) return;
    setQueue(
      verses.map((_, i) => ({ surah, ayah: i + 1 })),
      ayah - 1,
    );
    setSource({
      url,
      origin: 'quran',
      title: `${chapter.transliteration} ${surah}:${ayah}`,
      subtitle: QURAN_RECITERS.find((r) => r.id === reciter)?.name,
      surah,
      ayah,
    });
  };

  const BackIcon = isRtl ? ChevronRight : ChevronLeft;
  const ForwardIcon = isRtl ? ChevronLeft : ChevronRight;
  const prevSurah = surah > 1 ? surah - 1 : null;
  const nextSurah = surah < 114 ? surah + 1 : null;

  return (
    <div className="space-y-4">
      {/* Sticky reader header */}
      <div className="sticky top-[57px] z-20 -mx-3 mb-2 bg-bg/95 px-3 py-2 backdrop-blur-md sm:-mx-5 sm:px-5 no-print">
        <div className="flex items-center gap-2">
          <IconButton label={t('a11y.backToList')} onClick={() => navigate('/quran')}>
            <ArrowLeft className={clsx('h-5 w-5', isRtl && 'rotate-180')} aria-hidden />
          </IconButton>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">
              {chapter.transliteration} · {chapter.id}
            </p>
            <p className="truncate text-[11px] text-muted tabular">
              {t('quran.ayahCount', { count: chapter.verses })} · {t(chapter.revelation === 'meccan' ? 'quran.meccan' : 'quran.medinan')}
            </p>
          </div>
          <IconButton label={t('quran.searchVerses')} onClick={() => setSearchOpen((v) => !v)} active={searchOpen}>
            <Search className="h-5 w-5" aria-hidden />
          </IconButton>
          {prevSurah ? (
            <IconButton label={t('quran.previousSurah')} onClick={() => navigate(`/quran/${prevSurah}`)}>
              <BackIcon className="h-5 w-5" aria-hidden />
            </IconButton>
          ) : null}
          {nextSurah ? (
            <IconButton label={t('quran.nextSurah')} onClick={() => navigate(`/quran/${nextSurah}`)}>
              <ForwardIcon className="h-5 w-5" aria-hidden />
            </IconButton>
          ) : null}
        </div>

        {searchOpen ? (
          <div className="mt-2 animate-slide-up">
            <input
              className="field"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('quran.searchVersesPlaceholder')}
              aria-label={t('quran.searchVersesPlaceholder')}
              dir="rtl"
            />
            {filtered ? (
              <p className="mt-1 text-xs text-muted tabular">
                {t('quran.searchedVerses', { count: filtered.length })}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Surah header card */}
      <Card ornament>
        <div className="relative z-10 text-center">
          <p className="font-arabic text-3xl" dir="rtl" lang="ar">
            {chapter.name}
          </p>
          <p className="mt-1 text-sm font-semibold">{chapter.transliteration}</p>
          <p className="text-xs text-muted">
            {chapter.translation} · {t(chapter.revelation === 'meccan' ? 'quran.meccan' : 'quran.medinan')} ·{' '}
            {t('quran.ayahCount', { count: chapter.verses })}
          </p>
        </div>
      </Card>

      {translationPref !== 'none' && !translatedVerses ? <Spinner label={t('common.loading')} /> : null}

      {translationPref === 'ar' ? (
        <Notice tone="info">{t('common.translationUnavailable')}</Notice>
      ) : null}

      {!online ? <Notice tone="warning">{t('common.offlineNotice')}</Notice> : null}

      <div className="flex items-center justify-between gap-2">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const ayah = Number.parseInt(jumpValue, 10);
            if (Number.isFinite(ayah) && ayah >= 1 && ayah <= chapter.verses) {
              navigate(`/quran/${surah}?ayah=${ayah}`);
              setJumpValue('');
            }
          }}
        >
          <input
            className="field w-24"
            type="number"
            min={1}
            max={chapter.verses}
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            placeholder={t('quran.goToAyah')}
            aria-label={t('quran.goToAyah')}
          />
          <Button size="sm" variant="outline" type="submit">
            {t('quran.goToAyah')}
          </Button>
        </form>
      </div>

      {/* Verses */}
      <Card>
        {filtered && filtered.length === 0 ? (
          <EmptyState title={t('quran.noSearchResults')} />
        ) : (
          <ol className="divide-y divide-border">
            {(filtered ?? verses.map((text, i) => ({ text, ayah: i + 1 }))).map(({ text, ayah }) => {
              const indexes = ayahIndexes(surah, ayah);
              const bookmarked = quranBookmarks.some(
                (b) => b.surah === surah && b.ayah === ayah,
              );
              const isActive = activeVerse === ayah;
              const translationText = translatedVerses?.[ayah - 1] ?? null;

              return (
                <li
                  key={ayah}
                  data-ayah={ayah}
                  ref={(el) => {
                    if (el) verseRefs.current.set(ayah, el);
                  }}
                  className={clsx(
                    'scroll-mt-32 py-5 transition-colors',
                    isActive && 'rounded-lg bg-accent/5 px-2 -mx-2',
                  )}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <span className="chip tabular">
                      {surah}:{ayah}
                    </span>
                    <span className="chip tabular">
                      {t('common.juz')} {indexes.juz}
                    </span>
                    <span className="chip tabular">
                      {t('common.hizb')} {indexes.hizb}
                    </span>
                    <span className="chip tabular">
                      {t('common.page')} {indexes.page}
                    </span>
                    {indexes.sajda ? (
                      <span
                        className="chip chip-active"
                        title={t('quran.sajdaNote')}
                        role="note"
                      >
                        <Info className="h-3 w-3" aria-hidden />
                        {t('quran.sajda')}
                      </span>
                    ) : null}
                  </div>

                  <p
                    dir="rtl"
                    lang="ar"
                    className="quran-text"
                    style={{ textAlign: 'justify' }}
                  >
                    {text}
                    <span className="verse-end" aria-hidden>
                      {ayah}
                    </span>
                  </p>

                  {verseHasEmbeddedBasmala(surah, ayah, text) ? (
                    <p className="mt-1 text-[11px] text-muted">{t('quran.basmalaNote')}</p>
                  ) : null}

                  {translationText ? (
                    <p className="mt-3 border-t border-dashed border-border pt-3 text-sm leading-relaxed text-muted">
                      {translationText}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handlePlayVerse(ayah)}
                      icon={
                        isActive && playing ? (
                          <Square className="h-4 w-4" aria-hidden />
                        ) : (
                          <Play className="h-4 w-4" aria-hidden />
                        )
                      }
                    >
                      {isActive && playing ? t('quran.stopPlayback') : t('quran.playVerse')}
                    </Button>

                    <div className="flex items-center gap-1">
                      <IconButton
                        label={bookmarked ? t('common.bookmarked') : t('common.bookmark')}
                        active={bookmarked}
                        onClick={() => toggleQuranBookmark(surah, ayah)}
                      >
                        {bookmarked ? (
                          <BookmarkCheck className="h-[18px] w-[18px]" aria-hidden />
                        ) : (
                          <Bookmark className="h-[18px] w-[18px]" aria-hidden />
                        )}
                      </IconButton>
                      <ContentActions
                        id={`ayah:${surah}:${ayah}`}
                        kind="ayah"
                        title={`${chapter.transliteration} ${surah}:${ayah}`}
                        excerpt={text.slice(0, 120)}
                        shareText={formatVerseShare({
                          arabic: text,
                          surahName: chapter.transliteration,
                          surahNumber: surah,
                          ayah,
                          translation: translationText,
                        })}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <div className="flex items-center justify-between gap-2 pb-2">
        {prevSurah ? (
          <Button variant="outline" onClick={() => navigate(`/quran/${prevSurah}`)}>
            <ArrowLeft className={clsx('h-4 w-4', isRtl && 'rotate-180')} aria-hidden />
            {t('quran.previousSurah')}
          </Button>
        ) : (
          <span />
        )}
        <Link to="/quran" className="btn-ghost btn-sm">
          {t('quran.surahs')}
        </Link>
        {nextSurah ? (
          <Button variant="outline" onClick={() => navigate(`/quran/${nextSurah}`)}>
            {t('quran.nextSurah')}
            <ArrowRight className={clsx('h-4 w-4', isRtl && 'rotate-180')} aria-hidden />
          </Button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
