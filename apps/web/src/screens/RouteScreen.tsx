import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FUEL_TYPES,
  fuelTypeLabels,
  loadRatioLabels,
  type EstimateResponse,
  type FuelPriceDto,
  type FuelType,
  type LoadRatio,
  type PlaceDto,
  type VehicleTypeDto,
} from '@fce/contracts';
import { ApiError, api } from '../api';
import { LoadGlyph, VehicleGlyph } from '../components/Glyphs';
import { Money, num, compactDate } from '../components/Money';
import { PlacePicker } from '../components/PlacePicker';
import { translate, type Lang } from '../i18n';
import { normalizeDigits, parseDecimal, formatDuration } from '../numbers';
import type { Profile } from '../storage';
import type { TripSummary } from '../types';

interface Props {
  vehicleTypes: VehicleTypeDto[];
  prices: FuelPriceDto[];
  profile: Profile;
  lang: Lang;
  onEditProfile: () => void;
  onDone: (estimate: EstimateResponse, summary: TripSummary) => void;
}

interface RouteInfo {
  km: number | null;
  durationS: number | null;
  loading: boolean;
  failed: boolean;
}

export function RouteScreen({ vehicleTypes, prices, profile, lang, onEditProfile, onDone }: Props) {
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const vehicle = useMemo(
    () => vehicleTypes.find((type) => type.code === profile.vehicleTypeCode) ?? null,
    [vehicleTypes, profile.vehicleTypeCode],
  );
  const isGoods = vehicle?.class === 'goods';

  const [origin, setOrigin] = useState<PlaceDto | null>(null);
  const [destination, setDestination] = useState<PlaceDto | null>(null);
  const [originPickerOpen, setOriginPickerOpen] = useState(false);
  const [destinationPickerOpen, setDestinationPickerOpen] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo>({ km: null, durationS: null, loading: false, failed: false });
  const [manualMode, setManualMode] = useState(false);
  const [manualKm, setManualKm] = useState('');

  const [fuelType, setFuelType] = useState<FuelType>(isGoods ? 'diesel' : 'petrol');
  const [loadRatio, setLoadRatio] = useState<LoadRatio>(0);
  const [returnEmpty, setReturnEmpty] = useState(profile.vehicleTypeCode === 'taxi');
  const [tolls, setTolls] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousGoods = useRef(isGoods);
  const previousCode = useRef(profile.vehicleTypeCode);

  useEffect(() => {
    if (previousCode.current !== profile.vehicleTypeCode) {
      setReturnEmpty(profile.vehicleTypeCode === 'taxi');
      previousCode.current = profile.vehicleTypeCode;
    }
  }, [profile.vehicleTypeCode]);

  useEffect(() => {
    if (previousGoods.current !== isGoods) {
      setFuelType(isGoods ? 'diesel' : 'petrol');
      setLoadRatio(0);
      setReturnEmpty(!isGoods && profile.vehicleTypeCode === 'taxi');
      previousGoods.current = isGoods;
    }
  }, [isGoods, profile.vehicleTypeCode]);

  useEffect(() => {
    if (!origin || !destination || manualMode) return;
    let cancelled = false;
    setRouteInfo({ km: null, durationS: null, loading: true, failed: false });
    api
      .route({ lat: origin.lat, lng: origin.lng }, { lat: destination.lat, lng: destination.lng })
      .then((result) => {
        if (!cancelled)
          setRouteInfo({
            km: Math.round(result.distanceKm * 10) / 10,
            durationS: Number.isFinite(result.durationS) ? result.durationS : null,
            loading: false,
            failed: false,
          });
      })
      .catch(() => {
        if (!cancelled) setRouteInfo({ km: null, durationS: null, loading: false, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [origin, destination, manualMode]);

  const localKm = parseDecimal(manualKm);
  const distanceKm = manualMode ? localKm : routeInfo.km;
  const routeDurationS =
    manualMode || routeInfo.durationS === null ? null : routeInfo.durationS * (returnEmpty ? 2 : 1);
  const tollValue = tolls.trim() ? parseDecimal(tolls) ?? 0 : 0;
  const canCalculate = Boolean(vehicle) && Boolean(distanceKm && distanceKm > 0) && profile.kmpl > 0 && !busy;

  function toggleManual() {
    setManualMode((current) => {
      if (!current) {
        const seed = routeInfo.km ?? null;
        if (seed !== null && !manualKm) setManualKm(String(seed));
      }
      return !current;
    });
  }

  function swapPlaces() {
    if (!origin && !destination) return;
    setOrigin(destination);
    setDestination(origin);
  }

  const missingHint = !vehicle
    ? t('vehicle.chooseVehicle')
    : !manualMode && routeInfo.loading
      ? t('route.calculatingDistance')
      : !(distanceKm && distanceKm > 0)
        ? t('route.missing')
        : profile.kmpl <= 0
          ? t('vehicle.kmplInvalid')
          : null;

  async function calculate() {
    if (!vehicle || !distanceKm || distanceKm <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const estimate = await api.estimate({
        vehicleTypeCode: vehicle.code,
        distanceKm,
        fuelType,
        kmpl: profile.kmpl,
        kmplFull: isGoods ? profile.kmplFull : null,
        loadRatio: isGoods ? loadRatio : 0,
        tolls: Math.max(0, tollValue),
        returnEmpty,
      });
      const originName = origin ? { ur: origin.nameUr ?? origin.name, en: origin.name } : null;
      const destinationName = destination ? { ur: destination.nameUr ?? destination.name, en: destination.name } : null;
      onDone(estimate, {
        origin: originName,
        destination: destinationName,
        distanceKm,
        durationS: routeDurationS,
        fuelType,
        loadRatio: isGoods ? loadRatio : 0,
        returnEmpty,
      });
    } catch (caught) {
      setError(caught instanceof ApiError && caught.code === 'network_error' ? t('error.network') : t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  const selectedPrice = prices.find((price) => price.fuelType === fuelType) ?? null;
  const pickerOpen = originPickerOpen || destinationPickerOpen;

  return (
    <section className="screen">
      <h1 className="screen-title" tabIndex={-1}>
        {t(isGoods ? 'route.title' : 'route.titlePassenger')}
      </h1>
      <p className="screen-sub">{t(isGoods ? 'route.sub' : 'route.subPassenger')}</p>

      {vehicle ? (
        <button type="button" className="profile-chip" onClick={onEditProfile}>
          <span className="profile-glyph">
            <VehicleGlyph kind={vehicle.pictureKey} />
          </span>
          <span className="profile-text">
            <span className="profile-name">{lang === 'ur' ? vehicle.nameUr : vehicle.nameEn}</span>
            <span className="profile-meta">
              {num(profile.kmpl, 1)} {lang === 'ur' ? 'کلومیٹر فی لیٹر' : 'km/l'}
            </span>
          </span>
          <span className="profile-edit">{t('common.edit')}</span>
        </button>
      ) : null}

      <div className="places">
        <PlacePicker
          lang={lang}
          label={t('route.from')}
          placeholder={t('route.fromPlaceholder')}
          value={origin}
          onChange={(place) => setOrigin(place)}
          onOpenChange={setOriginPickerOpen}
        />
        <button
          type="button"
          className="swap-btn"
          onClick={swapPlaces}
          disabled={!origin && !destination}
        >
          <SwapIcon />
          {t('route.swap')}
        </button>
        <PlacePicker
          lang={lang}
          label={t('route.to')}
          placeholder={t('route.toPlaceholder')}
          value={destination}
          onChange={(place) => setDestination(place)}
          onOpenChange={setDestinationPickerOpen}
        />
      </div>

      <div className="distance-card" aria-busy={!manualMode && routeInfo.loading}>
        <div className="distance-main">
          <span className="field-label">{t('route.distance')}</span>
          {manualMode ? (
            <div className="distance-input">
              <input
                className="input num-input"
                inputMode="decimal"
                autoComplete="off"
                value={manualKm}
                onChange={(event) => setManualKm(normalizeDigits(event.target.value))}
                aria-label={t('route.distance')}
                placeholder="0"
              />
              <span className="unit">{t('route.km')}</span>
            </div>
          ) : (
            <div className="distance-value" aria-live="polite">
              {routeInfo.loading ? (
                <span className="muted">{t('route.calculatingDistance')}</span>
              ) : routeInfo.km !== null ? (
                <>
                  <span className="num-big" dir="ltr">{num(routeInfo.km, 1)}</span>
                  <span className="unit">{t('route.km')}</span>
                </>
              ) : (
                <span className="muted">—</span>
              )}
            </div>
          )}
        </div>
        <button type="button" className="link" onClick={toggleManual}>
          {manualMode ? t('route.useMapDistance') : t('route.editDistance')}
        </button>
        {!manualMode && routeInfo.km !== null && routeDurationS !== null ? (
          <p className="hint distance-time">
            {t(returnEmpty ? 'result.travelTimeRound' : 'route.travelTime')}:{' '}
            <span dir="ltr">{formatDuration(routeDurationS, lang)}</span>
          </p>
        ) : null}
      </div>
      {!manualMode && routeInfo.km === null && !routeInfo.loading ? (
        <p className="hint">{routeInfo.failed ? t('route.missing') : t('route.distanceHint')}</p>
      ) : null}

      <div className="field">
        <span className="field-label">{t('route.fuel')}</span>
        <div className="chips" role="group" aria-label={t('route.fuel')}>
          {FUEL_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={`chip ${fuelType === type ? 'is-active' : ''}`}
              aria-pressed={fuelType === type}
              onClick={() => setFuelType(type)}
            >
              {fuelTypeLabels[type][lang]}
            </button>
          ))}
        </div>
        {selectedPrice ? (
          <p className="hint">
            <Money value={selectedPrice.pricePerLitre} /> {t('common.perLitre')} ·{' '}
            <span dir="ltr">{compactDate(selectedPrice.effectiveFrom)}</span>
          </p>
        ) : (
          <p className="hint hint-warn">{t('error.generic')}</p>
        )}
      </div>

      {isGoods ? (
        <div className="field">
          <span className="field-label">{t('route.load')}</span>
          <div className="load-grid" role="group" aria-label={t('route.load')}>
            {([0, 0.5, 1] as LoadRatio[]).map((level) => (
              <button
                key={level}
                type="button"
                className={`load-tile ${loadRatio === level ? 'is-selected' : ''}`}
                aria-pressed={loadRatio === level}
                onClick={() => setLoadRatio(level)}
              >
                <span className="load-glyph">
                  <LoadGlyph level={level} />
                </span>
                <span className="load-label">{loadRatioLabels[level][lang]}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <label className="switch-row">
        <span className="switch-text">
          <span className="switch-title">{t(isGoods ? 'route.return' : 'route.roundTrip')}</span>
          <span className="switch-sub">{t(isGoods ? 'route.returnHint' : 'route.roundTripHint')}</span>
        </span>
        <input
          type="checkbox"
          className="switch-input"
          checked={returnEmpty}
          onChange={(event) => setReturnEmpty(event.target.checked)}
        />
        <span className="switch-track" aria-hidden>
          <span className="switch-knob" />
        </span>
      </label>

      <div className="field">
        <label className="field-label" htmlFor="tolls">
          {t('route.toll')} <span className="muted">({t('common.optional')})</span>
        </label>
        <input
          id="tolls"
          className="input num-input"
          inputMode="numeric"
          autoComplete="off"
          value={tolls}
          onChange={(event) => setTolls(normalizeDigits(event.target.value).replace(/[^\d]/g, ''))}
          placeholder="0"
        />
        <p className="hint">{t('route.tollHint')}</p>
      </div>

      {error ? (
        <p className="error-box" role="alert">
          {error}
        </p>
      ) : null}

      {!pickerOpen ? (
        <div className="cta-bar">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canCalculate}
            onClick={calculate}
            aria-busy={busy}
          >
            {busy ? t('route.calculating') : t('route.calculate')}
          </button>
          {!canCalculate && !busy && missingHint ? <p className="cta-hint">{missingHint}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function SwapIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden focusable={false}>
      <path d="M7 4v13m0 0-3-3m3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 20V7m0 0 3 3m-3-3-3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
