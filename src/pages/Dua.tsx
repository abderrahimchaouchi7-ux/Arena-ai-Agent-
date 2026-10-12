import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HandHeart, Search, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { clsx } from 'clsx';
import { Card, CardHeader, Chip, EmptyState, Notice, PageHeader } from '@/components/ui';
import { ArabicText, ContentActions, DhikrCounter, SourceLine, Transliteration } from '@/components/content';
import { adhkarCategories, chapterVerses, getChapter } from '@/lib/data';
import { normaliseArabic } from '@/lib/search';
import { useDebounced } from '@/hooks';

/**
 * Du'as recorded in the Quran itself. Every entry is quoted from the bundled
 * Tanzil text by chapter and verse, so the reference is verifiable in-app.
 */
const QURANIC_DUAS: { surah: number; ayah: number; english: string }[] = [
  { surah: 2, ayah: 201, english: 'Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.' },
  { surah: 2, ayah: 286, english: 'Our Lord, do not take us to task if we forget or make a mistake… and pardon us, and forgive us, and have mercy on us.' },
  { surah: 3, ayah: 8, english: 'Our Lord, do not let our hearts deviate after You have guided us, and grant us mercy from Yourself. Indeed, You are the Bestower.' },
  { surah: 3, ayah: 16, english: 'Our Lord, we have believed, so forgive us our sins and protect us from the punishment of the Fire.' },
  { surah: 3, ayah: 53, english: 'Our Lord, we have believed in what You revealed and followed the Messenger, so register us among the witnesses.' },
  { surah: 3, ayah: 147, english: 'Our Lord, forgive us our sins and the excess in our affair, and make our feet firm, and help us against the disbelieving people.' },
  { surah: 3, ayah: 191, english: 'Our Lord, You did not create this in vain; exalted are You, so protect us from the punishment of the Fire.' },
  { surah: 3, ayah: 193, english: 'Our Lord, we heard a caller calling to faith… so forgive us our sins and remove from us our misdeeds.' },
  { surah: 7, ayah: 23, english: 'Our Lord, we have wronged ourselves, and if You do not forgive us and have mercy on us, we will surely be among the losers.' },
  { surah: 7, ayah: 89, english: 'Our Lord, judge between us and our people with truth, and You are the best of judges.' },
  { surah: 11, ayah: 47, english: 'My Lord, I seek refuge in You from asking You that of which I have no knowledge.' },
  { surah: 12, ayah: 101, english: 'My Lord, You have given me something of sovereignty and taught me the interpretation of dreams… cause me to die a Muslim and join me with the righteous.' },
  { surah: 14, ayah: 40, english: 'My Lord, make me an establisher of prayer, and from my descendants. Our Lord, accept my supplication.' },
  { surah: 17, ayah: 24, english: 'My Lord, have mercy upon them as they raised me when I was small.' },
  { surah: 17, ayah: 80, english: 'My Lord, cause me to enter a sound entrance and to exit a sound exit, and grant me from Yourself a supporting authority.' },
  { surah: 20, ayah: 25, english: 'My Lord, expand for me my chest, and ease for me my task, and untie the knot from my tongue.' },
  { surah: 20, ayah: 114, english: 'My Lord, increase me in knowledge.' },
  { surah: 21, ayah: 87, english: 'There is no deity except You; exalted are You. Indeed, I have been of the wrongdoers.' },
  { surah: 21, ayah: 89, english: 'My Lord, do not leave me alone, while You are the best of inheritors.' },
  { surah: 23, ayah: 29, english: 'My Lord, let me land at a blessed landing place, and You are the best to accommodate.' },
  { surah: 23, ayah: 97, english: 'My Lord, I seek refuge in You from the incitements of the devils.' },
  { surah: 23, ayah: 118, english: 'My Lord, forgive and have mercy, and You are the best of the merciful.' },
  { surah: 25, ayah: 74, english: 'Our Lord, grant us from among our wives and offspring comfort to our eyes, and make us a leader among the righteous.' },
  { surah: 26, ayah: 83, english: 'My Lord, grant me wisdom and join me with the righteous.' },
  { surah: 28, ayah: 16, english: 'My Lord, indeed I have wronged myself, so forgive me.' },
  { surah: 28, ayah: 24, english: 'My Lord, indeed I am in need of whatever good You would send down to me.' },
  { surah: 37, ayah: 100, english: 'My Lord, grant me one of the righteous.' },
  { surah: 40, ayah: 8, english: 'Our Lord, admit them to gardens of perpetual residence… and protect them from the evil consequences of their deeds.' },
  { surah: 46, ayah: 15, english: 'My Lord, enable me to be grateful for Your favour… and to do righteousness of which You approve.' },
  { surah: 59, ayah: 10, english: 'Our Lord, forgive us and our brothers who preceded us in faith, and put not in our hearts resentment toward those who have believed.' },
  { surah: 66, ayah: 8, english: 'Our Lord, perfect for us our light and forgive us. Indeed, You are over all things competent.' },
  { surah: 71, ayah: 28, english: 'My Lord, forgive me and my parents and whoever enters my house a believer, and the believing men and believing women.' },
];

function QuranicDuas() {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader
        icon={<BookOpen className="h-5 w-5" aria-hidden />}
        title={t('dua.quranic')}
        subtitle={t('dua.quranicNote')}
      />
      <ul className="divide-y divide-border">
        {QURANIC_DUAS.map((entry) => {
          const chapter = getChapter(entry.surah);
          const text = chapterVerses(entry.surah)[entry.ayah - 1];
          if (!chapter || !text) return null;
          return (
            <li key={`${entry.surah}:${entry.ayah}`} className="py-4">
              <ArabicText>{text}</ArabicText>
              <p className="mt-3 text-sm leading-relaxed text-muted">{entry.english}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <SourceLine label={t('common.reference')}>
                  {chapter.transliteration} {entry.surah}:{entry.ayah} — {t('common.source')}: {t('quran.title')}
                </SourceLine>
                <ContentActions
                  id={`dua-quran:${entry.surah}:${entry.ayah}`}
                  kind="dua"
                  title={`${chapter.transliteration} ${entry.surah}:${entry.ayah}`}
                  excerpt={text.slice(0, 120)}
                  shareText={`${text}\n\n[${chapter.transliteration} ${entry.surah}:${entry.ayah}]`}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function HisnCategory({ categoryId }: { categoryId: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const category = adhkarCategories.find((c) => c.id === categoryId);
  if (!category) return null;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-start"
      >
        <div className="min-w-0">
          <p className="truncate font-semibold">{category.englishTitle ?? category.arabicTitle}</p>
          <p className="truncate font-arabic text-sm text-muted" dir="rtl" lang="ar">
            {category.arabicTitle}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {t('dua.itemsInCategory', { count: category.items.length })}
          </p>
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        )}
      </button>

      {open ? (
        <ul className="mt-3 animate-slide-up divide-y divide-border border-t border-border pt-1">
          {category.items.map((item) => (
            <li key={item.id} className="py-4">
              <ArabicText>{item.arabic}</ArabicText>
              {item.transliteration ? <Transliteration>{item.transliteration}</Transliteration> : null}
              {item.english ? (
                <p className="mt-3 border-t border-dashed border-border pt-3 text-sm leading-relaxed text-muted">
                  {item.english}
                </p>
              ) : (
                <p className="mt-3 border-t border-dashed border-border pt-3 text-xs italic text-muted">
                  {t('common.translationUnavailable')}
                </p>
              )}
              <DhikrCounter id={`dua:${item.id}`} target={item.count} />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <SourceLine label={t('common.source')}>{category.reference}</SourceLine>
                <ContentActions
                  id={`dua:${item.id}`}
                  kind="dua"
                  title={category.englishTitle ?? category.arabicTitle}
                  excerpt={item.arabic.slice(0, 120)}
                  shareText={`${item.arabic}\n\n${category.reference}`}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

export default function DuaPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 220);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);

  const matches = useMemo(() => {
    const raw = debounced.trim().toLowerCase();
    if (raw.length < 2) return null;
    const needleAr = normaliseArabic(debounced);
    return adhkarCategories
      .flatMap((category) =>
        category.items
          .filter(
            (item) =>
              normaliseArabic(item.arabic).includes(needleAr) ||
              (item.english ?? '').toLowerCase().includes(raw),
          )
          .map((item) => ({ item, category })),
      )
      .slice(0, 60);
  }, [debounced]);

  return (
    <div className="space-y-4">
      <PageHeader title={t('dua.title')} subtitle={t('dua.subtitle')} />

      <Notice tone="info" title={t('common.provenance')}>
        {t('dua.provenance')} — {t('adhan.licenceNote')}
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
          placeholder={t('dua.searchPlaceholder')}
          aria-label={t('dua.searchPlaceholder')}
        />
      </div>

      {matches ? (
        matches.length === 0 ? (
          <Card>
            <EmptyState icon={<HandHeart className="h-8 w-8" aria-hidden />} title={t('dua.noResults')} />
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-border">
              {matches.map(({ item, category }) => (
                <li key={item.id} className="py-4">
                  <p className="mb-2 text-xs font-semibold text-accent">
                    {category.englishTitle ?? category.arabicTitle}
                  </p>
                  <ArabicText>{item.arabic}</ArabicText>
                  {item.english ? (
                    <p className="mt-3 text-sm leading-relaxed text-muted">{item.english}</p>
                  ) : null}
                  <DhikrCounter id={`dua:${item.id}`} target={item.count} />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <SourceLine label={t('common.source')}>{category.reference}</SourceLine>
                    <ContentActions
                      id={`dua:${item.id}`}
                      kind="dua"
                      title={category.englishTitle ?? category.arabicTitle}
                      excerpt={item.arabic.slice(0, 120)}
                      shareText={`${item.arabic}\n\n${category.reference}`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )
      ) : (
        <>
          <QuranicDuas />

          <Card>
            <CardHeader title={t('dua.categories')} />
            <div className="flex flex-wrap gap-1.5">
              <Chip active={activeCategory === null} onClick={() => setActiveCategory(null)}>
                {t('dua.allDuas')}
              </Chip>
              {adhkarCategories.map((category) => (
                <Chip
                  key={category.id}
                  active={activeCategory === category.id}
                  onClick={() => setActiveCategory(category.id)}
                >
                  {category.englishTitle ?? category.arabicTitle}
                </Chip>
              ))}
            </div>
          </Card>

          {activeCategory === null ? (
            <div className="space-y-3">
              {adhkarCategories.map((category) => (
                <HisnCategory key={category.id} categoryId={category.id} />
              ))}
            </div>
          ) : (
            <HisnCategory categoryId={activeCategory} />
          )}
        </>
      )}

      <p className={clsx('pb-2 text-center text-[11px] leading-relaxed text-muted')}>
        {t('dua.provenance')}
      </p>
    </div>
  );
}
