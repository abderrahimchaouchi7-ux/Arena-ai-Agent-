import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Compass,
  Navigation,
  AlertTriangle,
  Map as MapIcon,
  RefreshCcw,
  Info,
  ExternalLink,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Button, Card, CardHeader, Notice, PageHeader, StatRow, SegmentedControl } from '@/components/ui';
import { useSettings } from '@/state/settings';
import { useGeolocation } from '@/hooks';
import {
  KAABA,
  accuracyLevel,
  angleDelta,
  compassPoint,
  distanceKm,
  formatBearing,
  headingFromEvent,
  qiblaBearing,
  requestOrientationPermission,
  smoothHeading,
  supportsOrientationSensor,
  type SensorState,
} from '@/lib/qibla';

type View = 'compass' | 'map';

export default function QiblaPage() {
  const { t } = useTranslation();
  const location = useSettings((s) => s.location);
  const setLocation = useSettings((s) => s.setLocation);
  const geo = useGeolocation();
  const [view, setView] = useState<View>('compass');

  const [sensorState, setSensorState] = useState<SensorState>(
    supportsOrientationSensor() ? 'unavailable' : 'unsupported',
  );
  const [heading, setHeading] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const headingRef = useRef<number | null>(null);

  const bearing = useMemo(() => qiblaBearing(location), [location]);
  const km = useMemo(() => distanceKm(location, KAABA), [location]);
  const isDefaultLocation =
    Math.abs(location.latitude - KAABA.latitude) < 0.001 &&
    Math.abs(location.longitude - KAABA.longitude) < 0.001;

  // Attach / detach the orientation listener.
  useEffect(() => {
    if (!listening) return;

    const handler = (event: DeviceOrientationEvent) => {
      const value = headingFromEvent(event);
      if (value === null) {
        setSensorState('unavailable');
        return;
      }
      const w = event as DeviceOrientationEvent & { webkitCompassAccuracy?: number };
      const acc =
        typeof w.webkitCompassAccuracy === 'number' && Number.isFinite(w.webkitCompassAccuracy)
          ? w.webkitCompassAccuracy
          : null;

      setSensorState('active');
      setAccuracy(acc);
      // Smooth across the 0/360 seam so the needle glides instead of spinning.
      headingRef.current = smoothHeading(headingRef.current, value);
      setHeading(headingRef.current);
    };

    window.addEventListener('deviceorientationabsolute', handler as EventListener, true);
    window.addEventListener('deviceorientation', handler as EventListener, true);
    return () => {
      window.removeEventListener('deviceorientationabsolute', handler as EventListener, true);
      window.removeEventListener('deviceorientation', handler as EventListener, true);
    };
  }, [listening]);

  // If nothing has arrived a second after subscribing, say so plainly.
  useEffect(() => {
    if (!listening) return;
    const id = window.setTimeout(() => {
      if (headingRef.current === null) setSensorState('unavailable');
    }, 1500);
    return () => window.clearTimeout(id);
  }, [listening]);

  const startCompass = async () => {
    headingRef.current = null;
    setHeading(null);
    setSensorState('unavailable');
    const granted = await requestOrientationPermission();
    if (!granted) {
      setSensorState('permission-denied');
      return;
    }
    setListening(true);
  };

  const stopCompass = () => {
    setListening(false);
    setSensorState(supportsOrientationSensor() ? 'unavailable' : 'unsupported');
  };

  const adoptDetected = () => {
    if (geo.coords) {
      setLocation({
        latitude: geo.coords.latitude,
        longitude: geo.coords.longitude,
        label: `${geo.coords.latitude.toFixed(4)}, ${geo.coords.longitude.toFixed(4)}`,
        automatic: true,
        updatedAt: Date.now(),
      });
    }
  };

  const delta = heading === null ? null : angleDelta(bearing, heading);
  const accuracyText =
    accuracyLevel(accuracy) === 'high'
      ? t('qibla.accuracyHigh')
      : accuracyLevel(accuracy) === 'medium'
        ? t('qibla.accuracyMedium')
        : accuracyLevel(accuracy) === 'low'
          ? t('qibla.accuracyLow')
          : t('qibla.accuracyUnknown');

  const mapUrl = `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=6/${location.latitude}/${location.longitude}`;

  return (
    <div className="space-y-4">
      <PageHeader title={t('qibla.title')} subtitle={t('qibla.subtitle')} />

      {isDefaultLocation ? (
        <Notice tone="warning" icon={<AlertTriangle className="h-4 w-4 text-warning" aria-hidden />}>
          {t('qibla.usingDefault')}
        </Notice>
      ) : null}

      <Card>
        <CardHeader icon={<Compass className="h-5 w-5" aria-hidden />} title={t('qibla.bearing')} />

        <div className="flex flex-col items-center gap-4 py-2 sm:flex-row sm:items-center">
          {/* Compass dial */}
          <div
            className="relative h-56 w-56 shrink-0 rounded-full border border-border bg-surface-2"
            role="img"
            aria-label={`${t('qibla.bearing')}: ${formatBearing(bearing)} ${t('qibla.fromNorth')}`}
          >
            {/* Cardinal marks */}
            {(['N', 'E', 'S', 'W'] as const).map((label, i) => (
              <span
                key={label}
                className="absolute text-[11px] font-bold text-muted"
                style={{
                  top: `${50 - 44 * Math.cos((i * 90 * Math.PI) / 180)}%`,
                  left: `${50 + 44 * Math.sin((i * 90 * Math.PI) / 180)}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                aria-hidden
              >
                {label}
              </span>
            ))}

            {/* Rotating dial: turns with the phone so north stays truthful. */}
            <div
              className="absolute inset-0 transition-transform duration-200 ease-smooth"
              style={{ transform: `rotate(${heading === null ? 0 : -heading}deg)` }}
              aria-hidden
            >
              {/* Qibla indicator */}
              <div
                className="absolute inset-0"
                style={{ transform: `rotate(${bearing}deg)` }}
              >
                <div className="absolute left-1/2 top-3 flex -translate-x-1/2 flex-col items-center">
                  <svg viewBox="0 0 24 24" className="h-8 w-8 text-accent" fill="currentColor" aria-hidden>
                    <path d="M4 20 20 4l-4 12-4-2-2 4-4-2z" opacity=".9" />
                    <rect x="9" y="9" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                </div>
              </div>
              {/* North pointer */}
              <div className="absolute left-1/2 top-1.5 h-3 w-0.5 -translate-x-1/2 rounded-full bg-danger" />
            </div>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tabular">{formatBearing(bearing)}</span>
              <span className="text-xs text-muted">{compassPoint(bearing)}</span>
              {heading !== null ? (
                <span className="mt-1 text-[11px] text-muted tabular">
                  {t('qibla.heading')}: {formatBearing(heading)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="w-full min-w-0 space-y-1">
            <dl>
              <StatRow label={t('qibla.bearing')} value={`${formatBearing(bearing)} · ${compassPoint(bearing)}`} />
              <StatRow label={t('qibla.distance')} value={`${Math.round(km).toLocaleString()} km`} />
              <StatRow
                label={t('qibla.liveHeading')}
                value={heading === null ? t('qibla.sensorInactive') : `${formatBearing(heading)} · ${compassPoint(heading)}`}
              />
              <StatRow label={t('location.title')} value={location.label} />
            </dl>

            {delta !== null ? (
              <p
                className={clsx(
                  'mt-2 rounded-lg px-3 py-2 text-sm font-medium',
                  Math.abs(delta) < 5
                    ? 'bg-success/10 text-success'
                    : 'bg-accent/10 text-fg',
                )}
              >
                {Math.abs(delta) < 5
                  ? t('qibla.facingQibla')
                  : t('qibla.turnTo', {
                      direction: delta < 0 ? t('qibla.left') : t('qibla.right'),
                    })}
              </p>
            ) : null}
          </div>
        </div>

        {/* Sensor controls */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {sensorState === 'unsupported' ? (
            <span className="chip">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {t('qibla.sensorUnsupported')}
            </span>
          ) : listening ? (
            <>
              <Button variant="outline" size="sm" onClick={stopCompass}>
                {t('qibla.stopCompass')}
              </Button>
              <span className="chip chip-active">
                <RefreshCcw className="h-3.5 w-3.5 animate-spin-slow" aria-hidden />
                {t('qibla.sensorActive')}
              </span>
              <span className="chip">{accuracyText}</span>
            </>
          ) : (
            <Button variant="primary" size="sm" onClick={startCompass} icon={<Navigation className="h-4 w-4" aria-hidden />}>
              {t('qibla.enableCompass')}
            </Button>
          )}
        </div>

        {sensorState === 'unsupported' ? (
          <Notice tone="warning" title={t('qibla.sensorUnsupported')} className="mt-3">
            {t('qibla.sensorUnsupportedBody')}
          </Notice>
        ) : null}

        {sensorState === 'permission-denied' ? (
          <Notice tone="warning" title={t('qibla.sensorDenied')} className="mt-3">
            {t('qibla.iosPermission')}
          </Notice>
        ) : null}

        {sensorState === 'active' && accuracyLevel(accuracy) === 'low' ? (
          <Notice tone="warning" title={t('qibla.calibrate')} className="mt-3">
            {t('qibla.calibrateHint')}
          </Notice>
        ) : null}
      </Card>

      <Card>
        <CardHeader icon={<MapIcon className="h-5 w-5" aria-hidden />} title={t('location.title')} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            loading={geo.status === 'locating'}
            onClick={geo.locate}
            icon={<Navigation className="h-4 w-4" aria-hidden />}
          >
            {geo.status === 'locating' ? t('location.detecting') : t('location.detect')}
          </Button>
          {geo.status === 'granted' && geo.coords ? (
            <Button variant="outline" size="sm" onClick={adoptDetected}>
              {t('location.useThis')} ({geo.coords.latitude.toFixed(3)}, {geo.coords.longitude.toFixed(3)})
            </Button>
          ) : null}
        </div>
        {geo.status === 'denied' ? (
          <Notice tone="warning" title={t('location.denied')} className="mt-3">
            {t('location.deniedBody')}
          </Notice>
        ) : null}
        {geo.status === 'unavailable' ? (
          <Notice tone="warning" title={t('location.unavailable')} className="mt-3">
            {t('location.unavailableBody')}
          </Notice>
        ) : null}
        {geo.status === 'error' ? (
          <Notice tone="warning" className="mt-3">
            {t('location.timeout')}
          </Notice>
        ) : null}
      </Card>

      <SegmentedControl<View>
        ariaLabel={t('qibla.mapView')}
        value={view}
        onChange={setView}
        options={[
          { value: 'compass', label: t('qibla.title') },
          { value: 'map', label: t('qibla.mapView') },
        ]}
      />

      {view === 'map' ? (
        <Card>
          <CardHeader title={t('qibla.mapView')} subtitle={t('qibla.mapNote')} />
          {/*
            Leaflet needs network tiles, which contradicts the offline-first
            guarantee. Linking out to OpenStreetMap keeps the map view genuinely
            functional without pulling in a tile dependency the app can't honour.
          */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-surface-2">
            <BearingSchematic bearing={bearing} />
          </div>
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-outline btn-sm mt-3 inline-flex"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            OpenStreetMap
          </a>
        </Card>
      ) : null}

      <Notice tone="info" icon={<Info className="h-4 w-4" aria-hidden />}>
        {t('qibla.geographicNote')} {t('qibla.magneticWarning')}
      </Notice>
    </div>
  );
}

/**
 * Offline bearing schematic.
 *
 * This is deliberately not a map: real tiles need the network, which the
 * offline-first guarantee cannot honour. It draws the computed great-circle
 * bearing as a labelled compass diagram, and the OpenStreetMap link below
 * gives the user a real map when they are online.
 */
function BearingSchematic({ bearing }: { bearing: number }) {
  const { t } = useTranslation();
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg viewBox="0 0 200 200" className="h-full w-full" role="img" aria-label={t('qibla.bearing')}>
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0v20" fill="none" stroke="rgb(var(--c-border))" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="200" height="200" fill="url(#grid)" />
        <g transform="rotate(0 100 100)">
          <line
            x1="100"
            y1="100"
            x2={100 + 80 * Math.sin((bearing * Math.PI) / 180)}
            y2={100 - 80 * Math.cos((bearing * Math.PI) / 180)}
            stroke="rgb(var(--c-accent))"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>
        <circle cx="100" cy="100" r="5" fill="rgb(var(--c-fg))" />
        <text x="100" y="124" textAnchor="middle" fontSize="9" fill="rgb(var(--c-muted))">
          {t('location.currentLocation')}
        </text>
        <text x="100" y="18" textAnchor="middle" fontSize="10" fill="rgb(var(--c-muted))">
          N
        </text>
      </svg>
    </div>
  );
}
