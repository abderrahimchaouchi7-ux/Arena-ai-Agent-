import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AudioLines,
  Bell,
  Check,
  CircleAlert,
  Download,
  Loader2,
  Music2,
  Pause,
  Play,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Button, Card, CardHeader, Notice, PageHeader, ProgressBar } from '@/components/ui';
import {
  ADHAN_CATALOGUE,
  adhanLocalKey,
  downloadAudio,
  importAudioFile,
  playNotificationTone,
  probeAudioUrl,
  removeImportedAudio,
  resolvePlayable,
} from '@/lib/audio';
import { useAudioPlayer } from '@/state/audioPlayer';
import { useSettings } from '@/state/settings';
import { mediaHas } from '@/lib/db';
import type { AdhanRecording } from '@/lib/types';

type ProbeState = 'idle' | 'checking' | 'available' | 'unavailable';

interface RecordingCardState {
  probe: ProbeState;
  hasLocal: boolean;
  progress: number | null;
  downloading: boolean;
  importFailed: string | null;
}

const initialState: RecordingCardState = {
  probe: 'idle',
  hasLocal: false,
  progress: null,
  downloading: false,
  importFailed: null,
};

function RecordingCard({
  recording,
  isDefault,
  onMakeDefault,
}: {
  recording: AdhanRecording;
  isDefault: boolean;
  onMakeDefault: () => void;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<RecordingCardState>(initialState);

  const source = useAudioPlayer((s) => s.source);
  const playing = useAudioPlayer((s) => s.playing);
  const setSource = useAudioPlayer((s) => s.setSource);
  const pause = useAudioPlayer((s) => s.pause);
  const play = useAudioPlayer((s) => s.play);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const localKey = adhanLocalKey(recording.id);
  const cardTitle = `${t('adhan.muezzin')}: ${recording.muezzin}`;
  const isThis = source?.origin === 'adhan' && source?.title === cardTitle;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const hasLocal = await mediaHas(localKey);
      if (cancelled) return;
      setState((s) => ({ ...s, hasLocal }));

      // Only probe remote sources — a locally stored file always plays.
      if (!hasLocal && recording.src) {
        setState((s) => ({ ...s, probe: 'checking' }));
        const result = await probeAudioUrl(recording.src);
        if (!cancelled) setState((s) => ({ ...s, probe: result === 'unknown' ? 'idle' : result }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [localKey, recording.src]);

  const handlePlay = async () => {
    if (isThis && playing) {
      pause();
      return;
    }
    if (isThis && !playing) {
      await play();
      return;
    }
    const playable = await resolvePlayable(recording.id);
    if (!playable.playable || !playable.url) return;
    setSource({
      url: playable.url,
      origin: 'adhan',
      title: cardTitle,
      subtitle: recording.location ?? t('adhan.licenceNote'),
    });
  };

  const handleDownload = async () => {
    if (!recording.src) return;
    setState((s) => ({ ...s, downloading: true, progress: 0 }));
    const result = await downloadAudio(
      localKey,
      recording.src,
      (fraction) => setState((s) => ({ ...s, progress: fraction })),
      recording.muezzin,
    );
    setState((s) => ({
      ...s,
      downloading: false,
      progress: null,
      hasLocal: result.ok,
      importFailed: result.ok ? null : result.error,
    }));
  };

  const handleImport = async (file: File) => {
    const result = await importAudioFile(localKey, file);
    setState((s) => ({
      ...s,
      hasLocal: result.ok,
      probe: result.ok ? 'available' : s.probe,
      importFailed: result.ok
        ? null
        : result.error === 'too-large'
          ? 'too-large'
          : 'not-audio',
    }));
  };

  const handleRemoveLocal = async () => {
    await removeImportedAudio(localKey);
    setState((s) => ({ ...s, hasLocal: false, probe: 'idle', importFailed: null }));
  };

  const playable = state.hasLocal || recording.src !== null;
  const remoteUnreachable = !state.hasLocal && state.probe === 'unavailable';

  return (
    <Card className={clsx(isDefault && 'border-accent/50')}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={handlePlay}
          disabled={!playable}
          aria-label={`${playing && isThis ? t('common.pause') : t('common.play')} — ${recording.muezzin}`}
          className={clsx(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-all duration-150 active:scale-95',
            playable ? 'bg-accent/15 text-accent hover:bg-accent/25' : 'bg-surface-2 text-muted/50',
          )}
        >
          {state.downloading ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : isThis && playing ? (
            <Pause className="h-5 w-5" aria-hidden />
          ) : (
            <Play className="h-5 w-5" aria-hidden />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">{recording.muezzin}</p>
              {recording.location ? (
                <p className="truncate text-xs text-muted">{recording.location}</p>
              ) : null}
            </div>
            {isDefault ? (
              <span className="chip chip-active shrink-0">
                <Check className="h-3 w-3" aria-hidden />
                {t('adhan.currentDefault')}
              </span>
            ) : null}
          </div>

          {state.hasLocal ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
              <Volume2 className="h-3.5 w-3.5" aria-hidden />
              {t('common.downloaded')}
            </p>
          ) : state.probe === 'checking' ? (
            <p className="mt-1.5 text-xs text-muted">{t('adhan.probeChecking')}</p>
          ) : state.probe === 'available' ? (
            <p className="mt-1.5 text-xs text-success">{t('adhan.probeAvailable')}</p>
          ) : remoteUnreachable ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-warning">
              <CircleAlert className="h-3.5 w-3.5" aria-hidden />
              {t('adhan.probeUnavailable')}
            </p>
          ) : null}

          {state.importFailed ? (
            <p className="mt-1.5 text-xs text-danger">
              {state.importFailed === 'too-large' ? t('errors.storage') : t('errors.audioFailed')}
            </p>
          ) : null}

          {state.progress !== null ? (
            <ProgressBar className="mt-2" value={state.progress * 100} />
          ) : null}
        </div>
      </div>

      {!playable ? (
        <div className="mt-3">
          <Notice tone="warning" title={t('adhan.noSourceTitle')}>
            {t('adhan.noSourceBody')}
          </Notice>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!isDefault ? (
          <Button size="sm" variant="outline" onClick={onMakeDefault}>
            {t('adhan.setAsDefault')}
          </Button>
        ) : null}

        {recording.src && !state.hasLocal ? (
          <Button
            size="sm"
            variant="ghost"
            loading={state.downloading}
            onClick={handleDownload}
            icon={<Download className="h-4 w-4" aria-hidden />}
          >
            {state.downloading ? t('common.downloading') : t('adhan.downloadForOffline')}
          </Button>
        ) : null}

        {state.hasLocal ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRemoveLocal}
            icon={<Trash2 className="h-4 w-4" aria-hidden />}
          >
            {t('adhan.removeImported')}
          </Button>
        ) : (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImport(file);
                e.target.value = '';
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => fileInput.current?.click()}
              icon={<Upload className="h-4 w-4" aria-hidden />}
            >
              {t('common.import')}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

export default function AdhanLibraryPage() {
  const { t } = useTranslation();
  const preferredAdhanId = useSettings((s) => s.preferredAdhanId);
  const setPreferredAdhan = useSettings((s) => s.setPreferredAdhan);
  const volume = useSettings((s) => s.volume);
  const [tonePreviewing, setTonePreviewing] = useState(false);

  const handleTonePreview = async () => {
    setTonePreviewing(true);
    await playNotificationTone(volume);
    window.setTimeout(() => setTonePreviewing(false), 1400);
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('adhan.library')} subtitle={t('adhan.subtitle')} />

      <Notice tone="info" title={t('common.provenance')}>
        {t('adhan.licenceNote')}
      </Notice>

      <div className="grid gap-3 sm:grid-cols-2">
        {ADHAN_CATALOGUE.map((recording) => (
          <RecordingCard
            key={recording.id}
            recording={recording}
            isDefault={recording.id === preferredAdhanId}
            onMakeDefault={() => setPreferredAdhan(recording.id)}
          />
        ))}
      </div>

      <Card>
        <CardHeader
          icon={<Bell className="h-5 w-5" aria-hidden />}
          title={t('adhan.toneTitle')}
          subtitle={t('adhan.toneBody')}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTonePreview}
            loading={tonePreviewing}
            icon={<Music2 className="h-4 w-4" aria-hidden />}
          >
            {t('adhan.previewTone')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setPreferredAdhan('__tone__')}>
            {t('adhan.setAsDefault')}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          icon={<AudioLines className="h-5 w-5" aria-hidden />}
          title={t('adhan.silentTitle')}
          subtitle={t('adhan.silentBody')}
        />
        <Button variant="ghost" size="sm" onClick={() => setPreferredAdhan('__silent__')}>
          {t('adhan.setAsDefault')}
        </Button>
      </Card>

      <p className="text-xs text-muted">{t('adhan.probeNote')}</p>
    </div>
  );
}
