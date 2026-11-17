import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { PlaceDto } from '@fce/contracts';
import { api } from '../api';
import { translate, type Lang } from '../i18n';

interface Props {
  label: string;
  placeholder: string;
  value: PlaceDto | null;
  onChange: (place: PlaceDto) => void;
  onOpenChange?: (open: boolean) => void;
  lang: Lang;
}

export function PlacePicker({ label, placeholder, value, onChange, onOpenChange, lang }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<PlaceDto[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pickerId = useId();

  function close(refocus = false) {
    setOpen(false);
    setQuery('');
    onOpenChange?.(false);
    if (refocus) requestAnimationFrame(() => toggleRef.current?.focus());
  }

  function select(place: PlaceDto) {
    onChange(place);
    close(true);
  }

  function onPickerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    }
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .places(query)
        .then((results) => {
          if (!cancelled) setPlaces(results);
        })
        .catch(() => {
          if (!cancelled) setPlaces([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <button
        type="button"
        ref={toggleRef}
        className={`place-button ${value ? 'is-set' : ''}`}
        onClick={() => {
          if (open) {
            close();
          } else {
            setOpen(true);
            onOpenChange?.(true);
          }
        }}
        aria-expanded={open}
        aria-controls={open ? pickerId : undefined}
      >
        <PinIcon />
        <span className="place-text">
          {value ? (lang === 'ur' && value.nameUr ? value.nameUr : value.name) : placeholder}
          {value ? <span className="place-sub">{value.address}</span> : null}
        </span>
      </button>

      {open ? (
        <div className="picker" id={pickerId} onKeyDown={onPickerKeyDown}>
          <input
            ref={inputRef}
            className="input picker-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={translate(lang, 'route.searchPlace')}
            inputMode="search"
            autoComplete="off"
            aria-label={translate(lang, 'route.searchPlace')}
          />
          <ul className="picker-list" aria-busy={loading}>
            {places.map((place) => (
              <li key={place.id}>
                <button type="button" className="picker-row" onClick={() => select(place)}>
                  <span className="picker-name">
                    {lang === 'ur' && place.nameUr ? place.nameUr : place.name}
                  </span>
                  <span className="picker-address">{place.address}</span>
                </button>
              </li>
            ))}
            {!loading && places.length === 0 ? (
              <li className="picker-empty" role="status">
                {translate(lang, 'route.noPlaces')}
              </li>
            ) : null}
            {loading ? (
              <li className="picker-empty" role="status">
                {translate(lang, 'common.loading')}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden focusable={false}>
      <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}
