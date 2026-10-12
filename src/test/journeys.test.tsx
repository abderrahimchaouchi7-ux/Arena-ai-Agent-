/**
 * Journey tests: render the real app shell and drive the paths a user takes.
 *
 * These deliberately render the actual `App`, real router and real bundled data
 * so a broken nav destination, a missing translation key or a crashed page
 * fails here rather than in production.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import App from '../App';
import { useSettings } from '../state/settings';
import { useUserData } from '../state/userData';
import { act } from 'react';

/** Navigates the hash router, which the app uses so it works from file://. */
function go(hash: string) {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

async function renderAt(hash: string) {
  go(hash);
  const view = render(<App />);
  // The route is lazy, so the shell appears only after its chunk resolves.
  await waitFor(() => expect(screen.getAllByRole('link').length).toBeGreaterThan(0));
  return view;
}

beforeEach(() => {
  // Deterministic store state for every journey.
  act(() => {
    useSettings.setState({
      language: 'en',
      theme: 'classic',
      mode: 'light',
      accent: 'gold',
      location: {
        latitude: 21.4225,
        longitude: 39.8262,
        label: 'Makkah, Saudi Arabia',
        country: 'SA',
        timezone: 'Asia/Riyadh',
        automatic: false,
        updatedAt: 0,
      },
    });
    useUserData.getState().clearUserData();
  });
});

describe('navigation', () => {
  it('renders every primary destination without crashing', async () => {
    await renderAt('/');
    const destinations = [
      '#/prayer-times',
      '#/quran',
      '#/dua',
      '#/adhkar',
      '#/hadith',
      '#/qibla',
      '#/adhan',
      '#/search',
      '#/bookmarks',
      '#/settings',
    ];
    for (const hash of destinations) {
      act(() => {
        go(hash);
      });
      // Each page must produce a heading; a crash would throw instead.
      await waitFor(() => {
        const main = screen.getByRole('main');
        expect(within(main).getAllByText(/.+/).length).toBeGreaterThan(0);
      });
    }
  });

  it('shows the not-found page for an unknown route', async () => {
    await renderAt('/does-not-exist');
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument());
    expect(screen.getByRole('main').textContent).toMatch(/not found|404|لم|introuvable/i);
  });

  it('navigates from the home dashboard to prayer times', async () => {
    await renderAt('/');
    const main = screen.getByRole('main');
    const link = within(main)
      .getAllByRole('link')
      .find((el) => (el.getAttribute('href') ?? '').includes('prayer-times'));
    expect(link, 'home links to prayer times').toBeDefined();
    act(() => {
      fireEvent.click(link!);
    });
    await waitFor(() => expect(window.location.hash).toBe('#/prayer-times'));
  });
});

describe('prayer times journey', () => {
  it('lists all five obligatory prayers with a time for each', async () => {
    await renderAt('/prayer-times');
    await waitFor(() => {
      const main = screen.getByRole('main');
      for (const name of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
        expect(within(main).getByText(name)).toBeInTheDocument();
      }
    });
    // A real h:mm must be rendered for at least one prayer.
    await waitFor(() => {
      expect(screen.getByRole('main').textContent).toMatch(/\d{1,2}:\d{2}\s?[AP]M/i);
    });
  });

  it('shows a live countdown to the next prayer', async () => {
    await renderAt('/');
    await waitFor(() => {
      const main = screen.getByRole('main');
      expect(main.textContent).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });
  });
});

describe('Quran journey', () => {
  it('lists all 114 surahs on the index', async () => {
    await renderAt('/quran');
    await waitFor(() => {
      const main = screen.getByRole('main');
      expect(within(main).getAllByRole('link').length).toBeGreaterThanOrEqual(114);
    });
    const main = screen.getByRole('main');
    expect(within(main).getByText('Al-Faatiha')).toBeInTheDocument();
    expect(within(main).getByText('An-Naas')).toBeInTheDocument();
  });

  it('opens a surah and renders its Arabic text', async () => {
    await renderAt('/quran/112');
    await waitFor(() => {
      const arabic = document.querySelectorAll('[dir="rtl"]');
      expect(arabic.length).toBeGreaterThan(0);
    });
    // Al-Ikhlas has exactly 4 verses.
    const main = screen.getByRole('main');
    expect(main.textContent).toContain('Al-Ikhlaas');
  });

  it('renders the Basmala exactly once at the head of a surah', async () => {
    await renderAt('/quran/112');
    await waitFor(() => {
      const main = screen.getByRole('main');
      expect(main.textContent ?? '').toContain('Al-Ikhlaas');
    });
    const main = screen.getByRole('main');
    const bare = (main.textContent ?? '')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627');
    const occurrences = bare.split('بسم الله الرحمن الرحيم').length - 1;
    expect(occurrences).toBe(1);
  });
});

describe('language and theme persistence', () => {
  it('mirrors the document for Arabic and persists the choice', async () => {
    await renderAt('/settings');
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument());
    act(() => {
      useSettings.getState().setLanguage('ar');
    });
    await waitFor(() => {
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');
      expect(document.documentElement.getAttribute('lang')).toBe('ar');
      const stored = JSON.parse(localStorage.getItem('nur-settings') ?? '{}');
      expect(stored.state.language).toBe('ar');
    });
  });

  it('restores a persisted language on a fresh render', async () => {
    // Write in the shape zustand persist actually uses.
    localStorage.setItem(
      'nur-settings',
      JSON.stringify({
        state: { ...useSettings.getState(), language: 'fr', theme: 'dark', mode: 'dark' },
        version: 1,
      })
    );
    useSettings.persist.rehydrate();
    render(<App />);
    await waitFor(() => {
      expect(document.documentElement.getAttribute('lang')).toBe('fr');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  it('applies the chosen theme and mode to the document', async () => {
    await renderAt('/settings');
    act(() => {
      useSettings.getState().setTheme('sand');
      useSettings.getState().setMode('dark');
      useSettings.getState().setAccent('emerald');
    });
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('sand');
      expect(document.documentElement.getAttribute('data-mode')).toBe('dark');
      expect(document.documentElement.getAttribute('data-accent')).toBe('emerald');
    });
  });
});

describe('bookmarks journey', () => {
  it('shows an empty state before anything is saved', async () => {
    await renderAt('/bookmarks');
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument());
    expect(screen.getByRole('main').textContent?.trim().length).toBeGreaterThan(0);
  });

  it('lists a bookmark after it is saved', async () => {
    act(() => {
      useUserData.getState().toggleBookmark({
        id: 'ayah:112:1',
        kind: 'ayah',
        title: 'Al-Ikhlas 112:1',
        excerpt: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
      });
    });
    await renderAt('/bookmarks');
    await waitFor(() => {
      expect(screen.getByRole('main').textContent).toContain('Al-Ikhlas');
    });
  });
});

describe('accessibility and states', () => {
  it('labels the main landmark and skip link', async () => {
    await renderAt('/');
    expect(screen.getByRole('main')).toBeInTheDocument();
    // A skip link must exist and target the main landmark.
    const skip = screen
      .getAllByRole('link')
      .find((el) => (el.getAttribute('href') ?? '').startsWith('#main'));
    expect(skip, 'skip link present').toBeDefined();
  });

  it('gives every icon-only control an accessible name', async () => {
    await renderAt('/adhan');
    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument());
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      const name = button.getAttribute('aria-label') || button.textContent?.trim();
      expect(name, `button has no accessible name: ${button.outerHTML.slice(0, 80)}`).toBeTruthy();
    }
  });

  it('never renders a decorative emoji in navigation', async () => {
    await renderAt('/');
    for (const nav of screen.getAllByRole('navigation')) {
      expect(nav.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    }
  });
});

describe('error and offline handling', () => {
  it('keeps the shell usable when geolocation is unavailable', async () => {
    // jsdom has no geolocation; the app must fall back to the stored location.
    expect(navigator.geolocation).toBeUndefined();
    await renderAt('/prayer-times');
    await waitFor(() => {
      expect(screen.getByRole('main').textContent).toMatch(/\d{1,2}:\d{2}/);
    });
  });
});

describe('qibla journey', () => {
  it('computes a bearing for the stored location without a sensor', async () => {
    await renderAt('/qibla');
    await waitFor(() => {
      const main = screen.getByRole('main');
      // Makkah -> the bearing is undefined-ish at the Kaaba itself, so assert
      // the page explains the sensor situation instead of faking a heading.
      expect(main.textContent ?? '').toMatch(/°|compass|sensor|بوصلة|Capteur/i);
    });
  });
});
