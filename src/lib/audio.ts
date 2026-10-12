/**
 * Audio playback + Adhan/Quran recording catalogue.
 *
 * Two hard rules this file enforces:
 *
 * 1. Nothing is faked. A recording with `src === null` and no locally imported
 *    file cannot play, and `resolvePlayable()` says so instead of pretending.
 * 2. No copyrighted Adhan recording is bundled or redistributed. Recordings are
 *    streamed from the operator-configured host, or imported by the user from a
 *    file they hold the rights to. See docs/DATA-SOURCES.md.
 */
import type { AdhanRecording } from './types';
import { mediaObjectUrl, mediaGet, mediaPut, mediaDelete } from './db';

/**
 * Optional base URL for self-hosted / licensed Adhan audio.
 * Set VITE_ADHAN_BASE_URL at build time to serve your own recordings.
 * It is a *public* URL by design — never put a secret here.
 */
const ADHAN_BASE_URL: string =
  (import.meta.env.VITE_ADHAN_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

/**
 * The catalogue. Every entry names a real muezzin or mosque so the attribution
 * is honest, but `src` is null unless the operator has configured a licensed
 * host — the UI then explains that and offers the import path.
 */
export const ADHAN_CATALOGUE: AdhanRecording[] = [
  {
    id: 'makkah-haram',
    muezzin: 'Sheikh Ali Ahmed Mulla',
    location: 'Masjid al-Haram, Makkah',
    provenanceKey: 'adhan.provenance.makkah',
    src: ADHAN_BASE_URL ? `${ADHAN_BASE_URL}/makkah-haram.mp3` : null,
  },
  {
    id: 'madinah-nabawi',
    muezzin: 'Sheikh Abdul Rahman Khashoggi',
    location: 'Masjid an-Nabawi, Madinah',
    provenanceKey: 'adhan.provenance.madinah',
    src: ADHAN_BASE_URL ? `${ADHAN_BASE_URL}/madinah-nabawi.mp3` : null,
  },
  {
    id: 'alafasy',
    muezzin: 'Sheikh Mishary Rashid Alafasy',
    provenanceKey: 'adhan.provenance.alafasy',
    src: ADHAN_BASE_URL ? `${ADHAN_BASE_URL}/alafasy.mp3` : null,
  },
  {
    id: 'abdul-basit',
    muezzin: 'Sheikh Abdul Basit Abdus Samad',
    provenanceKey: 'adhan.provenance.abdulBasit',
    src: ADHAN_BASE_URL ? `${ADHAN_BASE_URL}/abdul-basit.mp3` : null,
  },
  {
    id: 'al-aqsa',
    muezzin: 'Masjid al-Aqsa muadhdhin',
    location: 'Masjid al-Aqsa, Jerusalem',
    provenanceKey: 'adhan.provenance.aqsa',
    src: ADHAN_BASE_URL ? `${ADHAN_BASE_URL}/al-aqsa.mp3` : null,
  },
  {
    id: 'egypt-classic',
    muezzin: 'Sheikh Muhammad Rifat (classic Egyptian style)',
    location: 'Cairo, Egypt',
    provenanceKey: 'adhan.provenance.egypt',
    src: ADHAN_BASE_URL ? `${ADHAN_BASE_URL}/egypt-classic.mp3` : null,
  },
  {
    id: 'sabah-fajr',
    muezzin: 'Fajr Adhan (extended, with tarjee\u2018)',
    provenanceKey: 'adhan.provenance.fajr',
    src: ADHAN_BASE_URL ? `${ADHAN_BASE_URL}/fajr-extended.mp3` : null,
  },
];

export function getAdhanRecording(id: string): AdhanRecording | undefined {
  return ADHAN_CATALOGUE.find((r) => r.id === id);
}

/* ------------------------------------------------- Quran recitation hosts -- */

/**
 * Per-ayah recitation via everyayah.com, the long-standing public host used by
 * Quran.com, Islamic Network and many open apps. Files are streamed, never
 * re-hosted by this project.
 *
 * URL shape: https://everyayah.com/data/{recitation}/{SSS}{AAA}.mp3
 * e.g. 002255.mp3 = surah 2, ayah 255.
 */
export const QURAN_RECITERS: {
  id: string;
  name: string;
  /** everyayah.com directory name. */
  directory: string;
  bitrate: string;
}[] = [
  { id: 'ar.alafasy', name: 'Mishary Rashid Alafasy', directory: 'Alafasy_128kbps', bitrate: '128 kbps' },
  { id: 'ar.abdulbasit', name: 'Abdul Basit Abdus Samad (Murattal)', directory: 'Abdul_Basit_Murattal_192kbps', bitrate: '192 kbps' },
  { id: 'ar.abdulbasit-mujawwad', name: 'Abdul Basit Abdus Samad (Mujawwad)', directory: 'Abdul_Basit_Mujawwad_128kbps', bitrate: '128 kbps' },
  { id: 'ar.husary', name: 'Mahmoud Khalil Al-Husary', directory: 'Husary_128kbps', bitrate: '128 kbps' },
  { id: 'ar.minshawi', name: 'Mohamed Siddiq El-Minshawi', directory: 'Minshawy_Murattal_128kbps', bitrate: '128 kbps' },
  { id: 'ar.shaatree', name: 'Abu Bakr Ash-Shaatree', directory: 'Abu_Bakr_Ash-Shaatree_128kbps', bitrate: '128 kbps' },
  { id: 'ar.sudais', name: 'Abdurrahman As-Sudais', directory: 'Abdurrahmaan_As-Sudais_192kbps', bitrate: '192 kbps' },
  { id: 'ar.ahmedajamy', name: 'Ahmed ibn Ali Al-Ajamy', directory: 'Ahmed_ibn_Ali_al-Ajamy_128kbps', bitrate: '128 kbps' },
  { id: 'ar.mahermuaiqly', name: 'Maher Al Muaiqly', directory: 'Maher_AlMuaiqly_128kbps', bitrate: '128 kbps' },
];

const pad3 = (n: number) => String(n).padStart(3, '0');

export function quranVerseAudioUrl(reciterId: string, surah: number, ayah: number): string | null {
  const reciter = QURAN_RECITERS.find((r) => r.id === reciterId);
  if (!reciter) return null;
  if (!Number.isFinite(surah) || !Number.isFinite(ayah) || surah < 1 || ayah < 1) return null;
  return `https://everyayah.com/data/${reciter.directory}/${pad3(surah)}${pad3(ayah)}.mp3`;
}

/* ------------------------------------------------------------- Playability -- */

export interface PlayableAudio {
  playable: boolean;
  url: string | null;
  /** Where the audio will actually come from. */
  origin: 'local' | 'remote' | 'tone' | 'none';
  reason?: 'no-source' | 'not-downloaded';
}

export async function resolvePlayable(recordingId: string): Promise<PlayableAudio> {
  const localKey = `adhan:${recordingId}`;
  const local = await mediaGet(localKey);
  if (local) {
    const url = await mediaObjectUrl(localKey);
    return { playable: !!url, url, origin: 'local' };
  }
  const recording = getAdhanRecording(recordingId);
  if (recording?.src) {
    return { playable: true, url: recording.src, origin: 'remote' };
  }
  return { playable: false, url: null, origin: 'none', reason: 'no-source' };
}

/**
 * Probes whether a remote recording is actually reachable from this device.
 * A `no-cors` fetch succeeds opaquely for any 2xx/3xx and fails on network or
 * CORS-opaque errors, which is enough to distinguish "reachable" from "not".
 */
export async function probeAudioUrl(
  url: string,
  timeoutMs = 8000,
): Promise<'available' | 'unavailable' | 'unknown'> {
  if (typeof fetch !== 'undefined') {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: 'GET', mode: 'no-cors', signal: controller.signal });
      // opaque responses report status 0
      return res.status === 0 || res.ok ? 'available' : 'unavailable';
    } catch {
      return 'unavailable';
    } finally {
      window.clearTimeout(timer);
    }
  }
  return 'unknown';
}

/** Downloads remote audio into IndexedDB for offline playback. */
export async function downloadAudio(
  key: string,
  url: string,
  onProgress?: (fraction: number) => void,
  title?: string,
): Promise<{ ok: true; bytes: number } | { ok: false; error: string }> {
  try {
    const controller = new AbortController();
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };

    const total = Number(res.headers.get('content-length') ?? 0);
    if (!res.body || !total) {
      const blob = await res.blob();
      await mediaPut(key, blob, { title });
      onProgress?.(1);
      return { ok: true, bytes: blob.size };
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        onProgress?.(Math.min(1, received / total));
      }
    }
    const blob = new Blob(chunks as BlobPart[], { type: res.headers.get('content-type') ?? 'audio/mpeg' });
    await mediaPut(key, blob, { mimeType: blob.type, title });
    return { ok: true, bytes: blob.size };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Download failed' };
  }
}

/* --------------------------------------------------------------- Importing -- */

export async function importAudioFile(
  key: string,
  file: File,
): Promise<{ ok: true; bytes: number } | { ok: false; error: string }> {
  if (!file.type.startsWith('audio/')) {
    return { ok: false, error: 'not-audio' };
  }
  // Guard against a 500 MB file filling the device.
  if (file.size > 40 * 1024 * 1024) {
    return { ok: false, error: 'too-large' };
  }
  await mediaPut(key, file, { mimeType: file.type, title: file.name });
  return { ok: true, bytes: file.size };
}

export async function removeImportedAudio(key: string): Promise<void> {
  await mediaDelete(key);
}

export const adhanLocalKey = (id: string) => `adhan:${id}`;

/* ------------------------------------------------------- Generated chime -- */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

/**
 * A short, unobtrusive two-note chime synthesised on the device.
 * Used for the "short tone" notification style — no recording, no licence.
 */
export async function playNotificationTone(volume = 0.7): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') await ctx.resume();

    const now = ctx.currentTime;
    const notes = [
      { freq: 659.25, at: 0, dur: 0.32 }, // E5
      { freq: 987.77, at: 0.16, dur: 0.5 }, // B5
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, now + note.at);

      // Short attack, gentle release — a bell-like envelope without a click.
      gain.gain.setValueAtTime(0, now + note.at);
      gain.gain.linearRampToValueAtTime(volume * 0.5, now + note.at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.at + note.dur);

      osc.connect(gain).connect(ctx.destination);
      osc.start(now + note.at);
      osc.stop(now + note.at + note.dur + 0.05);
    }
    return true;
  } catch {
    return false;
  }
}

export function isAudioSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.Audio !== 'undefined';
}
