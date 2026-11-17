import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { VehicleTypeDto } from '@fce/contracts';
import { VehicleGlyph } from '../components/Glyphs';
import { translate, type Lang } from '../i18n';
import { clamp, normalizeDigits, parseDecimal, roundToHalf } from '../numbers';
import type { Profile } from '../storage';

interface Props {
  vehicleTypes: VehicleTypeDto[];
  profile: Profile | null;
  lang: Lang;
  onSave: (profile: Profile) => void;
  onBack?: () => void;
}

export function VehicleScreen({ vehicleTypes, profile, lang, onSave, onBack }: Props) {
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const [code, setCode] = useState(profile?.vehicleTypeCode ?? '');
  const [kmpl, setKmpl] = useState(profile ? String(profile.kmpl) : '');
  const [fullOpen, setFullOpen] = useState(Boolean(profile?.kmplFull));
  const [kmplFull, setKmplFull] = useState(profile?.kmplFull ? String(profile.kmplFull) : '');
  const [listOpen, setListOpen] = useState(
    () => !profile || !vehicleTypes.some((type) => type.code === profile.vehicleTypeCode),
  );
  const tilesRef = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const fullInputRef = useRef<HTMLInputElement>(null);
  const scrollToFull = useRef(false);
  const pendingFocus = useRef<'summary' | 'list' | null>(null);
  const listId = useId();

  const groups = useMemo(() => {
    const passenger = vehicleTypes.filter((type) => type.class !== 'goods');
    const goods = vehicleTypes.filter((type) => type.class === 'goods');
    return { passenger, goods, ordered: [...passenger, ...goods] };
  }, [vehicleTypes]);
  const indexByCode = useMemo(
    () => new Map(groups.ordered.map((type, index) => [type.code, index])),
    [groups.ordered],
  );

  const selected = useMemo(() => vehicleTypes.find((type) => type.code === code) ?? null, [vehicleTypes, code]);
  const isGoods = selected?.class === 'goods';
  const kmplValue = parseDecimal(kmpl);
  const fullValue = parseDecimal(kmplFull);
  const activeIndex = groups.ordered.findIndex((type) => type.code === code);

  useEffect(() => {
    if (!pendingFocus.current) return;
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target === 'summary') {
      selectedRef.current?.focus();
      return;
    }
    const index = activeIndex === -1 ? 0 : activeIndex;
    tilesRef.current[index]?.focus();
  }, [listOpen, code, activeIndex]);

  useEffect(() => {
    if (!fullOpen || !scrollToFull.current) return;
    scrollToFull.current = false;
    const frame = requestAnimationFrame(() => {
      fullInputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [fullOpen]);

  function toggleFull() {
    const next = !fullOpen;
    if (next) scrollToFull.current = true;
    setFullOpen(next);
  }

  const kmplValid = kmplValue !== null && kmplValue > 0 && kmplValue <= 100;
  const fullTooHigh = isGoods && fullOpen && fullValue !== null && kmplValue !== null && fullValue > kmplValue;
  const fullInvalid = isGoods && fullOpen && fullValue !== null && fullValue <= 0;
  const fullValid =
    !isGoods ||
    !fullOpen ||
    fullValue === null ||
    (fullValue > 0 && fullValue <= (kmplValue ?? 0));
  const canSave = Boolean(selected) && kmplValid && fullValid;
  const outsideRange = Boolean(
    selected && kmplValid && kmplValue !== null && (kmplValue < selected.kmplMin || kmplValue > selected.kmplMax),
  );
  const showKmplError = Boolean(selected) && !kmplValid;
  const showFullError = fullTooHigh || fullInvalid;
  const saveHint = !selected
    ? t('vehicle.chooseVehicle')
    : !kmplValid
      ? t('vehicle.kmplInvalid')
      : !fullValid
        ? fullTooHigh
          ? t('vehicle.fullTooHigh')
          : t('vehicle.kmplInvalid')
        : null;

  function applyType(type: VehicleTypeDto) {
    const classChanged = Boolean(selected) && (selected?.class === 'goods') !== (type.class === 'goods');
    setCode(type.code);
    if (!kmpl.trim() || classChanged) {
      const guess = clamp(roundToHalf((type.kmplMin + type.kmplMax) / 2), 1, 100);
      setKmpl(String(guess));
    }
    if (classChanged) {
      setFullOpen(false);
      setKmplFull('');
    }
  }

  function pick(type: VehicleTypeDto) {
    applyType(type);
    pendingFocus.current = 'summary';
    setListOpen(false);
  }

  function openList() {
    pendingFocus.current = 'list';
    setListOpen(true);
  }

  function step(delta: number) {
    const base = parseDecimal(kmpl) ?? 10;
    const next = clamp(Math.round((base + delta) * 2) / 2, 0.5, 100);
    setKmpl(String(next));
  }

  function closeList() {
    if (!selected) return;
    pendingFocus.current = 'summary';
    setListOpen(false);
  }

  function onPickerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    closeList();
  }

  function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (groups.ordered.length === 0) return;
    const handled = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!handled.includes(event.key)) return;

    const currentIndex = activeIndex;
    let nextIndex = currentIndex === -1 ? 0 : currentIndex;
    if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = groups.ordered.length - 1;
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (nextIndex + 1) % groups.ordered.length;
    } else {
      nextIndex = (nextIndex - 1 + groups.ordered.length) % groups.ordered.length;
    }

    const nextType = groups.ordered[nextIndex];
    if (!nextType) return;
    event.preventDefault();
    applyType(nextType);
    tilesRef.current[nextIndex]?.focus();
  }

  const canDecrease = kmplValue === null || kmplValue > 0.5;
  const canIncrease = kmplValue === null || kmplValue < 100;

  function submit() {
    if (!selected || !canSave || kmplValue === null) return;
    setListOpen(false);
    onSave({
      vehicleTypeCode: selected.code,
      kmpl: kmplValue,
      kmplFull: isGoods && fullOpen && fullValue !== null ? fullValue : null,
    });
  }

  function renderTile(type: VehicleTypeDto) {
    const active = type.code === code;
    const index = indexByCode.get(type.code) ?? 0;
    return (
      <button
        key={type.code}
        ref={(element) => {
          tilesRef.current[index] = element;
        }}
        type="button"
        role="radio"
        aria-checked={active}
        tabIndex={active || (activeIndex === -1 && index === 0) ? 0 : -1}
        className={`vtile ${active ? 'is-selected' : ''}`}
        onClick={() => pick(type)}
      >
        <span className="vtile-glyph">
          <VehicleGlyph kind={type.pictureKey} />
        </span>
        <span className="vtile-name">{lang === 'ur' ? type.nameUr : type.nameEn}</span>
        <span className="vtile-meta">
          {type.seats !== null ? `${type.seats} ${t('vehicle.seats')} · ` : ''}
          {type.payloadTons !== null ? `${formatTons(type.payloadTons)} ${t('vehicle.tons')} · ` : ''}
          <span dir="ltr">
            {type.kmplMin}–{type.kmplMax}
          </span>
        </span>
        {active ? (
          <span className="vtile-check" aria-hidden>
            <CheckIcon />
          </span>
        ) : null}
      </button>
    );
  }

  function renderGroup(title: string, types: VehicleTypeDto[]) {
    if (types.length === 0) return null;
    return (
      <div className="vehicle-group">
        <div className="vehicle-group-head">
          <h2 className="vehicle-group-title">{title}</h2>
          <span className="vehicle-group-count">{types.length}</span>
        </div>
        <div className="vehicle-grid">{types.map(renderTile)}</div>
      </div>
    );
  }

  return (
    <section className="screen">
      {onBack ? (
        <button type="button" className="back-link" onClick={onBack}>
          <BackIcon />
          {t('common.back')}
        </button>
      ) : null}
      <h1 className="screen-title" tabIndex={-1}>
        {t('vehicle.title')}
      </h1>
      <p className="screen-sub">{t('vehicle.sub')}</p>

      {selected && !listOpen ? (
        <button
          type="button"
          ref={selectedRef}
          className="vehicle-selected"
          onClick={openList}
          aria-expanded={false}
          aria-controls={listId}
        >
          <span className="selected-glyph">
            <VehicleGlyph kind={selected.pictureKey} />
          </span>
          <span className="selected-info">
            <span className="selected-eyebrow">
              {isGoods ? t('vehicle.goods') : t('vehicle.passenger')}
            </span>
            <span className="selected-name">{lang === 'ur' ? selected.nameUr : selected.nameEn}</span>
            <span className="selected-meta">
              {selected.seats !== null ? `${selected.seats} ${t('vehicle.seats')} · ` : ''}
              {selected.payloadTons !== null ? `${formatTons(selected.payloadTons)} ${t('vehicle.tons')} · ` : ''}
              <span dir="ltr">
                {selected.kmplMin}–{selected.kmplMax}
              </span>
            </span>
          </span>
          <span className="selected-change">{t('vehicle.edit')}</span>
        </button>
      ) : null}

      <div
        className="vehicle-picker"
        id={listId}
        hidden={!listOpen}
        onKeyDown={onPickerKeyDown}
      >
        <div className="vehicle-picker-head">
          <span className="vehicle-picker-title">{t('vehicle.allVehicles')}</span>
          {selected ? (
            <button type="button" className="link vehicle-picker-close" onClick={closeList}>
              {t('vehicle.hideList')}
            </button>
          ) : null}
        </div>
        <div
          className="vehicle-picker-groups"
          role="radiogroup"
          aria-label={t('vehicle.title')}
          onKeyDown={onListKeyDown}
        >
          {renderGroup(t('vehicle.passengerGroup'), groups.passenger)}
          {renderGroup(t('vehicle.goodsGroup'), groups.goods)}
        </div>
      </div>

      {selected ? (
        <div className="field">
          <label className="field-label" htmlFor="kmpl">
            {t('vehicle.kmpl')}
          </label>
          <div className="stepper-input">
            <button
              type="button"
              className="step-btn"
              onClick={() => step(-0.5)}
              aria-label={t('vehicle.decrease')}
              disabled={!canDecrease}
            >
              −
            </button>
            <input
              id="kmpl"
              className="input num-input"
              inputMode="decimal"
              autoComplete="off"
              value={kmpl}
              onChange={(event) => setKmpl(normalizeDigits(event.target.value))}
              placeholder="12"
              aria-invalid={showKmplError || undefined}
              aria-describedby={selected || showKmplError ? 'kmpl-hint' : undefined}
            />
            <button
              type="button"
              className="step-btn"
              onClick={() => step(0.5)}
              aria-label={t('vehicle.increase')}
              disabled={!canIncrease}
            >
              +
            </button>
          </div>
          {showKmplError ? (
            <p className="hint hint-warn" id="kmpl-hint" role="status">
              {t('vehicle.kmplInvalid')}
            </p>
          ) : selected ? (
            <p className="hint" id="kmpl-hint">
              {t('vehicle.kmplHint', { min: selected.kmplMin, max: selected.kmplMax })}
            </p>
          ) : null}
          {outsideRange && !showKmplError ? (
            <p className="hint hint-warn" role="status">
              {t('vehicle.outsideRange')}
            </p>
          ) : null}
        </div>
      ) : null}

      {isGoods ? (
        <div className="field">
          <button
            type="button"
            className={`toggle-row ${fullOpen ? 'is-open' : ''}`}
            onClick={toggleFull}
            aria-expanded={fullOpen}
          >
            <span>{t('vehicle.askFull')}</span>
            <span className="toggle-mark" aria-hidden>
              {fullOpen ? '−' : '+'}
            </span>
          </button>
          {fullOpen ? (
            <>
              <label className="field-label field-label-spaced" htmlFor="kmplFull">
                {t('vehicle.kmplFull')} <span className="muted">({t('common.optional')})</span>
              </label>
              <input
                id="kmplFull"
                ref={fullInputRef}
                className="input num-input"
                inputMode="decimal"
                autoComplete="off"
                value={kmplFull}
                onChange={(event) => setKmplFull(normalizeDigits(event.target.value))}
                placeholder="9"
                aria-invalid={showFullError || undefined}
                aria-describedby="kmpl-full-hint"
              />
              {showFullError ? (
                <p className="hint hint-warn" id="kmpl-full-hint" role="status">
                  {fullTooHigh ? t('vehicle.fullTooHigh') : t('vehicle.kmplInvalid')}
                </p>
              ) : (
                <p className="hint" id="kmpl-full-hint">
                  {t('vehicle.kmplFullHint')}
                </p>
              )}
            </>
          ) : null}
        </div>
      ) : null}

      <div className="cta-bar">
        <button type="button" className="btn btn-primary" disabled={!canSave} onClick={submit}>
          {t('vehicle.save')}
        </button>
        {!canSave && saveHint ? <p className="cta-hint">{saveHint}</p> : null}
      </div>
    </section>
  );
}

function formatTons(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/, '').replace(/\.$/, '');
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden focusable={false}>
      <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden focusable={false}>
      <path d="M19 12H5m0 0 6-6m-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
