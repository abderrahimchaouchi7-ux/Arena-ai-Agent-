/**
 * Qibla maths and device-orientation glue.
 *
 * Two distinct numbers are always kept separate in this app:
 *
 *   1. `qiblaBearing` — the *geographic* great-circle bearing from the user's
 *      coordinates to the Kaaba. Pure maths, always available, no sensors.
 *   2. `heading` — the *live compass heading* of the device, from the
 *      magnetometer / orientation sensors. Optional, noisy, and unavailable on
 *      many desktops.
 *
 * The UI must show #1 as a fact and #2 as a measurement, never blur them.
 */

/** Kaaba, Masjid al-Haram, Makkah. */
export const KAABA = {
  latitude: 21.4224779,
  longitude: 39.8251832,
  label: "Kaaba, Masjid al-Haram, Makkah",
} as const;

const R2D = 180 / Math.PI;
const D2R = Math.PI / 180;

/**
 * Initial great-circle bearing from `from` to `to`, in degrees clockwise from
 * true north, normalised to [0, 360).
 *
 * Spherical-earth formula:
 *   θ = atan2( sin Δλ · cos φ₂ , cos φ₁ · sin φ₂ − sin φ₁ · cos φ₂ · cos Δλ )
 */
export function bearingTo(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const phi1 = from.latitude * D2R;
  const phi2 = to.latitude * D2R;
  const deltaLambda = (to.longitude - from.longitude) * D2R;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x) * R2D;
  return ((theta % 360) + 360) % 360;
}

/** Bearing from arbitrary coordinates to the Kaaba. */
export function qiblaBearing(coords: { latitude: number; longitude: number }): number {
  return bearingTo(coords, KAABA);
}

/**
 * Great-circle distance in kilometres (haversine). Used to show "you are N km
 * from the Kaaba", which also helps users sanity-check their location.
 */
export function distanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const R = 6371; // mean earth radius, km
  const dPhi = (to.latitude - from.latitude) * D2R;
  const dLambda = (to.longitude - from.longitude) * D2R;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(from.latitude * D2R) * Math.cos(to.latitude * D2R) * Math.sin(dLambda / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function formatBearing(deg: number): string {
  return `${Math.round(deg)}°`;
}

export const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
] as const;

/** 16-point cardinal label, e.g. 112° -> "ESE". */
export function compassPoint(deg: number): string {
  const idx = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
  return COMPASS_POINTS[idx];
}

/**
 * Shortest signed angular difference, in (-180, 180].
 * `needle - dial` tells you which way to turn the phone.
 */
export function angleDelta(needle: number, dial: number): number {
  let d = (needle - dial) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export type SensorState =
  | 'unsupported'
  | 'unavailable'
  | 'permission-required'
  | 'permission-denied'
  | 'active'
  | 'error';

export interface OrientationSample {
  /** Compass heading in degrees clockwise from north, if the device reports one. */
  heading: number | null;
  /** Sensor-reported accuracy in degrees; `null` when unknown. */
  accuracy: number | null;
}

/**
 * Normalises the several device-orientation shapes into one heading.
 *
 * - `webkitCompassHeading` (iOS/Safari): already degrees clockwise from north.
 * - `alpha` (Android/Chrome, absolute): counter-clockwise from north, so the
 *   heading is `360 - alpha`.
 *
 * Returns null when the event carries no usable orientation.
 */
export function headingFromEvent(event: DeviceOrientationEvent): number | null {
  const w = event as DeviceOrientationEvent & {
    webkitCompassHeading?: number;
    webkitCompassAccuracy?: number;
  };

  if (typeof w.webkitCompassHeading === 'number' && Number.isFinite(w.webkitCompassHeading)) {
    return ((w.webkitCompassHeading % 360) + 360) % 360;
  }
  if (event.absolute && typeof event.alpha === 'number' && Number.isFinite(event.alpha)) {
    return (((360 - event.alpha) % 360) + 360) % 360;
  }
  return null;
}

/** Accuracy bucket from the sensor's reported error, in degrees. */
export function accuracyLevel(accuracy: number | null): 'high' | 'medium' | 'low' | 'unknown' {
  if (accuracy === null || !Number.isFinite(accuracy)) return 'unknown';
  if (accuracy <= 10) return 'high';
  if (accuracy <= 25) return 'medium';
  return 'low';
}

export function supportsOrientationSensor(): boolean {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
}

/**
 * iOS 13+ requires an explicit user gesture to unlock the motion sensors.
 * Returns true when a request was made (regardless of the user's answer).
 */
export async function requestOrientationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const ctor = window.DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };
  if (typeof ctor?.requestPermission !== 'function') return true;
  try {
    const result = await ctor.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

/** Exponential smoothing so the needle glides instead of jittering. */
export function smoothHeading(previous: number | null, next: number, factor = 0.18): number {
  if (previous === null) return next;
  // Average across the 0/360 seam, otherwise the needle spins wildly at north.
  const delta = angleDelta(next, previous);
  return ((previous + delta * factor) % 360 + 360) % 360;
}
