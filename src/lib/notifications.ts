/**
 * Notifications.
 *
 * Platform reality, handled honestly:
 *
 * - **Web**: the page can only run code while it is open. Alerts therefore fire
 *   from an in-page scheduler that survives tab *backgrounding* but not tab
 *   *closing*. This file says so in the UI rather than promising something the
 *   browser will never do.
 * - **Android (Capacitor)**: `@capacitor/local-notifications` schedules real
 *   system notifications through the OS AlarmManager, so they survive the app
 *   being closed — subject to the vendor's battery optimisation, which the UI
 *   tells the user to disable for this app.
 *
 * Nothing here silently no-ops: every path returns a result the caller surfaces.
 */
import { LocalNotifications } from '@capacitor/local-notifications';
import { ALL_PRAYERS, type NotificationStyle, type PrayerKey } from '@/lib/types';
import { playNotificationTone } from './audio';

export type NotificationPermissionState =
  | 'unsupported'
  | 'default'
  | 'granted'
  | 'denied'
  | 'unavailable';

export const NOTIFICATION_CHANNEL_ID = 'prayer-times';

export function isNative(): boolean {
  return typeof (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor?.isNativePlatform === 'function'
    ? Boolean((window as unknown as { Capacitor: { isNativePlatform: () => boolean } }).Capacitor.isNativePlatform())
    : false;
}

export function getPermissionState(): NotificationPermissionState {
  if (isNative()) {
    // Native permission is checked asynchronously; report "default" until then.
    return typeof Notification !== 'undefined' ? (Notification.permission as NotificationPermissionState) : 'default';
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as NotificationPermissionState;
}

export async function requestPermission(): Promise<NotificationPermissionState> {
  if (isNative()) {
    try {
      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    const result = await Notification.requestPermission();
    return result as NotificationPermissionState;
  } catch {
    return 'denied';
  }
}

export async function checkNativePermission(): Promise<NotificationPermissionState> {
  if (!isNative()) return getPermissionState();
  try {
    const result = await LocalNotifications.checkPermissions();
    switch (result.display) {
      case 'granted':
        return 'granted';
      case 'denied':
        return 'denied';
      default:
        return 'default';
    }
  } catch {
    return 'unavailable';
  }
}

/** Creates the Android notification channel (idempotent). */
export async function ensureNotificationChannel(labels: {
  name: string;
  description: string;
}): Promise<void> {
  if (!isNative()) return;
  try {
    await LocalNotifications.createChannel({
      id: NOTIFICATION_CHANNEL_ID,
      name: labels.name,
      description: labels.description,
      sound: undefined,
      importance: 5, // MAX — an Adhan should not be swallowed by DND grouping
      visibility: 1, // PUBLIC
      vibration: true,
      lights: true,
    });
  } catch {
    /* Older Android versions have no channels; safe to ignore. */
  }
}

export interface ShowNotificationOptions {
  title: string;
  body: string;
  /** Prayer key, used as the notification tag so re-scheduling replaces it. */
  tag: string;
  silent?: boolean;
  icon?: string;
}

export async function showNotification(opts: ShowNotificationOptions): Promise<boolean> {
  if (isNative()) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: hashId(opts.tag),
            title: opts.title,
            body: opts.body,
            channelId: NOTIFICATION_CHANNEL_ID,
            sound: opts.silent ? undefined : undefined,
            schedule: { at: new Date(Date.now() + 50), allowWhileIdle: true },
            extra: { tag: opts.tag },
          },
        ],
      });
      return true;
    } catch {
      return false;
    }
  }

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return false;
  }
  try {
    // Prefer a service-worker registration so the notification can be shown
    // while the tab is backgrounded; fall back to the page-level constructor.
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration?.showNotification) {
      await registration.showNotification(opts.title, {
        body: opts.body,
        tag: opts.tag,
        silent: opts.silent,
        icon: opts.icon ?? 'pwa-192x192.png',
        badge: 'pwa-192x192.png',
        data: { tag: opts.tag },
      });
      return true;
    }
    new Notification(opts.title, {
      body: opts.body,
      tag: opts.tag,
      silent: opts.silent,
      icon: opts.icon ?? 'pwa-192x192.png',
    });
    return true;
  } catch {
    return false;
  }
}

/** Small stable positive integer id for the native scheduler. */
function hashId(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2_000_000_000;
}

/* ------------------------------------------------------------- Scheduling -- */

export interface ScheduledAlert {
  prayer: PrayerKey;
  fireAt: number;
  style: NotificationStyle;
  /** true when this is the pre-prayer reminder rather than the prayer itself. */
  reminder: boolean;
}

export interface ScheduleInput {
  prayer: PrayerKey;
  time: Date;
  style: NotificationStyle;
  reminderMinutes: number;
}

/** Builds the list of alerts for a day, dropping anything already in the past. */
export function buildSchedule(
  inputs: ScheduleInput[],
  now: number = Date.now(),
): ScheduledAlert[] {
  const alerts: ScheduledAlert[] = [];
  for (const input of inputs) {
    if (input.style === 'off') continue;
    const at = input.time.getTime();
    if (at > now) alerts.push({ prayer: input.prayer, fireAt: at, style: input.style, reminder: false });
    if (input.reminderMinutes > 0) {
      const reminderAt = at - input.reminderMinutes * 60_000;
      if (reminderAt > now) {
        alerts.push({ prayer: input.prayer, fireAt: reminderAt, style: input.style, reminder: true });
      }
    }
  }
  return alerts.sort((a, b) => a.fireAt - b.fireAt);
}

/** Cancels every pending native notification we own. */
export async function cancelNativeNotifications(ids: number[]): Promise<void> {
  if (!isNative() || ids.length === 0) return;
  try {
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch {
    /* best effort */
  }
}

export function scheduleIdFor(alert: ScheduledAlert): number {
  return hashId(`${alert.prayer}:${alert.reminder ? 'r' : 'p'}:${Math.round(alert.fireAt / 60000)}`);
}

/** Schedules native (Android) notifications for a list of alerts. */
export async function scheduleNative(
  alerts: ScheduledAlert[],
  textFor: (alert: ScheduledAlert) => { title: string; body: string },
): Promise<number[]> {
  if (!isNative() || alerts.length === 0) return [];
  try {
    await LocalNotifications.schedule({
      notifications: alerts.map((alert) => {
        const { title, body } = textFor(alert);
        return {
          id: scheduleIdFor(alert),
          title,
          body,
          channelId: NOTIFICATION_CHANNEL_ID,
          schedule: { at: new Date(alert.fireAt), allowWhileIdle: true, every: undefined },
          extra: { prayer: alert.prayer, reminder: alert.reminder },
        };
      }),
    });
    return alerts.map(scheduleIdFor);
  } catch {
    return [];
  }
}

/* ---------------------------------------------------- Web in-page timer -- */

export interface WebSchedulerHandle {
  stop: () => void;
}

/**
 * Web fallback: a single timer per alert. Timers are throttled in background
 * tabs, so a fired alert may be a few seconds late — acceptable for a reminder,
 * and the Android build is recommended for exact Adhan timing.
 */
export function startWebScheduler(
  alerts: ScheduledAlert[],
  onFire: (alert: ScheduledAlert) => Promise<void> | void,
  opts: { volume?: number } = {},
): WebSchedulerHandle {
  const timers: number[] = [];
  for (const alert of alerts) {
    const delay = Math.max(0, alert.fireAt - Date.now());
    const id = window.setTimeout(() => {
      void (async () => {
        await onFire(alert);
        if (alert.style === 'tone') await playNotificationTone(opts.volume ?? 0.7);
      })();
    }, delay);
    timers.push(id);
  }
  return {
    stop: () => timers.forEach((id) => window.clearTimeout(id)),
  };
}

/** Convenience: the prayer keys that actually have a notification configured. */
export function activePrayers(
  notifications: Record<PrayerKey, { style: NotificationStyle }>,
): PrayerKey[] {
  return ALL_PRAYERS.filter((p) => notifications[p]?.style !== 'off');
}
