import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

/**
 * Testing Library's default `waitFor` budget is 1000ms. That is enough on an
 * idle machine but not for this suite, which renders the whole app through
 * Suspense boundaries and waits for lazy route chunks to resolve. On a 2-CPU
 * box the suite then fails intermittently for reasons that have nothing to do
 * with the code under test.
 *
 * Raise the default once here rather than passing a timeout at every call site,
 * so a new test cannot silently reintroduce the flake.
 */
configure({ asyncUtilTimeout: 10000 });

afterEach(() => {
  cleanup();
  /**
   * Several suites drive the persisted settings store, which writes
   * `nur-settings` to localStorage. Vitest does not guarantee test-file order
   * or isolation of the jsdom storage area, so a file that leaves the language
   * on French can change what the next file renders. Clear it every time so
   * each test starts from the real defaults.
   */
  try {
    localStorage.clear();
  } catch {
    // localStorage can throw in restricted environments; nothing to clean up.
  }
});

// jsdom implements neither of these; stub them so components that reference
// them can be rendered in tests without crashing.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

if (!('IntersectionObserver' in window)) {
  class IntersectionObserverStub {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => []);
    root = null;
    rootMargin = '';
    thresholds = [];
  }
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: IntersectionObserverStub,
  });
}

if (!('scrollIntoView' in window.Element.prototype)) {
  (window.Element.prototype as { scrollIntoView: () => void }).scrollIntoView = () => {};
}

// Keep tests deterministic: fixed clock, fixed timezone-independent inputs.
vi.stubGlobal('__NUR_TEST__', true);
