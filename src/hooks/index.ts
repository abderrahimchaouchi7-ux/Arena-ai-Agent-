import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings, prayerSettingsFrom } from '@/state/settings';
import { computePrayerTimes, getNextPrayer, type DayPrayerTimes } from '@/lib/prayer';
import type { NextPrayerInfo } from '@/lib/prayer';

/** Ticks once per second while the component is mounted. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    // Re-sync immediately if the tab was backgrounded and timers were throttled.
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(new Date());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}

export interface PrayerTimesResult {
  today: DayPrayerTimes | null;
  tomorrow: DayPrayerTimes | null;
  next: NextPrayerInfo | null;
  error: string | null;
}

/** Prayer times for the user's saved location + method, recomputed on demand. */
export function usePrayerTimes(date: Date): PrayerTimesResult {
  const location = useSettings((s) => s.location);
  const method = useSettings((s) => s.method);
  const madhab = useSettings((s) => s.madhab);
  const highLatitudeRule = useSettings((s) => s.highLatitudeRule);
  const adjustments = useSettings((s) => s.adjustments);

  return useMemo(() => {
    const settings = { method, madhab, highLatitudeRule, adjustments };
    // Recompute when the calendar day changes, not on every tick.
    const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const dayDate = new Date(
      Number(dayKey.split('-')[0]),
      Number(dayKey.split('-')[1]),
      Number(dayKey.split('-')[2]),
      12,
      0,
      0,
    );
    try {
      const today = computePrayerTimes(location, dayDate, settings);
      const tomorrowDate = new Date(dayDate);
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrow = computePrayerTimes(location, tomorrowDate, settings);
      const next = getNextPrayer(location, settings, date);
      return { today, tomorrow, next, error: null };
    } catch (err) {
      return {
        today: null,
        tomorrow: null,
        next: null,
        error: err instanceof Error ? err.message : 'Prayer time calculation failed',
      };
    }
  }, [location, method, madhab, highLatitudeRule, adjustments, date]);
}

/** Live countdown state, recomputed every second. */
export function useCountdown() {
  const now = useNow(1000);
  const location = useSettings((s) => s.location);
  const settings = useSettings(prayerSettingsFrom);

  return useMemo(() => {
    try {
      return { next: getNextPrayer(location, settings, now), now, error: null as string | null };
    } catch (err) {
      return {
        next: null,
        now,
        error: err instanceof Error ? err.message : 'Countdown failed',
      };
    }
  }, [location, settings, now]);
}

export interface GeolocationResult {
  status: 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable' | 'error';
  coords: { latitude: number; longitude: number; accuracy?: number } | null;
  message: string | null;
  locate: () => void;
}

/**
 * Wraps `navigator.geolocation` with explicit, translatable failure states.
 * The permission is only ever requested when the user presses a button — never
 * on page load.
 */
export function useGeolocation(): GeolocationResult {
  const [status, setStatus] = useState<GeolocationResult['status']>('idle');
  const [coords, setCoords] = useState<GeolocationResult['coords']>(null);
  const [message, setMessage] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (watchId.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    },
    [],
  );

  const locate = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable');
      setMessage('geolocation.unsupported');
      return;
    }
    setStatus('locating');
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setStatus('granted');
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setStatus('denied');
            setMessage('location.denied');
            break;
          case error.POSITION_UNAVAILABLE:
            setStatus('unavailable');
            setMessage('location.unavailable');
            break;
          case error.TIMEOUT:
          default:
            setStatus('error');
            setMessage('location.timeout');
        }
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 },
    );
  };

  return { status, coords, message, locate };
}

/** Online/offline awareness, for the "offline" badge and cache messaging. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

/** Debounces a rapidly-changing value (search inputs). */
export function useDebounced<T>(value: T, delayMs = 220): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/** Whether the user's OS asked for reduced motion. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

/** Tracks whether the page has scrolled past a threshold (sticky header shadow). */
export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}
