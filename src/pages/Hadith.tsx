import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ScrollText, Search, Info, ArrowLeft, Library, BookMarked } from 'lucide-react';
import { clsx } from 'clsx';
import { Button, Card, CardHeader, Chip, EmptyState, Notice, PageHeader, Spinner } from '@/components/ui';
import { ArabicText, ContentActions, GradeBadge, SourceLine } from '@/components/content';
import { hadithCollections, hadithGradingNote, loadHadithPack } from '@/lib/data';
import { normaliseArabic } from '@/lib/search';
import { useDebounced } from '@/hooks';
import type { Hadith, HadithPack } from '@/lib/types';

function HadithCard({
  hadith,
  pack,
  showCollection = false,
}: {
  hadith: Hadith;
  pack: HadithPack;
  showCollection?: boolean;
}) {
  const { t } = useTranslation();
  const chapter = pack.chapters.find((c) => String(c.number) === String(hadith.chapterId));

  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {showCollection ? <span className="chip">{pack.name}</span> : null}
        <span className="chip tabular">
          {t('hadith.number')} {hadith.numberLabel}
        </span>
        {chapter ? (
          <span className="chip">
            {t('hadith.chapterLabel')}: {chapter.english}
          </span>
        ) : null}
      </div>

      {hadith.headingEnglish ? (
        <p className="mb-2 text-sm font-semibold text-accent">{hadith.headingEnglish}</p>
      ) : null}

      {hadith.narrator ? (
        <p className="mb-2 text-xs italic text-muted">
          {t('hadith.narrator')}: {hadith.narrator}
        </p>
      ) : null}

      <ArabicText>{hadith.arabic}</ArabicText>

      {hadith.textRepeatsPrevious ? (
        <Notice tone="info" icon={<Info className="h-4 w-4" aria-hidden />} className="mt-3">
          {t('hadith.repeatsPrevious')}
        </Notice>
      ) : (
        <p className="mt-3 border-t border-dashed border-border pt-3 text-sm leading-relaxed text-muted">
          {hadith.english}
        </p>
      )}

      {hadith.numberRange ? (
        <p className="mt-2 text-xs text-muted">
          {t('hadith.numberRange', { label: hadith.numberLabel })}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="min-w-0 space-y-1">
          <SourceLine label={t('common.source')}>
            {pack.name}, {t('hadith.number')} {hadith.numberLabel}
            {chapter ? ` — ${chapter.english}` : ''}
          </SourceLine>
          <SourceLine label={t('hadith.compiler')}>{pack.compiler}</SourceLine>
        </div>
        <ContentActions
          id={`hadith:${hadith.id}`}
          kind="hadith"
          title={`${pack.name} ${hadith.numberLabel}`}
          excerpt={hadith.english.slice(0, 140)}
          shareText={`${hadith.arabic}\n\n${hadith.textRepeatsPrevious ? '' : hadith.english}\n\n[${pack.name} ${hadith.numberLabel}]`.trim()}
        />
      </div>
    </Card>
  );
}

function CollectionView({ collectionId }: { collectionId: string }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const navigate = useNavigate();
  const [pack, setPack] = useState<HadithPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [activeChapter, setActiveChapter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 220);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    void loadHadithPack(collectionId).then((loaded) => {
      if (cancelled) return;
      if (!loaded) {
        setFailed(true);
      } else {
        setPack(loaded);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  const summary = hadithCollections.find((c) => c.id === collectionId);

  const filtered = useMemo(() => {
    if (!pack) return [];
    const raw = debounced.trim().toLowerCase();
    let list = pack.hadiths;
    if (activeChapter) list = list.filter((h) => String(h.chapterId) === activeChapter);
    if (raw.length >= 2) {
      const needleAr = normaliseArabic(debounced);
      const numeric = Number.parseInt(raw, 10);
      list = list.filter(
        (h) =>
          normaliseArabic(h.arabic).includes(needleAr) ||
          h.english.toLowerCase().includes(raw) ||
          h.narrator.toLowerCase().includes(raw) ||
          (Number.isFinite(numeric) && h.numberLabel.includes(raw)),
      );
    }
    return list.slice(0, 120);
  }, [pack, activeChapter, debounced]);

  if (loading) return <Spinner label={t('common.loading')} />;

  if (failed || !pack) {
    return (
      <Card>
        <EmptyState
          icon={<ScrollText className="h-8 w-8" aria-hidden />}
          title={t('errors.dataMissing')}
          description={t('errors.dataMissingBody')}
        />
        <Button variant="outline" onClick={() => navigate('/hadith')}>
          {t('hadith.collections')}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={pack.name}
        subtitle={`${pack.compiler} · ${t('hadith.offlinePack')}: ${pack.hadiths.length} / ${summary?.totalInCollection ?? '—'}`}
        back={
          <button
            type="button"
            onClick={() => navigate('/hadith')}
            aria-label={t('a11y.backToList')}
            className="icon-btn -ms-2"
          >
            <ArrowLeft className={clsx('h-5 w-5', isRtl && 'rotate-180')} aria-hidden />
          </button>
        }
      />

      <Notice tone="warning" title={t('common.provenance')}>
        {t('hadith.gradeDisclaimer')}
      </Notice>

      {summary ? (
        <Notice tone="info">
          {t('hadith.offlinePackNote', {
            count: summary.offlineCount,
            total: summary.totalInCollection.toLocaleString(),
          })}
        </Notice>
      ) : null}

      <div className="relative">
        <Search
          className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-muted ltr:left-3 rtl:right-3"
          aria-hidden
        />
        <input
          className="field ltr:pl-9 rtl:pr-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('hadith.searchPlaceholder')}
          aria-label={t('hadith.searchPlaceholder')}
        />
      </div>

      <Card>
        <CardHeader icon={<BookMarked className="h-5 w-5" aria-hidden />} title={t('hadith.chapters')} />
        <div className="flex flex-wrap gap-1.5">
          <Chip active={activeChapter === null} onClick={() => setActiveChapter(null)}>
            {t('common.all')}
          </Chip>
          {pack.chapters
            .filter((c) => pack.hadiths.some((h) => String(h.chapterId) === String(c.number)))
            .map((chapter) => (
              <Chip
                key={chapter.id}
                active={activeChapter === String(chapter.number)}
                onClick={() => setActiveChapter(String(chapter.number))}
              >
                {chapter.english}
              </Chip>
            ))}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState icon={<Search className="h-8 w-8" aria-hidden />} title={t('hadith.noResults')} />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((hadith) => (
            <HadithCard key={hadith.id} hadith={hadith} pack={pack} />
          ))}
        </div>
      )}

      <p className="pb-2 text-center text-xs text-muted">{t('hadith.searchHint')}</p>
    </div>
  );
}

export default function HadithPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { collectionId } = useParams<{ collectionId?: string }>();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 300);

  const [packs, setPacks] = useState<Record<string, HadithPack>>({});
  const [loadingPacks, setLoadingPacks] = useState(false);

  // Global search needs every pack in memory; load them on first search only.
  useEffect(() => {
    const raw = debounced.trim();
    if (raw.length < 2 || Object.keys(packs).length > 0 || loadingPacks) return;
    let cancelled = false;
    setLoadingPacks(true);
    void Promise.all(
      hadithCollections.map(async (c) => {
        const pack = await loadHadithPack(c.id);
        return pack ? [c.id, pack] as const : null;
      }),
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, HadithPack> = {};
      for (const entry of results) if (entry) map[entry[0]] = entry[1];
      setPacks(map);
      setLoadingPacks(false);
    });
    return () => {
      cancelled = true;
    };
  }, [debounced, packs, loadingPacks]);

  const searchResults = useMemo(() => {
    const raw = debounced.trim().toLowerCase();
    if (raw.length < 2) return null;
    const needleAr = normaliseArabic(debounced);
    const numeric = Number.parseInt(raw, 10);
    const out: { hadith: Hadith; pack: HadithPack }[] = [];
    for (const pack of Object.values(packs)) {
      for (const hadith of pack.hadiths) {
        if (
          normaliseArabic(hadith.arabic).includes(needleAr) ||
          hadith.english.toLowerCase().includes(raw) ||
          hadith.narrator.toLowerCase().includes(raw) ||
          (Number.isFinite(numeric) && hadith.numberLabel.includes(raw))
        ) {
          out.push({ hadith, pack });
          if (out.length >= 80) return out;
        }
      }
    }
    return out;
  }, [debounced, packs]);

  if (collectionId) return <CollectionView collectionId={collectionId} />;

  return (
    <div className="space-y-4">
      <PageHeader title={t('hadith.title')} subtitle={t('hadith.subtitle')} />

      <Notice tone="warning" title={t('common.provenance')}>
        {hadithGradingNote}
      </Notice>

      <div className="relative">
        <Search
          className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-muted ltr:left-3 rtl:right-3"
          aria-hidden
        />
        <input
          className="field ltr:pl-9 rtl:pr-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('hadith.searchPlaceholder')}
          aria-label={t('hadith.searchPlaceholder')}
        />
      </div>

      {searchResults ? (
        loadingPacks ? (
          <Spinner label={t('common.loading')} />
        ) : searchResults.length === 0 ? (
          <Card>
            <EmptyState icon={<Search className="h-8 w-8" aria-hidden />} title={t('hadith.noResults')} />
          </Card>
        ) : (
          <div className="space-y-3">
            {searchResults.map(({ hadith, pack }) => (
              <HadithCard key={hadith.id} hadith={hadith} pack={pack} showCollection />
            ))}
          </div>
        )
      ) : (
        <>
          <Card>
            <CardHeader icon={<Library className="h-5 w-5" aria-hidden />} title={t('hadith.collections')} />
            <div className="grid gap-2 sm:grid-cols-2">
              {hadithCollections.map((collection) => (
                <button
                  key={collection.id}
                  type="button"
                  onClick={() => navigate(`/hadith/${collection.id}`)}
                  className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-3.5 text-start transition-colors hover:border-accent/40"
                >
                  <ScrollText className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{collection.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">{collection.compiler}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <GradeBadge>
                        {t('hadith.offlinePack')}: {collection.offlineCount}
                      </GradeBadge>
                      <GradeBadge>
                        {t('hadith.chapters')}: {collection.chapters}
                      </GradeBadge>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Notice tone="info" title={t('hadith.offlinePack')}>
            {hadithCollections.reduce((n, c) => n + c.offlineCount, 0).toLocaleString()}{' '}
            {t('nav.hadith')} — {t('hadith.searchHint')}
          </Notice>
        </>
      )}
    </div>
  );
}
