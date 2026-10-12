/**
 * User-generated data: bookmarks, favourites, recitation counters, history.
 *
 * Kept completely separate from the verified religious content in `src/data`,
 * and mirrored into IndexedDB so it survives clearing site data in one place
 * but not the other.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ContentBookmark, QuranBookmark, RecentlyViewed } from '@/lib/types';
import { kvGet, kvSet } from '@/lib/db';

const IDB_KEY = 'user-data-v1';
const MAX_HISTORY = 40;

export interface UserDataState {
  quranBookmarks: QuranBookmark[];
  bookmarks: ContentBookmark[];
  /** adhkar / dua repetition counters, keyed by item id, reset daily. */
  counters: Record<string, { done: number; date: string }>;
  history: RecentlyViewed[];
  /** Set of ayah ids the user has marked as memorised ("reviewed"). */
  reviewedAyahs: string[];

  toggleQuranBookmark: (surah: number, ayah: number) => void;
  toggleBookmark: (bookmark: Omit<ContentBookmark, 'createdAt'>) => void;
  isBookmarked: (id: string) => boolean;
  incrementCounter: (id: string) => number;
  resetCounter: (id: string) => void;
  counterValue: (id: string) => number;
  trackView: (entry: Omit<RecentlyViewed, 'viewedAt'>) => void;
  clearHistory: () => void;
  toggleReviewed: (ayahId: string) => void;
  clearUserData: () => void;
}

const todayKey = () => new Date().toISOString().slice(0, 10);

export const useUserData = create<UserDataState>()(
  persist(
    (set, get) => ({
      quranBookmarks: [],
      bookmarks: [],
      counters: {},
      history: [],
      reviewedAyahs: [],

      toggleQuranBookmark: (surah, ayah) =>
        set((s) => {
          const exists = s.quranBookmarks.some((b) => b.surah === surah && b.ayah === ayah);
          const next = exists
            ? s.quranBookmarks.filter((b) => !(b.surah === surah && b.ayah === ayah))
            : [...s.quranBookmarks, { surah, ayah, createdAt: Date.now() }].sort(
                (a, b) => b.createdAt - a.createdAt,
              );
          return { quranBookmarks: next };
        }),

      toggleBookmark: (bookmark) =>
        set((s) => {
          const exists = s.bookmarks.some((b) => b.id === bookmark.id);
          return {
            bookmarks: exists
              ? s.bookmarks.filter((b) => b.id !== bookmark.id)
              : [{ ...bookmark, createdAt: Date.now() }, ...s.bookmarks],
          };
        }),

      isBookmarked: (id) => get().bookmarks.some((b) => b.id === id),

      incrementCounter: (id) => {
        const today = todayKey();
        const current = get().counters[id];
        const done = (current?.date === today ? current.done : 0) + 1;
        set((s) => ({ counters: { ...s.counters, [id]: { done, date: today } } }));
        return done;
      },

      resetCounter: (id) =>
        set((s) => {
          const next = { ...s.counters };
          delete next[id];
          return { counters: next };
        }),

      counterValue: (id) => {
        const c = get().counters[id];
        return c && c.date === todayKey() ? c.done : 0;
      },

      trackView: (entry) =>
        set((s) => {
          const filtered = s.history.filter((h) => h.id !== entry.id);
          return {
            history: [{ ...entry, viewedAt: Date.now() }, ...filtered].slice(0, MAX_HISTORY),
          };
        }),

      clearHistory: () => set({ history: [] }),

      toggleReviewed: (ayahId) =>
        set((s) => ({
          reviewedAyahs: s.reviewedAyahs.includes(ayahId)
            ? s.reviewedAyahs.filter((a) => a !== ayahId)
            : [...s.reviewedAyahs, ayahId],
        })),

      clearUserData: () =>
        set({
          quranBookmarks: [],
          bookmarks: [],
          counters: {},
          history: [],
          reviewedAyahs: [],
        }),
    }),
    {
      name: 'nur-user-data',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (s) => ({
        quranBookmarks: s.quranBookmarks,
        bookmarks: s.bookmarks,
        counters: s.counters,
        history: s.history,
        reviewedAyahs: s.reviewedAyahs,
      }),
    },
  ),
);

/** Mirrors user data into IndexedDB as a second copy (offline resilience). */
export function backupUserDataToIdb(): void {
  const s = useUserData.getState();
  kvSet(IDB_KEY, {
    quranBookmarks: s.quranBookmarks,
    bookmarks: s.bookmarks,
    counters: s.counters,
    history: s.history,
    reviewedAyahs: s.reviewedAyahs,
  }).catch(() => {
    /* IndexedDB is a bonus copy; localStorage is the source of truth. */
  });
}

export interface RestoredUserData {
  quranBookmarks: QuranBookmark[];
  bookmarks: ContentBookmark[];
  counters: Record<string, { done: number; date: string }>;
  history: RecentlyViewed[];
  reviewedAyahs: string[];
}

export async function restoreUserDataFromIdb(): Promise<RestoredUserData | null> {
  return (await kvGet<RestoredUserData>(IDB_KEY)) ?? null;
}
