import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Repeat,
  Sunrise,
  Sunset,
  Search,
  ShieldCheck,
  Utensils,
  Plane,
  Home as HomeIcon,
  Landmark,
  MoonStar,
  Sun,
  HeartHandshake,
} from 'lucide-react';
import { Card, CardHeader, Chip, EmptyState, Notice, PageHeader, ProgressBar } from '@/components/ui';
import {
  ArabicText,
  ContentActions,
  DhikrCounter,
  GradeBadge,
  SourceLine,
} from '@/components/content';
import {
  ADHKAR_GROUPS,
  adhkarCategories,
  adhkarGroupOf,
  morningEveningItems,
} from '@/lib/data';
import { normaliseArabic } from '@/lib/search';
import { useDebounced, useNow } from '@/hooks';
import { useUserData } from '@/state/userData';
import { clsx } from 'clsx';
import type { MorningEveningItem } from '@/lib/types';

const GROUP_ICONS: Record<string, typeof Sunrise> = {
  morning: Sunrise,
  sleeping: MoonStar,
  waking: Sun,
  afterPrayer: Repeat,
  mosque: Landmark,
  home: HomeIcon,
  travel: Plane,
  food: Utensils,
  protection: ShieldCheck,
};

/** Morning adhkar are recommended after Fajr, evening ones after 'Asr. */
function recommendedTimeKey(period: 'morning' | 'evening'): string {
  return period === 'morning' ? 'adhkar.morningTime' : 'adhkar.eveningTime';
}

function MorningEveningList({ period }: { period: 'morning' | 'evening' }) {
  const { t } = useTranslation();
  const items = useMemo(
    () => morningEveningItems.filter((i) => i.period === period),
    [period],
  );
  const counters = useUserData((s) => s.counters);
  const now = useNow(60000);
  const today = now.toISOString().slice(0, 10);

  const completed = items.filter(
    (i) => (counters[i.id]?.date === today ? counters[i.id].done : 0) >= i.count,
  ).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          icon={period === 'morning' ? <Sunrise className="h-5 w-5" aria-hidden /> : <Sunset className="h-5 w-5" aria-hidden />}
          title={t(period === 'morning' ? 'adhkar.morning' : 'adhkar.evening')}
          subtitle={t(recommendedTimeKey(period))}
        />
        <ProgressBar value={completed} max={Math.max(1, items.length)} />
        <p className="mt-2 text-xs text-muted tabular">
          {completed} / {items.length}
        </p>
      </Card>

      <Notice tone="info" title={t('adhkar.gradedBy')}>
        {t('adhkar.gradingNote')} {t('adhkar.morningEveningSource')}.
      </Notice>

      {items.map((item: MorningEveningItem) => {
        const done = counters[item.id]?.date === today ? counters[item.id].done : 0;
        return (
          <Card key={item.id}>
            <ArabicText>{item.arabic}</ArabicText>

            {item.english ? (
              <p className="mt-3 border-t border-dashed border-border pt-3 text-sm leading-relaxed text-muted">
                {item.english}
              </p>
            ) : (
              <p className="mt-3 border-t border-dashed border-border pt-3 text-xs italic text-muted">
                {t('common.translationUnavailable')}
              </p>
            )}

            {item.virtue ? (
              <p className="mt-3 text-xs leading-relaxed text-muted" dir="rtl" lang="ar">
                <span className="font-semibold">{t('adhkar.virtue')}: </span>
                {item.virtue}
              </p>
            ) : null}

            <DhikrCounter id={item.id} target={item.count} />

            {item.countDescription ? (
              <p className="mt-2 text-xs text-muted" dir="rtl" lang="ar">
                {t('common.count')}: {item.countDescription}
              </p>
            ) : null}

            {item.source ? (
              <div className="mt-3 border-t border-border pt-3">
                <SourceLine label={t('common.reference')}>
                  <span dir="rtl" lang="ar">
                    {item.source}
                  </span>
                </SourceLine>
                <div className="mt-2">
                  <GradeBadge>{t('adhkar.gradedBy')}</GradeBadge>
                </div>
              </div>
            ) : null}

            <div className="mt-3 flex justify-end">
              <ContentActions
                id={`adhkar-me:${item.id}`}
                kind="adhkar"
                title={t(period === 'morning' ? 'adhkar.morning' : 'adhkar.evening')}
                excerpt={item.arabic.slice(0, 120)}
                shareText={`${item.arabic}\n\n${item.source ?? ''}`.trim()}
              />
            </div>

            {done >= item.count ? (
              <p className="mt-2 text-xs font-semibold text-success">{t('dua.counterDone')}</p>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

function GroupView({ groupId }: { groupId: string }) {
  const { t } = useTranslation();
  const group = ADHKAR_GROUPS.find((g) => g.id === groupId);
  const categories = adhkarCategories.filter((c) => adhkarGroupOf(c) === groupId);
  const items = categories.flatMap((c) => c.items.map((item) => ({ item, category: c })));

  if (!group || items.length === 0) {
    return (
      <Card>
        <EmptyState icon={<Repeat className="h-8 w-8" aria-hidden />} title={t('common.empty')} />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Notice tone="info" title={t('common.provenance')}>{t('dua.provenance')}</Notice>
      {items.map(({ item, category }) => (
        <Card key={item.id}>
          <p className="mb-2 text-xs font-semibold text-accent">
            {category.englishTitle ?? category.arabicTitle}
          </p>
          <ArabicText>{item.arabic}</ArabicText>
          {item.transliteration ? (
            <p className="mt-2 border-t border-dashed border-border pt-2 text-sm italic text-muted">
              {item.transliteration}
            </p>
          ) : null}
          {item.english ? (
            <p className="mt-3 border-t border-dashed border-border pt-3 text-sm leading-relaxed text-muted">
              {item.english}
            </p>
          ) : (
            <p className="mt-3 border-t border-dashed border-border pt-3 text-xs italic text-muted">
              {t('common.translationUnavailable')}
            </p>
          )}
          <DhikrCounter id={`adhkar:${item.id}`} target={item.count} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <SourceLine label={t('common.source')}>{category.reference}</SourceLine>
            <ContentActions
              id={`adhkar:${item.id}`}
              kind="adhkar"
              title={category.englishTitle ?? category.arabicTitle}
              excerpt={item.arabic.slice(0, 120)}
              shareText={`${item.arabic}\n\n${category.reference}`}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function AdhkarPage() {
  const { t } = useTranslation();
  const { groupId } = useParams<{ groupId?: string }>();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 220);

  const results = useMemo(() => {
    const raw = debounced.trim().toLowerCase();
    if (raw.length < 2) return null;
    const needleAr = normaliseArabic(debounced);
    const hisn = adhkarCategories
      .flatMap((category) =>
        category.items
          .filter(
            (item) =>
              normaliseArabic(item.arabic).includes(needleAr) ||
              (item.english ?? '').toLowerCase().includes(raw),
          )
          .map((item) => ({ item, category, source: category.reference })),
      )
      .slice(0, 40);

    const me = morningEveningItems
      .filter(
        (item) =>
          normaliseArabic(item.arabic).includes(needleAr) ||
          (item.english ?? '').toLowerCase().includes(raw),
      )
      .slice(0, 20);

    return { hisn, me };
  }, [debounced]);

  if (groupId === 'morning' || groupId === 'evening') {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t(groupId === 'morning' ? 'adhkar.morning' : 'adhkar.evening')}
          subtitle={t('adhkar.subtitle')}
        />
        <MorningEveningList period={groupId} />
      </div>
    );
  }

  if (groupId) {
    return (
      <div className="space-y-4">
        <PageHeader title={t(`adhkar.${groupId}`)} subtitle={t('adhkar.subtitle')} />
        <GroupView groupId={groupId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('adhkar.title')} subtitle={t('adhkar.subtitle')} />

      <div className="relative">
        <Search
          className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-muted ltr:left-3 rtl:right-3"
          aria-hidden
        />
        <input
          className="field ltr:pl-9 rtl:pr-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('adhkar.searchPlaceholder')}
          aria-label={t('adhkar.searchPlaceholder')}
        />
      </div>

      {results ? (
        <div className="space-y-3">
          {results.hisn.length === 0 && results.me.length === 0 ? (
            <Card>
              <EmptyState icon={<Repeat className="h-8 w-8" aria-hidden />} title={t('adhkar.noResults')} />
            </Card>
          ) : null}

          {results.me.map((item) => (
            <Card key={item.id}>
              <p className="mb-2 text-xs font-semibold text-accent">
                {item.period === 'morning' ? t('adhkar.morning') : t('adhkar.evening')}
              </p>
              <ArabicText>{item.arabic}</ArabicText>
              {item.english ? (
                <p className="mt-3 text-sm leading-relaxed text-muted">{item.english}</p>
              ) : null}
              <DhikrCounter id={item.id} target={item.count} />
              {item.source ? (
                <SourceLine className="mt-3 border-t border-border pt-3" label={t('common.reference')}>
                  <span dir="rtl" lang="ar">
                    {item.source}
                  </span>
                </SourceLine>
              ) : null}
            </Card>
          ))}

          {results.hisn.map(({ item, category }) => (
            <Card key={item.id}>
              <p className="mb-2 text-xs font-semibold text-accent">
                {category.englishTitle ?? category.arabicTitle}
              </p>
              <ArabicText>{item.arabic}</ArabicText>
              {item.english ? (
                <p className="mt-3 text-sm leading-relaxed text-muted">{item.english}</p>
              ) : null}
              <DhikrCounter id={`adhkar:${item.id}`} target={item.count} />
              <SourceLine className="mt-3 border-t border-border pt-3" label={t('common.source')}>
                {category.reference}
              </SourceLine>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Morning & evening get prominence: they are the most-used adhkar. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => navigate('/adhkar/morning')}
              className="card ornament p-5 text-start transition-all duration-150 hover:border-accent/40 active:scale-[0.99]"
            >
              <Sunrise className="h-6 w-6 text-accent" aria-hidden />
              <p className="mt-2 font-bold">{t('adhkar.morning')}</p>
              <p className="text-xs text-muted">{t('adhkar.morningTime')}</p>
            </button>
            <button
              type="button"
              onClick={() => navigate('/adhkar/evening')}
              className="card ornament p-5 text-start transition-all duration-150 hover:border-accent/40 active:scale-[0.99]"
            >
              <Sunset className="h-6 w-6 text-accent" aria-hidden />
              <p className="mt-2 font-bold">{t('adhkar.evening')}</p>
              <p className="text-xs text-muted">{t('adhkar.eveningTime')}</p>
            </button>
          </div>

          <Card>
            <CardHeader icon={<Repeat className="h-5 w-5" aria-hidden />} title={t('adhkar.all')} />
            <div className="grid gap-2 sm:grid-cols-2">
              {ADHKAR_GROUPS.filter((g) => g.id !== 'morning').map((group) => {
                const Icon = GROUP_ICONS[group.id] ?? HeartHandshake;
                const count = adhkarCategories.filter(
                  (c) => adhkarGroupOf(c) === group.id,
                ).reduce((n, c) => n + c.items.length, 0);
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => navigate(`/adhkar/${group.id}`)}
                    className={clsx(
                      'flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 text-start transition-colors hover:border-accent/40',
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0 text-accent" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{t(group.key)}</span>
                      <span className="block text-xs text-muted tabular">
                        {t('dua.itemsInCategory', { count })}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader title={t('adhkar.hisnSource')} />
            <div className="flex flex-wrap gap-1.5">
              {adhkarCategories.map((category) => (
                <Chip
                  key={category.id}
                  onClick={() => {
                    const group = adhkarGroupOf(category);
                    navigate(group ? `/adhkar/${group}` : `/dua`);
                  }}
                >
                  {category.englishTitle ?? category.arabicTitle}
                </Chip>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
