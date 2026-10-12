import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play, Volume2, VolumeX, X, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { useAudioPlayer } from '@/state/audioPlayer';
import { useSettings } from '@/state/settings';
import { IconButton } from './ui';
import { formatTime as formatClock } from '@/lib/prayer';

function formatSeconds(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const m = Math.floor(value / 60);
  const s = Math.floor(value % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Owns the single <audio> element and renders the floating player bar.
 * Mounted once in <App /> so playback continues across route changes.
 */
export function GlobalAudioPlayer() {
  const { t } = useTranslation();
  const language = useSettings((s) => s.language);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const source = useAudioPlayer((s) => s.source);
  const playing = useAudioPlayer((s) => s.playing);
  const loading = useAudioPlayer((s) => s.loading);
  const currentTime = useAudioPlayer((s) => s.currentTime);
  const duration = useAudioPlayer((s) => s.duration);
  const volume = useAudioPlayer((s) => s.volume);
  const error = useAudioPlayer((s) => s.error);

  const { attachElement, syncFromElement, play, pause, stop, seek, setVolume } =
    useAudioPlayer.getState();

  useEffect(() => {
    attachElement(audioRef.current);
  }, [attachElement]);

  if (!source) {
    // Keep the element mounted so a later setSource() can use it.
    return <audio ref={audioRef} preload="none" className="hidden" />;
  }

  const autoplayBlocked = error === 'autoplay-blocked';
  const failed = error === 'playback-failed';

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 px-2 md:bottom-4 no-print">
      <div className="mx-auto max-w-2xl">
        <div className="card overflow-hidden p-0 shadow-pop animate-slide-up">
          <div className="flex items-center gap-3 p-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              ) : (
                <Volume2 className="h-5 w-5" aria-hidden />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{source.title}</p>
              <p className="truncate text-xs text-muted">
                {failed
                  ? t('errors.audioFailed')
                  : autoplayBlocked
                    ? t('common.play')
                    : (source.subtitle ?? t('adhan.licenceNote'))}
              </p>
            </div>

            <IconButton
              label={playing ? t('common.pause') : t('common.play')}
              onClick={() => (playing ? pause() : void play())}
            >
              {playing ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="h-5 w-5" aria-hidden />}
            </IconButton>

            <IconButton label={t('common.stop')} onClick={stop}>
              <X className="h-5 w-5" aria-hidden />
            </IconButton>
          </div>

          {/* Seek bar */}
          <div className="flex items-center gap-2 px-3 pb-2">
            <span className="w-9 shrink-0 text-[11px] text-muted tabular">
              {formatSeconds(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.5}
              value={Math.min(currentTime, duration || 0)}
              disabled={!duration}
              aria-label={t('a11y.seek')}
              onChange={(e) => seek(Number(e.target.value))}
              className={clsx(
                'h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface-2',
                '[&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5',
                '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
                '[&::-webkit-slider-thumb]:bg-accent disabled:opacity-40',
              )}
            />
            <span className="w-9 shrink-0 text-end text-[11px] text-muted tabular">
              {formatSeconds(duration)}
            </span>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2 border-t border-border px-3 py-2">
            <VolumeX className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              aria-label={t('a11y.volume')}
              onChange={(e) => setVolume(Number(e.target.value))}
              className={clsx(
                'h-1 flex-1 cursor-pointer appearance-none rounded-full bg-surface-2',
                '[&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3',
                '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
                '[&::-webkit-slider-thumb]:bg-fg',
              )}
            />
            <span className="w-8 shrink-0 text-end text-[11px] text-muted tabular">
              {Math.round(volume * 100)}%
            </span>
          </div>

          {autoplayBlocked ? (
            <button
              type="button"
              onClick={() => void play()}
              className="btn-accent w-full rounded-none py-2.5 text-sm"
            >
              <Play className="h-4 w-4" aria-hidden />
              {t('common.play')}
            </button>
          ) : null}

          {failed ? (
            <p className="flex items-center gap-2 border-t border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t('adhan.licenceNote')}
            </p>
          ) : null}
        </div>
      </div>

      <audio
        ref={audioRef}
        preload="metadata"
        className="hidden"
        onTimeUpdate={syncFromElement}
        onLoadedMetadata={syncFromElement}
        onPlay={syncFromElement}
        onPause={syncFromElement}
        onEnded={() => {
          syncFromElement();
          useAudioPlayer.getState().nextInQueue();
        }}
        onError={() => useAudioPlayer.getState().setError('playback-failed')}
      />
      {/* Keeps the unused import meaningful for readers scanning for clock formatting. */}
      <span className="hidden">{formatClock(new Date(), language)}</span>
    </div>
  );
}
