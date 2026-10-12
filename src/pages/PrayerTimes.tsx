import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock3,
  MapPin,
  Navigation,
  SlidersHorizontal,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  MoonStar,
  CloudSun,
  RotateCcw,
  Search,
  Check,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Button, Card, CardHeader, Chip, Field, Notice, PageHeader, SegmentedControl, IconButton } from '@/components/ui';
import { useCountdown, useGeolocation, usePrayerTimes } from '@/hooks';
import { useSettings } from '@/state/settings';
import {
  CALCULATION_METHODS,
  HIGH_LATITUDE_RULES,
  formatCountdown,
  formatTime,
  formatDate,
  currentTimeZone,
  prayerEntries,
} from '@/lib/prayer';
import { formatHijri } from '@/lib/hijri';
import { searchCities } from '@/lib/search';
import { ALL_PRAYERS, type LanguageId, type PrayerKey } from '@/lib/types';
import type { CalculationMethodId, MadhabId, HighLatitudeRuleId } from '@/lib/types';

const PRAYER_ICONS: Record<PrayerKey, typeof Sun> = {
  fajr: Sunrise,
  sunrise: CloudSun,
  dhuhr: Sun,
  asr: Sunset,
  maghrib: MoonStar,
  isha: Moon,
};

function LocationPanel() {
  const { t } = useTranslation();
  const location = useSettings((s) => s.location);
  const setLocation = useSettings((s) => s.setLocation);
  const setLocationStatus = useSettings((s) => s.setLocationStatus);
  const geo = useGeolocation();
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [cityQuery, setCityQuery] = useState('');

  const cities = useMemo(() => searchCities(cityQuery, 12), [cityQuery]);

  const handleDetect = () => {
    geo.locate();
    setLocationStatus({ state: 'locating' });
  };

  // Adopt the resolved position once the geolocation API reports back.
  useMemo(() => {
    if (geo.status === 'granted' && geo.coords) {
      setLocation({
        latitude: geo.coords.latitude,
        longitude: geo.coords.longitude,
        label: `${geo.coords.latitude.toFixed(3)}, ${geo.coords.longitude.toFixed(3)}`,
        automatic: true,
        updatedAt: Date.now(),
      });
    } else if (geo.status === 'denied') {
      setLocationStatus({ state: 'denied', message: t('location.denied') });
    } else if (geo.status === 'unavailable') {
      setLocationStatus({ state: 'unavailable', message: t('location.unavailable') });
    } else if (geo.status === 'error') {
      setLocationStatus({ state: 'error', message: t('location.timeout') });
    }
  }, [geo.status, geo.coords, setLocation, setLocationStatus, t]);

  return (
    <Card>
      <CardHeader
        icon={<MapPin className="h-5 w-5" aria-hidden />}
        title={t('location.title')}
        subtitle={location.label}
        action={
          <span className="chip">
            {location.automatic ? t('location.locationAuto') : t('location.locationManual')}
          </span>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          variant="primary"
          loading={geo.status === 'locating'}
          onClick={handleDetect}
          icon={<Navigation className="h-4 w-4" aria-hidden />}
        >
          {geo.status === 'locating' ? t('location.detecting') : t('location.detect')}
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowCityPicker((v) => !v)}
          icon={<Search className="h-4 w-4" aria-hidden />}
        >
          {t('location.manual')}
        </Button>
      </div>

      {geo.coords?.accuracy ? (
        <p className="mt-2 text-xs text-muted tabular">
          {t('location.precision')}: ±{Math.round(geo.coords.accuracy)} m
        </p>
      ) : null}

      {geo.status === 'denied' ? (
        <Notice tone="warning" icon={<AlertTriangle className="h-4 w-4 text-warning" aria-hidden />} title={t('location.denied')} >
          {t('location.deniedBody')}
        </Notice>
      ) : null}
      {geo.status === 'unavailable' ? (
        <Notice tone="warning" title={t('location.unavailable')}>
          {t('location.unavailableBody')}
        </Notice>
      ) : null}
      {geo.status === 'error' ? (
        <Notice tone="warning" title={t('location.timeout')}>
          {t('location.timeout')}
        </Notice>
      ) : null}

      {showCityPicker ? (
        <div className="mt-4 animate-slide-up">
          <Field label={t('location.searchCity')} htmlFor="city-search">
            <input
              id="city-search"
              className="field"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder={t('location.searchCity')}
              autoComplete="off"
            />
          </Field>
          <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto pe-1">
            {cities.map((city) => {
              const selected =
                Math.abs(city.latitude - location.latitude) < 0.01 &&
                Math.abs(city.longitude - location.longitude) < 0.01;
              return (
                <li key={`${city.name}-${city.country}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setLocation({
                        latitude: city.latitude,
                        longitude: city.longitude,
                        label: `${city.name}, ${city.country}`,
                        country: city.country,
                        timezone: city.timezone,
                        automatic: false,
                        updatedAt: Date.now(),
                      });
                      setShowCityPicker(false);
                    }}
                    className={clsx(
                      'flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-start text-sm transition-colors hover:border-accent/40',
                      selected && 'border-accent/60 bg-accent/5',
                    )}
                  >
                    <span className="min-w-0 truncate">{city.name}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted tabular">
                      {city.country}
                      {selected ? <Check className="h-4 w-4 text-accent" aria-hidden /> : null}
                    </span>
                  </button>
                </li>
              );
            })}
            {cities.length === 0 ? (
              <li className="py-4 text-center text-sm text-muted">{t('common.noResults')}</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <Notice icon={<Info className="h-4 w-4" aria-hidden />} title={t('location.whyTitle')}>
        {t('location.whyBody')}
      </Notice>
    </Card>
  );
}

function AdjustmentRow({ prayer }: { prayer: PrayerKey }) {
  const { t } = useTranslation();
  const value = useSettings((s) => s.adjustments[prayer]);
  const setAdjustment = useSettings((s) => s.setAdjustment);

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm">{t(`prayers.${prayer}`)}</span>
      <div className="flex items-center gap-1.5">
        <IconButton label={`-${t('prayers.manualAdjustments')} ${t(`prayers.${prayer}`)}`} onClick={() => setAdjustment(prayer, value - 1)}>
          <span className="text-lg leading-none">−</span>
        </IconButton>
        <span className="w-14 text-center text-sm font-medium tabular">
          {value > 0 ? `+${value}` : value}
        </span>
        <IconButton label={`+${t('prayers.manualAdjustments')} ${t(`prayers.${prayer}`)}`} onClick={() => setAdjustment(prayer, value + 1)}>
          <span className="text-lg leading-none">+</span>
        </IconButton>
      </div>
    </div>
  );
}

function CalculationPanel() {
  const { t } = useTranslation();
  const method = useSettings((s) => s.method);
  const madhab = useSettings((s) => s.madhab);
  const highLatitudeRule = useSettings((s) => s.highLatitudeRule);
  const setMethod = useSettings((s) => s.setMethod);
  const setMadhab = useSettings((s) => s.setMadhab);
  const setHighLatitudeRule = useSettings((s) => s.setHighLatitudeRule);
  const resetAdjustments = useSettings((s) => s.resetAdjustments);
  const [showAdjustments, setShowAdjustments] = useState(false);

  const selected = CALCULATION_METHODS.find((m) => m.id === method);

  return (
    <Card>
      <CardHeader
        icon={<SlidersHorizontal className="h-5 w-5" aria-hidden />}
        title={t('prayers.method')}
        subtitle={selected ? `${selected.label} — ${selected.convention}` : undefined}
      />

      <div className="flex flex-wrap gap-1.5">
        {CALCULATION_METHODS.map((m) => (
          <Chip key={m.id} active={m.id === method} onClick={() => setMethod(m.id as CalculationMethodId)}>
            {m.label}
          </Chip>
        ))}
      </div>

      <div className="mt-4">
        <p className="label">{t('prayers.asrMadhab')}</p>
        <SegmentedControl<MadhabId>
          ariaLabel={t('prayers.asrMadhab')}
          value={madhab}
          onChange={setMadhab}
          options={[
            { value: 'shafi', label: t('prayers.madhabShafi') },
            { value: 'hanafi', label: t('prayers.madhabHanafi') },
          ]}
        />
      </div>

      <div className="mt-4">
        <p className="label">{t('prayers.highLatitude')}</p>
        <SegmentedControl<HighLatitudeRuleId>
          ariaLabel={t('prayers.highLatitude')}
          size="sm"
          value={highLatitudeRule}
          onChange={setHighLatitudeRule}
          options={HIGH_LATITUDE_RULES.map((r) => ({ value: r.id, label: t(r.key) }))}
        />
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowAdjustments((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm font-medium"
          aria-expanded={showAdjustments}
        >
          {t('prayers.manualAdjustments')}
          <span className="text-muted">{showAdjustments ? '−' : '+'}</span>
        </button>
        {showAdjustments ? (
          <div className="mt-2 animate-slide-up">
            <p className="mb-2 text-xs text-muted">{t('prayers.adjustmentsHelp')}</p>
            <div className="divide-y divide-border">
              {ALL_PRAYERS.map((prayer) => (
                <AdjustmentRow key={prayer} prayer={prayer} />
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={resetAdjustments}
              icon={<RotateCcw className="h-4 w-4" aria-hidden />}
            >
              {t('prayers.resetAdjustments')}
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export default function PrayerTimesPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.language as LanguageId;
  const hour12 = useSettings((s) => s.hour12);
  const location = useSettings((s) => s.location);
  const hijriOffset = useSettings((s) => s.hijriOffset);
  const [offsetDays, setOffsetDays] = useState(0);

  const displayDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d;
  }, [offsetDays]);

  const { today, tomorrow, error } = usePrayerTimes(displayDate);
  const { next } = useCountdown();
  const hijri = formatHijri(displayDate, language, hijriOffset);

  if (error || !today || !tomorrow) {
    return (
      <div>
        <PageHeader title={t('nav.prayerTimes')} />
        <Notice tone="warning" title={t('common.error')}>
          {error ?? t('common.errorGeneric')}
        </Notice>
      </div>
    );
  }

  const entries = prayerEntries(today);
  const nextKey = offsetDays === 0 ? next?.key : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('prayers.todaySchedule')}
        subtitle={formatDate(displayDate, language)}
        actions={
          <div className="flex items-center gap-1">
            <IconButton label={t('common.yesterday')} onClick={() => setOffsetDays((d) => d - 1)}>
              <span className="text-lg leading-none rtl:rotate-180">‹</span>
            </IconButton>
            <button
              type="button"
              onClick={() => setOffsetDays(0)}
              className={clsx('chip', offsetDays === 0 && 'chip-active')}
            >
              {offsetDays === 0 ? t('common.today') : offsetDays > 0 ? `+${offsetDays}` : offsetDays}
            </button>
            <IconButton label={t('common.tomorrow')} onClick={() => setOffsetDays((d) => d + 1)}>
              <span className="text-lg leading-none rtl:rotate-180">›</span>
            </IconButton>
          </div>
        }
      />

      <p className="text-sm text-muted">{hijri.formatted}</p>

      <LocationPanel />

      <Card>
        <CardHeader icon={<Clock3 className="h-5 w-5" aria-hidden />} title={t('prayers.todaySchedule')} />
        <ul className="divide-y divide-border">
          {entries.map(({ key, time }) => {
            const Icon = PRAYER_ICONS[key];
            const isNext = key === nextKey;
            const isPassed = offsetDays === 0 && time.getTime() < Date.now();
            return (
              <li
                key={key}
                className={clsx(
                  'flex items-center gap-3 py-3 transition-colors',
                  isNext && 'rounded-lg bg-accent/5 px-2 -mx-2',
                )}
              >
                <span
                  className={clsx(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                    isNext ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-muted',
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className={clsx('flex-1 text-sm font-medium', isPassed && !isNext && 'text-muted')}>
                  {t(`prayers.${key}`)}
                  {isNext ? (
                    <span className="ms-2 text-xs font-normal text-accent">
                      {formatCountdown(next?.msUntil ?? 0)}
                    </span>
                  ) : null}
                </span>
                <span className="text-sm font-semibold tabular">
                  {formatTime(time, language, hour12 ?? undefined)}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted">
          <div className="flex justify-between gap-3">
            <span>{t('prayers.midnight')}</span>
            <span className="tabular">
              {formatTime(
                new Date(
                  (today.maghrib.getTime() + tomorrow.fajr.getTime()) / 2,
                ),
                language,
                hour12 ?? undefined,
              )}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span>{t('prayers.lastThird')}</span>
            <span className="tabular">
              {formatTime(
                new Date(
                  today.maghrib.getTime() +
                    ((tomorrow.fajr.getTime() - today.maghrib.getTime()) * 2) / 3,
                ),
                language,
                hour12 ?? undefined,
              )}
            </span>
          </div>
        </div>
      </Card>

      <CalculationPanel />

      <Card>
        <CardHeader title={t('prayers.location')} />
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{t('prayers.coordinates')}</dt>
            <dd className="font-medium tabular" dir="ltr">
              {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{t('prayers.timezone')}</dt>
            <dd className="font-medium">
              {Intl.DateTimeFormat().resolvedOptions().timeZone ?? currentTimeZone() ?? '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{t('prayers.currentTime')}</dt>
            <dd className="font-medium tabular">
              {formatTime(new Date(), language, hour12 ?? undefined)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
          {t('prayers.calculatedLocally')}
        </p>
      </Card>
    </div>
  );
}
