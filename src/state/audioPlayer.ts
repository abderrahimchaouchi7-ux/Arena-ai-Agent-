/**
 * Global audio player.
 *
 * A single <audio> element is owned by this store so the Adhan library, the
 * notification preview and verse-by-verse Quran recitation never fight over two
 * players at once. Playback state is exposed for the UI; nothing here invents
 * a source — `setSource` rejects null and the caller must show why.
 */
import { create } from 'zustand';

export type PlayerOrigin = 'adhan' | 'quran' | 'tone';

export interface PlayerSource {
  url: string;
  origin: PlayerOrigin;
  /** Display title, e.g. the muezzin's name or "Al-Baqarah 2:255". */
  title: string;
  subtitle?: string;
  /** For Quran playback, so the reader can highlight the active verse. */
  surah?: number;
  ayah?: number;
}

interface AudioState {
  source: PlayerSource | null;
  playing: boolean;
  loading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  error: string | null;
  /** Queue of Quran verses for continuous recitation. */
  queue: { surah: number; ayah: number }[];
  queueIndex: number;

  setSource: (source: PlayerSource | null) => void;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  setError: (message: string | null) => void;
  setQueue: (queue: { surah: number; ayah: number }[], startIndex?: number) => void;
  nextInQueue: () => void;
  /** Internal: wired to the real <audio> element by <GlobalAudioPlayer />. */
  attachElement: (el: HTMLAudioElement | null) => void;
  syncFromElement: () => void;
}

let element: HTMLAudioElement | null = null;

export const useAudioPlayer = create<AudioState>((set, get) => ({
  source: null,
  playing: false,
  loading: false,
  currentTime: 0,
  duration: 0,
  volume: 0.9,
  error: null,
  queue: [],
  queueIndex: -1,

  attachElement: (el) => {
    element = el;
    if (el) el.volume = get().volume;
  },

  syncFromElement: () => {
    if (!element) return;
    set({
      playing: !element.paused && !element.ended,
      loading: element.readyState < 3,
      currentTime: Number.isFinite(element.currentTime) ? element.currentTime : 0,
      duration: Number.isFinite(element.duration) ? element.duration : 0,
    });
  },

  setSource: (source) => {
    if (!element) {
      set({ source, error: 'audio-unavailable', playing: false });
      return;
    }
    if (!source) {
      element.pause();
      element.removeAttribute('src');
      element.load();
      set({ source: null, playing: false, currentTime: 0, duration: 0, error: null });
      return;
    }
    set({ source, error: null, loading: true, currentTime: 0 });
    element.src = source.url;
    element.load();
    void get().play();
  },

  play: async () => {
    if (!element || !get().source) return;
    element.volume = get().volume;
    set({ loading: true });
    try {
      await element.play();
      set({ playing: true, loading: false, error: null });
    } catch (err) {
      // Autoplay can be blocked until the user interacts with the page.
      set({
        playing: false,
        loading: false,
        error:
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'autoplay-blocked'
            : 'playback-failed',
      });
    }
  },

  pause: () => {
    element?.pause();
    set({ playing: false });
  },

  stop: () => {
    if (element) {
      element.pause();
      element.currentTime = 0;
    }
    set({ playing: false, currentTime: 0, queue: [], queueIndex: -1 });
  },

  seek: (seconds) => {
    if (!element) return;
    const target = Math.max(0, Math.min(element.duration || seconds, seconds));
    element.currentTime = target;
    set({ currentTime: target });
  },

  setVolume: (v) => {
    const volume = Math.min(1, Math.max(0, v));
    if (element) element.volume = volume;
    set({ volume });
  },

  setError: (error) => set({ error }),

  setQueue: (queue, startIndex = 0) => set({ queue, queueIndex: startIndex }),

  nextInQueue: () => {
    const { queue, queueIndex } = get();
    if (queue.length === 0) return;
    const next = queueIndex + 1;
    if (next >= queue.length) {
      set({ queueIndex: -1, playing: false });
      return;
    }
    set({ queueIndex: next });
  },
}));

export function currentQueueVerse(): { surah: number; ayah: number } | null {
  const { queue, queueIndex } = useAudioPlayer.getState();
  return queueIndex >= 0 && queue[queueIndex] ? queue[queueIndex] : null;
}
