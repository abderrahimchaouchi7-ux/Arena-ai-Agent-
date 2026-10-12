/**
 * Clipboard + Web Share helpers.
 *
 * Both APIs fail for boring, common reasons (insecure origin, no user gesture,
 * Safari restrictions), so every function returns a result the caller can turn
 * into a real message instead of a silent no-op.
 */

export type CopyResult = { ok: true } | { ok: false; reason: 'unsupported' | 'denied' | 'error' };

export async function copyText(text: string): Promise<CopyResult> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    } catch {
      // Fall through to the legacy path.
    }
  }

  if (typeof document === 'undefined') return { ok: false, reason: 'unsupported' };

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const worked = document.execCommand('copy');
    document.body.removeChild(area);
    return worked ? { ok: true } : { ok: false, reason: 'denied' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export type ShareResult = { ok: true } | { ok: false; reason: 'unsupported' | 'cancelled' | 'error' };

export async function shareContent(data: {
  title?: string;
  text: string;
  url?: string;
}): Promise<ShareResult> {
  if (!canShare()) {
    const copied = await copyText(data.text);
    return copied.ok ? { ok: true } : { ok: false, reason: 'unsupported' };
  }
  try {
    await navigator.share({ title: data.title, text: data.text, url: data.url });
    return { ok: true };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, reason: 'cancelled' };
    }
    return { ok: false, reason: 'error' };
  }
}

/** Composes the exact string shared for a verse, keeping the Arabic intact. */
export function formatVerseShare(opts: {
  arabic: string;
  surahName: string;
  surahNumber: number;
  ayah: number;
  translation?: string | null;
  appUrl?: string;
}): string {
  const parts = [
    opts.arabic,
    '',
    `[${opts.surahName} ${opts.surahNumber}:${opts.ayah}]`,
  ];
  if (opts.translation) parts.push('', opts.translation);
  if (opts.appUrl) parts.push('', opts.appUrl);
  return parts.join('\n');
}
