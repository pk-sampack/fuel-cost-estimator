import { fuelTypeLabels, loadRatioLabels, type LoadRatio } from '@fce/contracts';
import { Money, compactDate, num } from '../components/Money';
import { translate, type Lang } from '../i18n';
import type { Profile } from '../storage';
import type { ResultBundle } from '../types';

interface Props {
  bundle: ResultBundle;
  profile: Profile;
  lang: Lang;
  onEditTrip: () => void;
  onEditProfile: () => void;
}

const WARNING_KEYS: Record<string, string> = {
  fuel_price_stale: 'warn.stale',
  fuel_price_placeholder: 'warn.placeholder',
  kmpl_outside_typical_range: 'warn.kmpl',
};

export function ResultScreen({ bundle, profile, lang, onEditTrip, onEditProfile }: Props) {
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const { estimate, summary } = bundle;
  const vehicleName = lang === 'ur' ? estimate.vehicleType.nameUr : estimate.vehicleType.nameEn;
  const fuelLabel = fuelTypeLabels[summary.fuelType][lang];
  const loadLabel = loadRatioLabels[summary.loadRatio as LoadRatio][lang];

  const tripLine =
    summary.origin && summary.destination
      ? lang === 'ur'
        ? `${summary.origin.ur} سے ${summary.destination.ur}`
        : `${summary.origin.en} to ${summary.destination.en}`
      : `${num(summary.distanceKm, 1)} ${t('route.km')}`;

  const kmPerLitre = lang === 'ur' ? 'کلومیٹر/لیٹر' : 'km/l';

  const shareText = buildShareText(bundle, lang);
  const warnings = estimate.warnings.filter((warning) => WARNING_KEYS[warning]);

  async function share() {
    const shareNavigator = navigator as Navigator & {
      share?: (data: { title: string; text: string }) => Promise<void>;
    };
    if (typeof shareNavigator.share === 'function') {
      try {
        await shareNavigator.share({ title: t('app.name'), text: shareText });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="screen">
      <h1 className="screen-title" tabIndex={-1}>
        {t('result.title')}
      </h1>
      <p className="screen-sub trip-line">{tripLine}</p>

      <div className="result-hero">
        <div className="hero-top">
          <span className="hero-label">{t('result.total')}</span>
          <span className="estimate-chip">{t('result.estimateChip')}</span>
        </div>
        <div className="hero-value">
          <Money value={estimate.total} hero />
          <span className="hero-currency">{t('common.rs')}</span>
        </div>
        <p className="hero-meta">
          {vehicleName} · {fuelLabel} · {num(summary.distanceKm, 1)} {t('route.km')}
          {estimate.vehicleType.class === 'goods' ? ` · ${loadLabel}` : ''}
        </p>
      </div>

      {warnings.length > 0 ? (
        <div className="notice">
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{t(WARNING_KEYS[warning] ?? 'error.generic')}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <h2 className="section-title">{t('result.breakdown')}</h2>
      <div className="rows">
        {estimate.legs.map((leg) => (
          <div className="row" key={leg.label}>
            <span className="row-label">
              {leg.label === 'return' ? t('result.returnLeg') : t('result.outbound')}
              {leg.label === 'outbound' && estimate.vehicleType.class === 'goods' ? (
                <span className="row-sub">
                  {loadRatioLabels[leg.loadRatio as LoadRatio][lang]} · {num(leg.fuelLitres, 2)} {t('common.litre')}
                </span>
              ) : (
                <span className="row-sub">
                  {num(leg.fuelLitres, 2)} {t('common.litre')} · {num(leg.adjustedKmpl, 1)} {kmPerLitre}
                </span>
              )}
            </span>
            <span className="row-value">
              <Money value={leg.fuelCost} />
              <span className="suffix">{t('common.rs')}</span>
            </span>
          </div>
        ))}

        <div className="row">
          <span className="row-label">{t('result.fuelUsed')}</span>
          <span className="row-value">
            {num(estimate.fuelLitresTotal, 2)}
            <span className="suffix">{t('common.litre')}</span>
          </span>
        </div>

        <div className="row">
          <span className="row-label">{t('result.tolls')}</span>
          <span className="row-value">
            <Money value={estimate.tolls} />
            <span className="suffix">{t('common.rs')}</span>
          </span>
        </div>
      </div>

      <div className="meta">
        <div className="meta-line">
          <span className="meta-key">{fuelLabel}</span>
          <span className="meta-val">
            <Money value={estimate.fuelPrice.pricePerLitre} /> {t('common.perLitre')}
          </span>
        </div>
        <div className="meta-line">
          <span className="meta-key">{t('result.priceDate')}</span>
          <span className="meta-val" dir="ltr">{compactDate(estimate.fuelPrice.effectiveFrom)}</span>
        </div>
        <div className="meta-line">
          <span className="meta-key">{t('result.driverKmpl')}</span>
          <span className="meta-val">
            {num(profile.kmpl, 1)} {kmPerLitre}
            {estimate.kSource === 'driver' ? ` · ${t('result.loadedAverage')}` : ''}
          </span>
        </div>
      </div>

      <p className="honesty">{t('result.honesty')}</p>

      <div className="cta-stack">
        <button type="button" className="btn btn-primary" onClick={share}>
          <ShareIcon />
          {t('result.share')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onEditTrip}>
          {t('result.edit')}
        </button>
        <button type="button" className="text-btn" onClick={onEditProfile}>
          {vehicleName} · {t('vehicle.edit')}
        </button>
      </div>

      <p className="formula-note">
        {t('result.formula')} {estimate.calcVersion}
      </p>
    </section>
  );
}

function buildShareText({ estimate, summary }: ResultBundle, lang: Lang): string {
  const price = estimate.fuelPrice;
  const fuelLabel = fuelTypeLabels[summary.fuelType][lang];
  const trip =
    summary.origin && summary.destination
      ? lang === 'ur'
        ? `${summary.origin.ur} سے ${summary.destination.ur}`
        : `${summary.origin.en} to ${summary.destination.en}`
      : `${num(summary.distanceKm, 1)} ${lang === 'ur' ? 'کلومیٹر' : 'km'}`;
  const lines =
    lang === 'ur'
      ? [
          'ایندھن — سفر کا اندازہ',
          trip,
          `فاصلہ: ${num(summary.distanceKm, 1)} کلومیٹر`,
          `${fuelLabel}: ${num(price.pricePerLitre, 2)} روپے فی لیٹر (${compactDate(price.effectiveFrom)})`,
          ...estimate.legs.map(
            (leg) =>
              `${leg.label === 'return' ? 'واپسی' : 'سفر'}: ${num(leg.fuelLitres, 2)} لیٹر · ${num(leg.fuelCost, 2)} روپے`,
          ),
          `ٹول: ${num(estimate.tolls, 2)} روپے`,
          `کل اندازہ: ${num(estimate.total, 2)} روپے`,
          `فارمولا ${estimate.calcVersion} · یہ صرف اندازہ ہے`,
        ]
      : [
          'Eendhan — trip estimate',
          trip,
          `Distance: ${num(summary.distanceKm, 1)} km`,
          `${fuelLabel}: Rs ${num(price.pricePerLitre, 2)} per litre (${compactDate(price.effectiveFrom)})`,
          ...estimate.legs.map(
            (leg) =>
              `${leg.label === 'return' ? 'Return' : 'Trip'}: ${num(leg.fuelLitres, 2)} L · Rs ${num(leg.fuelCost, 2)}`,
          ),
          `Tolls: Rs ${num(estimate.tolls, 2)}`,
          `Estimated total: Rs ${num(estimate.total, 2)}`,
          `Formula ${estimate.calcVersion} · this is only an estimate`,
        ];
  return lines.join('\n');
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden focusable={false}>
      <path d="M12 16V4m0 0 4.5 4.5M12 4 7.5 8.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" strokeLinecap="round" />
    </svg>
  );
}
