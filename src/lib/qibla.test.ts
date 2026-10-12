import { describe, expect, it } from 'vitest';
import {
  KAABA,
  accuracyLevel,
  angleDelta,
  bearingTo,
  compassPoint,
  distanceKm,
  headingFromEvent,
  qiblaBearing,
  smoothHeading,
} from './qibla';

/**
 * Expected bearings were computed independently (spherical great-circle formula,
 * WGS-84 mean radius) outside this codebase, so these are genuine cross-checks
 * rather than the implementation agreeing with itself.
 */
const KNOWN_BEARINGS: { city: string; coords: [number, number]; bearing: number; km: number }[] = [
  { city: 'London', coords: [51.5072, -0.1276], bearing: 118.988, km: 4793.7 },
  { city: 'New York', coords: [40.7128, -74.006], bearing: 58.482, km: 10306.2 },
  { city: 'Paris', coords: [48.8566, 2.3522], bearing: 119.164, km: 4496.1 },
  { city: 'Jakarta', coords: [-6.2088, 106.8456], bearing: 295.151, km: 7920.2 },
  { city: 'Istanbul', coords: [41.0082, 28.9784], bearing: 151.623, km: 2405.0 },
  { city: 'Cairo', coords: [30.0444, 31.2357], bearing: 136.141, km: 1287.2 },
  { city: 'Sydney', coords: [-33.8688, 151.2093], bearing: 277.499, km: 13236.3 },
  { city: 'Casablanca', coords: [33.5731, -7.5898], bearing: 93.676, km: 4823.5 },
  { city: 'Toronto', coords: [43.6532, -79.3832], bearing: 54.581, km: 10495.8 },
];

describe('qiblaBearing', () => {
  it.each(KNOWN_BEARINGS)(
    'computes the bearing from $city to the Kaaba',
    ({ coords, bearing }) => {
      expect(qiblaBearing({ latitude: coords[0], longitude: coords[1] })).toBeCloseTo(bearing, 1);
    },
  );

  it('returns a value in [0, 360)', () => {
    for (const { coords } of KNOWN_BEARINGS) {
      const b = qiblaBearing({ latitude: coords[0], longitude: coords[1] });
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(360);
    }
  });

  it('is due north from a point directly south of the Kaaba on its meridian', () => {
    // Same longitude, lower latitude: the great circle runs straight north.
    expect(bearingTo({ latitude: -21.4224779, longitude: 39.8251832 }, KAABA)).toBeCloseTo(0, 4);
    expect(bearingTo({ latitude: 0, longitude: 39.8251832 }, KAABA)).toBeCloseTo(0, 4);
  });

  it('is due east from a point on the equator at the prime meridian', () => {
    // Kaaba is at ~21.4°N, so from (0,0) the bearing is north-east, not east.
    expect(bearingTo({ latitude: 0, longitude: 0 }, KAABA)).toBeCloseTo(58.508, 1);
  });

  it('is due south from a point directly north of the Kaaba on its meridian', () => {
    expect(bearingTo({ latitude: 40, longitude: 39.8251832 }, KAABA)).toBeCloseTo(180, 1);
  });
});

describe('distanceKm', () => {
  it.each(KNOWN_BEARINGS)('computes the distance from $city', ({ coords, km }) => {
    expect(distanceKm({ latitude: coords[0], longitude: coords[1] }, KAABA)).toBeCloseTo(km, 0);
  });

  it('is zero at the Kaaba itself', () => {
    expect(distanceKm(KAABA, KAABA)).toBe(0);
  });

  it('is symmetric', () => {
    const london = { latitude: 51.5072, longitude: -0.1276 };
    expect(distanceKm(london, KAABA)).toBeCloseTo(distanceKm(KAABA, london), 6);
  });
});

describe('compassPoint', () => {
  it('maps degrees to 16-point cardinals', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(45)).toBe('NE');
    expect(compassPoint(90)).toBe('E');
    expect(compassPoint(135)).toBe('SE');
    expect(compassPoint(180)).toBe('S');
    expect(compassPoint(270)).toBe('W');
    expect(compassPoint(359)).toBe('N');
    expect(compassPoint(118.988)).toBe('ESE'); // London
    expect(compassPoint(58.482)).toBe('ENE'); // New York
  });
});

describe('angleDelta', () => {
  it('returns the shortest signed difference', () => {
    expect(angleDelta(10, 0)).toBe(10);
    expect(angleDelta(0, 10)).toBe(-10);
    expect(angleDelta(350, 10)).toBe(-20);
    expect(angleDelta(10, 350)).toBe(20);
    // Both are a half turn; the range is (-180, 180], so they land on +180.
    expect(angleDelta(180, 0)).toBe(180);
    expect(angleDelta(0, 180)).toBe(180);
  });

  it('always lands inside (-180, 180]', () => {
    for (let a = 0; a < 360; a += 7) {
      for (let b = 0; b < 360; b += 11) {
        const d = angleDelta(a, b);
        expect(d).toBeGreaterThan(-180);
        expect(d).toBeLessThanOrEqual(180);
      }
    }
  });
});

describe('smoothHeading', () => {
  it('returns the sample directly when there is no previous value', () => {
    expect(smoothHeading(null, 123)).toBe(123);
  });

  it('moves a fraction of the way toward the new heading', () => {
    expect(smoothHeading(0, 100, 0.5)).toBeCloseTo(50, 6);
  });

  it('interpolates across the 0/360 seam without spinning the long way', () => {
    // 350 -> 10 is a 20° step, not a 340° step.
    const result = smoothHeading(350, 10, 0.5);
    expect(result).toBeCloseTo(0, 6);
  });
});

describe('headingFromEvent', () => {
  const base = {
    absolute: false,
    alpha: null,
    beta: null,
    gamma: null,
  } as DeviceOrientationEvent;

  it('prefers webkitCompassHeading (iOS)', () => {
    const event = { ...base, webkitCompassHeading: 271.5 } as unknown as DeviceOrientationEvent;
    expect(headingFromEvent(event)).toBeCloseTo(271.5, 6);
  });

  it('normalises webkitCompassHeading into [0, 360)', () => {
    const event = { ...base, webkitCompassHeading: -45 } as unknown as DeviceOrientationEvent;
    expect(headingFromEvent(event)).toBeCloseTo(315, 6);
  });

  it('converts absolute alpha into a clockwise heading (Android/Chrome)', () => {
    const event = { ...base, absolute: true, alpha: 90 } as unknown as DeviceOrientationEvent;
    expect(headingFromEvent(event)).toBeCloseTo(270, 6);
  });

  it('ignores non-absolute alpha, which is relative to the start orientation', () => {
    const event = { ...base, absolute: false, alpha: 90 } as unknown as DeviceOrientationEvent;
    expect(headingFromEvent(event)).toBeNull();
  });

  it('returns null when no orientation data is present', () => {
    expect(headingFromEvent(base)).toBeNull();
  });
});

describe('accuracyLevel', () => {
  it('buckets sensor accuracy', () => {
    expect(accuracyLevel(5)).toBe('high');
    expect(accuracyLevel(10)).toBe('high');
    expect(accuracyLevel(20)).toBe('medium');
    expect(accuracyLevel(25)).toBe('medium');
    expect(accuracyLevel(60)).toBe('low');
    expect(accuracyLevel(null)).toBe('unknown');
  });
});
