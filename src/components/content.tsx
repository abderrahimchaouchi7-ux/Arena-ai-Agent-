import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark, BookmarkCheck, Copy, Share2, RotateCcw, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { IconButton } from './ui';
import { copyText, shareContent } from '@/lib/share';
import { useUserData } from '@/state/userData';

/** Right-aligned Arabic block using the Quranic/Arabic font stack. */
export function ArabicText({
  children,
  className,
  quran = false,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  quran?: boolean;
  id?: string;
}) {
  return (
    <p
      id={id}
      dir="rtl"
      lang="ar"
      className={clsx(quran ? 'quran-text' : 'arabic-text text-xl sm:text-2xl', className)}
    >
      {children}
    </p>
  );
}

/** Latin transliteration, visually separated from the Arabic above it. */
export function Transliteration({ children }: { children: React.ReactNode }) {
  return (
    <p dir="ltr" className="mt-2 border-t border-dashed border-border pt-2 text-sm italic text-muted">
      {children}
    </p>
  );
}

export function SourceLine({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={clsx('text-xs leading-relaxed text-muted', className)}>
      <span className="font-semibold text-fg/80">{label}: </span>
      <span dir="auto">{children}</span>
    </p>
  );
}

/** Copy + share + bookmark row shared by every content type. */
export function ContentActions({
  id,
  kind,
  title,
  excerpt,
  shareText,
  className,
}: {
  id: string;
  kind: 'ayah' | 'dua' | 'adhkar' | 'hadith';
  title: string;
  excerpt: string;
  shareText: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const { bookmarks, toggleBookmark } = useUserData();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const bookmarked = bookmarks.some((b) => b.id === id);

  const handleCopy = async () => {
    const result = await copyText(shareText);
    setCopied(result.ok);
    setFailed(!result.ok);
    window.setTimeout(() => {
      setCopied(false);
      setFailed(false);
    }, 1800);
  };

  const handleShare = async () => {
    const result = await shareContent({ title, text: shareText });
    if (!result.ok && result.reason === 'unsupported') {
      await handleCopy();
    }
  };

  return (
    <div className={clsx('flex items-center gap-1', className)}>
      <IconButton label={bookmarked ? t('common.bookmarked') : t('common.bookmark')} active={bookmarked}
        onClick={() => toggleBookmark({ id, kind, title, excerpt })}>
        {bookmarked ? <BookmarkCheck className="h-[18px] w-[18px]" aria-hidden /> : <Bookmark className="h-[18px] w-[18px]" aria-hidden />}
      </IconButton>
      <IconButton label={t('common.copy')} onClick={handleCopy}>
        {copied ? (
          <Check className="h-[18px] w-[18px] text-success" aria-hidden />
        ) : (
          <Copy className="h-[18px] w-[18px]" aria-hidden />
        )}
      </IconButton>
      <IconButton label={t('common.share')} onClick={handleShare}>
        <Share2 className="h-[18px] w-[18px]" aria-hidden />
      </IconButton>
      {copied ? <span className="text-xs text-success">{t('common.copied')}</span> : null}
      {failed ? <span className="text-xs text-danger">{t('common.copyFailed')}</span> : null}
    </div>
  );
}

/**
 * Tap-to-count repetition counter.
 *
 * The target comes from the source (Hisn al-Muslim "count", or the morning /
 * evening database). Counting past the target is allowed — some people prefer
 * to keep going — but the button marks completion at the target.
 */
export function DhikrCounter({
  id,
  target,
  compact = false,
}: {
  id: string;
  target: number;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { counterValue, incrementCounter, resetCounter } = useUserData();
  const done = counterValue(id);
  const complete = done >= target;

  const ringSize = compact ? 62 : 84;
  const stroke = compact ? 4 : 5;
  const radius = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.min(1, target > 0 ? done / target : 0);

  return (
    <div className={clsx('flex items-center gap-3', compact ? '' : 'mt-3')}>
      <button
        type="button"
        onClick={() => incrementCounter(id)}
        aria-label={`${t('dua.tapToCount')} — ${done} / ${target}`}
        className={clsx(
          'relative shrink-0 rounded-full transition-transform duration-150 active:scale-95',
          complete && 'opacity-90',
        )}
        style={{ width: ringSize, height: ringSize }}
      >
        <svg width={ringSize} height={ringSize} className="-rotate-90" aria-hidden>
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-surface-2"
          />
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fraction)}
            className={clsx(
              'transition-[stroke-dashoffset] duration-300 ease-smooth',
              complete ? 'stroke-success' : 'stroke-accent',
            )}
          />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={clsx('font-bold tabular', compact ? 'text-base' : 'text-xl')}>{done}</span>
          <span className="text-[10px] text-muted tabular">/ {target}</span>
        </span>
      </button>

      <div className="min-w-0">
        <p className="text-sm font-medium">
          {complete ? t('dua.counterDone') : t('dua.tapToCount')}
        </p>
        <p className="text-xs text-muted">
          {target} {t('common.times')}
        </p>
        {done > 0 ? (
          <button
            type="button"
            onClick={() => resetCounter(id)}
            className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            {t('dua.resetCounter')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Small pill showing an authenticity/reference note exactly as sourced. */
export function GradeBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted">
      <span dir="auto">{children}</span>
    </span>
  );
}
