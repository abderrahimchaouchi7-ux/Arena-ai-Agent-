import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bookmark, BookmarkX, BookOpen, Trash2, ArrowRight } from 'lucide-react';
import { Button, Card, EmptyState, PageHeader, SegmentedControl } from '@/components/ui';
import { ArabicText } from '@/components/content';
import { useUserData } from '@/state/userData';
import { chapterVerses, getChapter } from '@/lib/data';
import { useState } from 'react';
import { clsx } from 'clsx';

type Tab = 'content' | 'verses';

export default function BookmarksPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const [tab, setTab] = useState<Tab>('content');
  const bookmarks = useUserData((s) => s.bookmarks);
  const quranBookmarks = useUserData((s) => s.quranBookmarks);
  const toggleQuranBookmark = useUserData((s) => s.toggleQuranBookmark);
  const toggleBookmark = useUserData((s) => s.toggleBookmark);

  const sorted = [...bookmarks].sort((a, b) => b.createdAt - a.createdAt);
  const sortedVerses = [...quranBookmarks].sort(
    (a, b) => a.surah - b.surah || a.ayah - b.ayah,
  );

  const empty = bookmarks.length === 0 && quranBookmarks.length === 0;

  if (empty) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('bookmarks.title')} />
        <Card>
          <EmptyState
            icon={<BookmarkX className="h-8 w-8" aria-hidden />}
            title={t('bookmarks.empty')}
            description={t('quran.noBookmarks')}
            action={
              <Link to="/quran" className="btn-primary btn-sm">
                {t('nav.quran')}
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('bookmarks.title')}
        subtitle={`${bookmarks.length + quranBookmarks.length} ${t('common.results')}`}
      />

      <SegmentedControl<Tab>
        ariaLabel={t('bookmarks.title')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'content', label: `${t('bookmarks.content')} (${bookmarks.length})` },
          { value: 'verses', label: `${t('bookmarks.ayah')} (${quranBookmarks.length})` },
        ]}
      />

      {tab === 'content' ? (
        sorted.length === 0 ? (
          <Card>
            <EmptyState icon={<Bookmark className="h-8 w-8" aria-hidden />} title={t('common.empty')} />
          </Card>
        ) : (
          <div className="space-y-3">
            {sorted.map((entry) => (
              <Card key={entry.id}>
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="chip">{t(`nav.${entry.kind === 'ayah' ? 'quran' : entry.kind}`)}</span>
                  <span className="text-[11px] text-muted">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="font-semibold">{entry.title}</p>
                {/[\u0600-\u06FF]/.test(entry.excerpt) ? (
                  <ArabicText className="mt-2 text-lg">{entry.excerpt}</ArabicText>
                ) : (
                  <p className="mt-2 text-sm text-muted">{entry.excerpt}</p>
                )}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Link
                    to={
                      entry.kind === 'ayah'
                        ? `/quran/${entry.id.split(':')[1]}?ayah=${entry.id.split(':')[2]}`
                        : `/${entry.kind}`
                    }
                    className="btn-ghost btn-sm"
                  >
                    {t('common.openSettings') === '' ? '' : t('nav.search')}
                    <ArrowRight className={clsx('h-4 w-4', isRtl && 'rotate-180')} aria-hidden />
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => toggleBookmark(entry)}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                    {t('common.remove')}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        sortedVerses.length === 0 ? (
          <Card>
            <EmptyState icon={<BookOpen className="h-8 w-8" aria-hidden />} title={t('quran.noBookmarks')} />
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedVerses.map((entry) => {
              const chapter = getChapter(entry.surah);
              const text = chapterVerses(entry.surah)[entry.ayah - 1] ?? '';
              return (
                <Card key={`${entry.surah}:${entry.ayah}`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {chapter?.transliteration} {entry.surah}:{entry.ayah}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleQuranBookmark(entry.surah, entry.ayah)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      {t('common.remove')}
                    </Button>
                  </div>
                  <ArabicText>{text}</ArabicText>
                  <Link
                    to={`/quran/${entry.surah}?ayah=${entry.ayah}`}
                    className="btn-outline btn-sm mt-3"
                  >
                    {t('quran.readSurah')}
                  </Link>
                </Card>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
