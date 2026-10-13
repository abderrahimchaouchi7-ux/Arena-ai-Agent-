import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { useSettings } from '../state/settings';
import { act } from 'react';

/**
 * The Hadith and Adhkar datasets ship Arabic + English only. The app must say
 * so when the reader is in French, instead of silently showing no translation.
 *
 * Language is driven through the settings store, not by calling
 * i18n.changeLanguage directly: the app's boot effect re-syncs i18n from the
 * store on mount, so a direct i18n call gets overridden back to the stored
 * value. Driving the store exercises the real code path.
 */

/** ASCII-only fragment, so the assertion cannot trip on Unicode normalisation. */
const NOTICE = 'Arabe et anglais uniquement';

function go(hash: string) {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

async function renderAs(language: 'fr' | 'en', hash: string) {
  act(() => {
    useSettings.setState({ language, theme: 'classic', mode: 'light', accent: 'gold' });
  });
  go(hash);
  const view = render(<App />);
  // Wait for the *page* to render, not just the shell. Matching on a word like
  // "Adhkar" would hit the sidebar nav link and resolve while <main> is still
  // the Suspense fallback, so wait for the landmark to actually fill in.
  await waitFor(() => {
    expect((screen.getByRole('main').textContent ?? '').length).toBeGreaterThan(200);
  });
  return view;
}

beforeEach(() => {
  act(() => {
    useSettings.setState({ language: 'en', theme: 'classic', mode: 'light', accent: 'gold' });
  });
});

describe('French translation availability notice', () => {
  it('appears on the Hadith collection view when the UI is French', async () => {
    await renderAs('fr', '/hadith/sahih-bukhari');
    expect(screen.getByRole('main').textContent).toContain(NOTICE);
  });

  it('appears on the Adhkar group view when the UI is French', async () => {
    await renderAs('fr', '/adhkar/protection');
    expect(screen.getByRole('main').textContent).toContain(NOTICE);
  });

  it('is absent on the Hadith view when the UI is English', async () => {
    await renderAs('en', '/hadith/sahih-bukhari');
    expect(screen.getByRole('main').textContent).not.toContain(NOTICE);
  });

  it('is absent on the Adhkar view when the UI is English', async () => {
    await renderAs('en', '/adhkar/protection');
    expect(screen.getByRole('main').textContent).not.toContain(NOTICE);
  });
});
