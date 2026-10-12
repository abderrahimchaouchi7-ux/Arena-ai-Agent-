import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Layers, FileText, Search, ArrowRight, Bookmark, WifiOff } from 'lucide-react';
import { clsx } from 'clsx';
import { Card, CardHeader, EmptyState, Notice, PageHeader, SegmentedControl } from '@/components/ui';
import { quranMeta, juzStart, pageStart } from '@/lib/data';
import { useSettings } from '@/state/settings';
import { useUserData } from '@/state/userData';
import { TOTAL_VERSES } from '@/lib/data';

type Tab = 'surahs' | 'juz' | 'pages' | 'bookmarks';

export default function QuranIndexPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const [tab, setTab] = useState<Tab>('surahs');
  const [query, setQuery] = useState('');
  const lastRead = useSettings((s) => s.lastRead);
  const quranBookmarks = useUserData((s) => s.quranBookmarks);

  const chapters = useMemo(() => {
    const raw = query.trim().toLowerCase();
    if (!raw) return quranMeta.chapters;
    return quranMeta.chapters.filter(
      (c) =>
        c.name.includes(query.trim()) ||
        c.transliteration.toLowerCase().includes(raw) ||
        c.translation.toLowerCase().includes(raw) ||
        String(c.id) === raw,
    );
  }, [query]);

  return (
    <div className="space-y-4">
      <PageHeader title={t('quran.title')} subtitle={t('quran.subtitle')} />

      <Notice tone="success" icon={<WifiOff className="h-4 w-4" aria-hidden />}>
        {t('quran.offlineReady')} — {quranMeta.chapters.length} {t('nav.quran')} ·{' '}
        {TOTAL_VERSES.toLocaleString()} {t('common.verses')}
      </Notice>

      {lastRead ? (
        <Link to={`/quran/${lastRead.surah}?ayah=${lastRead.ayah}`} className="block">
          <Card className="flex items-center justify-between gap-3 py-3.5 transition-colors hover:border-accent/40">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <BookOpen className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">{t('dashboard.resumeReading')}</p>
                <p className="text-xs text-muted tabular">
                  {lastRead.surah}:{lastRead.ayah}
                </p>
              </div>
            </div>
            <ArrowRight className={clsx('h-5 w-5 text-muted', isRtl && 'rotate-180')} aria-hidden />
          </Card>
        </Link>
      ) : null}

      <SegmentedControl<Tab>
        ariaLabel={t('quran.title')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'surahs', label: t('quran.surahs') },
          { value: 'juz', label: t('quran.juzList') },
          { value: 'pages', label: t('quran.pagesList') },
          { value: 'bookmarks', label: t('quran.bookmarks') },
        ]}
      />

      {tab === 'surahs' ? (
        <Card>
          <div className="relative mb-3">
            <Search
              className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-muted ltr:left-3 rtl:right-3"
              aria-hidden
            />
            <input
              className="field ltr:pl-9 rtl:pr-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('quran.searchPlaceholder')}
              aria-label={t('quran.searchPlaceholder')}
            />
          </div>

          {chapters.length === 0 ? (
            <EmptyState icon={<Search className="h-8 w-8" aria-hidden />} title={t('common.noResults')} />
          ) : (
            <ul className="divide-y divide-border">
              {chapters.map((chapter) => (
                <li key={chapter.id}>
                  <Link
                    to={`/quran/${chapter.id}`}
                    className="flex items-center gap-3 py-3 transition-colors hover:bg-surface-2/60"
                  >
                    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
                      <svg viewBox="0 0 40 40" className="absolute inset-0 h-9 w-9 text-accent/40" aria-hidden>
                        <path
                          d="M20 2 34.1 8.5 38 20l-3.9 11.5L20 38 5.9 31.5 2 20l3.9-11.5z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      </svg>
                      <span className="relative text-[11px] font-bold tabular">{chapter.id}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{chapter.transliteration}</p>
                      <p className="truncate text-xs text-muted">
                        {t(chapter.revelation === 'meccan' ? 'quran.meccan' : 'quran.medinan')} ·{' '}
                        {t('quran.ayahCount', { count: chapter.verses })}
                      </p>
                    </div>
                    <p className="shrink-0 font-arabic text-lg" dir="rtl" lang="ar">
                      {chapter.name}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === 'juz' ? (
        <Card>
          <CardHeader icon={<Layers className="h-5 w-5" aria-hidden />} title={t('quran.juzList')} />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {quranMeta.juz.map((juz) => {
              const start = juzStart(juz.index);
              if (!start) return null;
              return (
                <Link
                  key={juz.index}
                  to={`/quran/${start.surah}?ayah=${start.ayah}`}
                  className="surface-2 flex flex-col items-center gap-0.5 p-2.5 transition-colors hover:border-accent/40"
                >
                  <span className="text-sm font-bold tabular">{juz.index}</span>
                  <span className="text-[10px] text-muted tabular">
                    {start.surah}:{start.ayah}
                  </span>
                </Link>
              );
            })}
          </div>
        </Card>
      ) : null}

      {tab === 'pages' ? (
        <Card>
          <CardHeader icon={<FileText className="h-5 w-5" aria-hidden />} title={t('quran.pagesList')} />
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
            {quranMeta.pages.map((page) => {
              const start = pageStart(page.index);
              if (!start) return null;
              return (
                <Link
                  key={page.index}
                  to={`/quran/${start.surah}?ayah=${start.ayah}`}
                  className="surface-2 py-2 text-center text-xs font-medium tabular transition-colors hover:border-accent/40"
                >
                  {page.index}
                </Link>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">
            {quranMeta.pages.length} {t('common.page')}
          </p>
        </Card>
      ) : null}

      {tab === 'bookmarks' ? (
        <Card>
          <CardHeader icon={<Bookmark className="h-5 w-5" aria-hidden />} title={t('quran.bookmarks')} />
          {quranBookmarks.length === 0 ? (
            <EmptyState icon={<Bookmark className="h-8 w-8" aria-hidden />} title={t('quran.noBookmarks')} />
          ) : (
            <ul className="divide-y divide-border">
              {quranBookmarks.map((b) => {
                const chapter = quranMeta.chapters.find((c) => c.id === b.surah);
                return (
                  <li key={`${b.surah}:${b.ayah}`}>
                    <Link
                      to={`/quran/${b.surah}?ayah=${b.ayah}`}
                      className="flex items-center justify-between gap-3 py-3 hover:bg-surface-2/60"
                    >
                      <span className="text-sm font-medium tabular">
                        {chapter?.transliteration} {b.surah}:{b.ayah}
                      </span>
                      <span className="text-xs text-muted">{new Date(b.createdAt).toLocaleDateString()}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}

      <p className="pb-2 text-center text-[11px] leading-relaxed text-muted">{t('quran.attribution')}</p>
    </div>
  );
}
