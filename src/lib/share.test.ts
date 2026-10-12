import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { copyText, canShare, shareContent, formatVerseShare } from './share';

describe('formatVerseShare', () => {
  it('keeps the Arabic intact and adds the reference', () => {
    const out = formatVerseShare({
      arabic: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
      surahName: 'Al-Fatihah',
      surahNumber: 1,
      ayah: 1,
    });
    const lines = out.split('\n');
    expect(lines[0]).toBe('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ');
    expect(lines).toContain('[Al-Fatihah 1:1]');
  });

  it('omits the translation block when there is none', () => {
    const out = formatVerseShare({
      arabic: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
      surahName: 'Al-Ikhlas',
      surahNumber: 112,
      ayah: 1,
      translation: null,
    });
    expect(out).toBe('قُلْ هُوَ ٱللَّهُ أَحَدٌ\n\n[Al-Ikhlas 112:1]');
  });

  it('includes the translation and the app URL when supplied', () => {
    const out = formatVerseShare({
      arabic: 'ع',
      surahName: 'Al-Ikhlas',
      surahNumber: 112,
      ayah: 1,
      translation: 'Say: He is Allah, the One.',
      appUrl: 'https://example.org/#/quran/112?ayah=1',
    });
    expect(out).toContain('Say: He is Allah, the One.');
    expect(out.trimEnd().endsWith('https://example.org/#/quran/112?ayah=1')).toBe(true);
  });
});

describe('canShare', () => {
  const original = navigator.share;

  afterEach(() => {
    Object.defineProperty(navigator, 'share', {
      value: original,
      configurable: true,
      writable: true,
    });
  });

  it('is false when navigator.share is absent', () => {
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    expect(canShare()).toBe(false);
  });

  it('is true when navigator.share is a function', () => {
    Object.defineProperty(navigator, 'share', {
      value: () => Promise.resolve(),
      configurable: true,
      writable: true,
    });
    expect(canShare()).toBe(true);
  });
});

describe('copyText', () => {
  const original = navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: original,
      configurable: true,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  it('uses the async clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    await expect(copyText('hello')).resolves.toEqual({ ok: true });
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('reports a denial rather than silently succeeding', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new DOMException('denied')) },
      configurable: true,
      writable: true,
    });
    // No execCommand in jsdom either, so the fallback throws too.
    const result = await copyText('hello');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(['denied', 'error', 'unsupported']).toContain(result.reason);
    }
  });

  it('falls back to execCommand when the async API rejects', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('insecure origin')) },
      configurable: true,
      writable: true,
    });
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;
    await expect(copyText('fallback')).resolves.toEqual({ ok: true });
    expect(execCommand).toHaveBeenCalledWith('copy');
  });
});

describe('shareContent', () => {
  const originalShare = navigator.share;
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'share', {
      value: originalShare,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  const setShare = (impl: unknown) =>
    Object.defineProperty(navigator, 'share', {
      value: impl,
      configurable: true,
      writable: true,
    });

  it('calls navigator.share when the platform supports it', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setShare(share);
    await expect(shareContent({ text: 'salam' })).resolves.toEqual({ ok: true });
    expect(share).toHaveBeenCalledWith({
      title: undefined,
      text: 'salam',
      url: undefined,
    });
  });

  it('reports a cancellation distinctly from an error', async () => {
    const abort = new DOMException('cancelled', 'AbortError');
    setShare(vi.fn().mockRejectedValue(abort));
    await expect(shareContent({ text: 'x' })).resolves.toEqual({ ok: false, reason: 'cancelled' });
  });

  it('reports other share failures as errors', async () => {
    setShare(vi.fn().mockRejectedValue(new Error('boom')));
    await expect(shareContent({ text: 'x' })).resolves.toEqual({ ok: false, reason: 'error' });
  });

  it('falls back to copying when there is no share sheet', async () => {
    setShare(undefined);
    const result = await shareContent({ text: 'copied instead' });
    expect(result).toEqual({ ok: true });
    expect(navigator.clipboard?.writeText).toHaveBeenCalledWith('copied instead');
  });
});
