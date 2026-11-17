import { fuelTypeLabels, type FuelPriceDto } from '@fce/contracts';
import { compactDate } from './Money';
import { translate, type Lang } from '../i18n';

interface Props {
  prices: FuelPriceDto[];
  lang: Lang;
  refreshing: boolean;
  notice: 'ok' | 'fresh' | 'failed' | null;
  onRefresh: () => void;
}

export function PriceStrip({ prices, lang, refreshing, notice, onRefresh }: Props) {
  const t = (key: string) => translate(lang, key);
  const latest = prices.reduce<string | null>(
    (acc, price) => (!acc || price.checkedAt > acc ? price.checkedAt : acc),
    null,
  );
  const note =
    notice === 'failed'
      ? t('price.failed')
      : notice === 'ok'
        ? t('price.updated')
        : notice === 'fresh'
          ? t('price.fresh')
          : latest
            ? `${t('price.checked')} ${compactDate(pakistanDate(latest))}`
            : '';

  return (
    <section className="price-strip" aria-label={t('price.title')}>
      <div className="price-strip-top">
        <span className="price-strip-title">{t('price.title')}</span>
        <button type="button" className="price-refresh" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? t('price.updating') : t('price.update')}
        </button>
      </div>
      <div className="price-chips">
        {prices.map((price) => (
          <span key={price.fuelType} className={`price-chip ${price.stale ? 'is-stale' : ''}`}>
            <span className="price-chip-fuel">{fuelTypeLabels[price.fuelType][lang]}</span>
            <span className="price-chip-value" dir="ltr">
              {price.pricePerLitre.toLocaleString('en-PK', {
                minimumFractionDigits: Number.isInteger(price.pricePerLitre) ? 0 : 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </span>
        ))}
      </div>
      {note ? (
        <p className={`price-note ${notice === 'failed' ? 'is-warn' : ''}`} role="status">
          {note}
        </p>
      ) : null}
    </section>
  );
}

function pakistanDate(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso.slice(0, 10);
  return new Date(parsed + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
