import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search as SearchIcon, BookOpen, HandHeart, Repeat, ScrollText, Clock, X } from 'lucide-react';
import { Card, CardHeader, EmptyState, Notice, PageHeader, Spinner } from '@/components/ui';
import { ArabicText } from '@/components/content';
import { useDebounced } from '@/hooks';
import { searchAdhkar, searchHadithInPacks, searchQuran } from '@/lib/search';
import { getChapter, hadithCollections, loadHadithPack, loadTranslation, quranMeta } from '@/lib/data';
import { useUserData } from '@/state/userData';
import { useSettings } from '@/state/settings';
import type { VerseMap } from '@/lib/types';

const MAX_PER_SECTION = 8;

export default function SearchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 300);
  const history = useUserData((s) => s.history);
  const clearHistory = useUserData((s) => s.clearHistory);
  const trackView = useUserData((s) => s.trackView);
  const translationPref = useSettings((s) => s.quranTranslation);

  const [translation, setTranslation] = useState<VerseMap | null>(null);
  const [hadithPacks, setHadithPacks] = useState<
    { collectionId: string; collectionName: string; hadiths: any[] }[]
  >([]);
  const [loadingHadith, setLoadingHadith] = useState(false);

  // Load the active translation so verse search covers it too.
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

  // Hadith packs are ~3 MB together; load them only once a real query exists.
  useEffect(() => {
    if (debounced.trim().length < 2 || hadithPacks.length > 0 || loadingHadith) return;
    let cancelled = false;
    setLoadingHadith(true);
    void Promise.all(
      hadithCollections.map(async (c) => {
        const pack = await loadHadithPack(c.id);
        return pack ? { collectionId: c.id, collectionName: c.name, hadiths: pack.hadiths } : null;
      }),
    ).then((results) => {
      if (cancelled) return;
      setHadithPacks(results.filter(Boolean) as never);
      setLoadingHadith(false);
    });
    return () => {
      cancelled = true;
    };
  }, [debounced, hadithPacks.length, loadingHadith]);

  const quranHits = useMemo(() => {
    if (debounced.trim().length < 2) return null;
    return searchQuran(debounced, translation, 40);
  }, [debounced, translation]);

  const adhkarHits = useMemo(
    () => (debounced.trim().length < 2 ? null : searchAdhkar(debounced, 40)),
    [debounced],
  );

  const hadithHits = useMemo(() => {
    if (debounced.trim().length < 2) return null;
    return searchHadithInPacks(hadithPacks, debounced, 40);
  }, [debounced, hadithPacks]);

  const tooShort = query.trim().length === 1;
  const noResults =
    quranHits &&
    adhkarHits &&
    hadithHits &&
    quranHits.hits.length === 0 &&
    adhkarHits.length === 0 &&
    hadithHits.length === 0;

  const openVerse = (surah: number, ayah: number, title: string) => {
    trackView({ id: `ayah:${surah}:${ayah}`, kind: 'ayah', title, path: `/quran/${surah}?ayah=${ayah}` });
    navigate(`/quran/${surah}?ayah=${ayah}`);
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('search.title')} subtitle={t('common.searchHint')} />

      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-muted ltr:left-3 rtl:right-3"
          aria-hidden
        />
        <input
          className="field ltr:pl-9 rtl:pr-10 rtl:pl-3"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
          autoFocus
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('common.clear')}
            className="icon-btn absolute inset-y-0 my-auto h-8 w-8 ltr:right-1.5 rtl:left-1.5"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {tooShort ? <Notice>{t('search.minChars')}</Notice> : null}

      {history.length > 0 && !query ? (
        <Card>
          <CardHeader
            icon={<Clock className="h-5 w-5" aria-hidden />}
            title={t('search.recent')}
            action={
              <button type="button" onClick={clearHistory} className="btn-ghost btn-sm">
                {t('search.clearRecent')}
              </button>
            }
          />
          <ul className="divide-y divide-border">
            {history.slice(0, 10).map((entry) => (
              <li key={entry.id}>
                <Link to={entry.path} className="flex items-center justify-between gap-3 py-2.5 hover:bg-surface-2/60">
                  <span className="truncate text-sm">{entry.title}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {new Date(entry.viewedAt).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {loadingHadith && query.trim().length >= 2 ? <Spinner label={t('common.loading')} /> : null}

      {noResults ? (
        <Card>
          <EmptyState
            icon={<SearchIcon className="h-8 w-8" aria-hidden />}
            title={t('search.noResults', { query: debounced })}
          />
        </Card>
      ) : null}

      {quranHits && quranHits.hits.length > 0 ? (
        <Card>
          <CardHeader
            icon={<BookOpen className="h-5 w-5" aria-hidden />}
            title={t('search.inQuran')}
            action={
              <span className="chip tabular">
                {quranHits.hits.length}
                {quranHits.truncated ? '+' : ''}
              </span>
            }
          />
          <ul className="divide-y divide-border">
            {quranHits.hits.slice(0, MAX_PER_SECTION).map((hit) => {
              const chapter = getChapter(hit.surah);
              return (
                <li key={`${hit.surah}:${hit.ayah}`}>
                  <button
                    type="button"
                    onClick={() =>
                      openVerse(hit.surah, hit.ayah, `${chapter?.transliteration} ${hit.surah}:${hit.ayah}`)
                    }
                    className="w-full py-3 text-start hover:bg-surface-2/60"
                  >
                    <p className="mb-1 text-xs font-semibold text-accent tabular">
                      {chapter?.transliteration} {hit.surah}:{hit.ayah}
                    </p>
                    <ArabicText className="text-lg">{hit.arabic}</ArabicText>
                    {hit.matchedTranslation ? (
                      <p className="mt-1 text-xs text-muted">{hit.matchedTranslation}</p>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted">{t('quran.searchLangNote')}</p>
        </Card>
      ) : null}

      {adhkarHits && adhkarHits.length > 0 ? (
        <Card>
          <CardHeader
            icon={<HandHeart className="h-5 w-5" aria-hidden />}
            title={t('search.inDua')}
            action={<span className="chip tabular">{adhkarHits.length}</span>}
          />
          <ul className="divide-y divide-border">
            {adhkarHits.slice(0, MAX_PER_SECTION).map((hit) => (
              <li key={hit.itemId} className="py-3">
                <p className="mb-1 text-xs font-semibold text-accent">{hit.categoryTitle}</p>
                <ArabicText className="text-lg">{hit.arabic}</ArabicText>
                {hit.english ? <p className="mt-1 text-xs text-muted">{hit.english}</p> : null}
                <Link
                  to={hit.kind === 'morning-evening' ? '/adhkar/morning' : '/dua'}
                  className="btn-ghost btn-sm mt-2"
                >
                  {t('nav.dua')}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {adhkarHits && adhkarHits.length > 0 ? (
        <Card>
          <CardHeader icon={<Repeat className="h-5 w-5" aria-hidden />} title={t('search.inAdhkar')} />
          <p className="text-xs text-muted">
            {t('adhkar.searchPlaceholder')} — {adhkarHits.length} {t('common.results')}
          </p>
          <Link to="/adhkar" className="btn-outline btn-sm mt-2">
            {t('nav.adhkar')}
          </Link>
        </Card>
      ) : null}

      {hadithHits && hadithHits.length > 0 ? (
        <Card>
          <CardHeader
            icon={<ScrollText className="h-5 w-5" aria-hidden />}
            title={t('search.inHadith')}
            action={<span className="chip tabular">{hadithHits.length}</span>}
          />
          <ul className="divide-y divide-border">
            {hadithHits.slice(0, MAX_PER_SECTION).map((hit) => (
              <li key={hit.id} className="py-3">
                <p className="mb-1 text-xs font-semibold text-accent">
                  {hit.collectionName} {hit.numberLabel}
                </p>
                <ArabicText className="text-lg">{hit.arabic}</ArabicText>
                <p className="mt-1 text-xs text-muted">{hit.english.slice(0, 180)}…</p>
                <Link to={`/hadith/${hit.collectionId}`} className="btn-ghost btn-sm mt-2">
                  {hit.collectionName}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <p className="pb-2 text-center text-[11px] leading-relaxed text-muted">
        {quranMeta.chapters.length} {t('nav.quran')} · {t('hadith.searchHint')}
      </p>
    </div>
  );
}
