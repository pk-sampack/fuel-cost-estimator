import { useCallback, useEffect, useRef, useState } from 'react';
import type { FuelPriceDto, VehicleTypeDto } from '@fce/contracts';
import { api } from './api';
import { PriceStrip } from './components/PriceStrip';
import { Stepper } from './components/Stepper';
import { translate, type Lang } from './i18n';
import { ResultScreen } from './screens/ResultScreen';
import { RouteScreen } from './screens/RouteScreen';
import { VehicleScreen } from './screens/VehicleScreen';
import { loadLocale, loadProfile, saveLocale, saveProfile, type Profile } from './storage';
import type { ResultBundle, Screen } from './types';

type BootState = 'loading' | 'ready' | 'error';

export default function App() {
  const [lang, setLang] = useState<Lang>(() => loadLocale() ?? 'ur');
  const [boot, setBoot] = useState<BootState>('loading');
  const [vehicleTypes, setVehicleTypes] = useState<VehicleTypeDto[]>([]);
  const [prices, setPrices] = useState<FuelPriceDto[]>([]);
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile());
  const [screen, setScreen] = useState<Screen>(() => (loadProfile() ? 'route' : 'vehicle'));
  const [vehicleReturn, setVehicleReturn] = useState<Screen>('route');
  const [bundle, setBundle] = useState<ResultBundle | null>(null);
  const [priceRefreshing, setPriceRefreshing] = useState(false);
  const [priceNotice, setPriceNotice] = useState<'ok' | 'fresh' | 'failed' | null>(null);
  const autoRefreshed = useRef(false);
  const mainRef = useRef<HTMLElement>(null);
  const initialScreen = useRef(true);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  );

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
    saveLocale(lang);
  }, [lang]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    if (initialScreen.current) {
      initialScreen.current = false;
      return;
    }
    const heading = Array.from(mainRef.current?.querySelectorAll<HTMLElement>('h1') ?? []).find(
      (element) => element.offsetParent !== null,
    );
    heading?.focus({ preventScroll: true });
  }, [screen]);

  const load = useCallback(async () => {
    setBoot('loading');
    try {
      const [types, priceData] = await Promise.all([api.vehicleTypes(), api.currentPrices()]);
      setVehicleTypes(types);
      setPrices(priceData.prices);
      setBoot('ready');
    } catch {
      setBoot('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshPrices = useCallback(async (manual: boolean) => {
    setPriceRefreshing(true);
    if (manual) setPriceNotice(null);
    try {
      const data = await api.refreshPrices();
      setPrices(data.prices);
      if (manual) {
        setPriceNotice(data.refreshed ? 'ok' : 'fresh');
        window.setTimeout(() => setPriceNotice(null), 6000);
      }
    } catch {
      if (manual) setPriceNotice('failed');
    } finally {
      setPriceRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (boot !== 'ready' || autoRefreshed.current) return;
    autoRefreshed.current = true;
    void refreshPrices(false);
  }, [boot, refreshPrices]);

  function handleSaveProfile(next: Profile) {
    saveProfile(next);
    setProfile(next);
    setScreen('route');
  }

  function openVehicle(from: Screen) {
    setVehicleReturn(from);
    setScreen('vehicle');
  }

  function closeVehicle() {
    setScreen(vehicleReturn);
  }

  function handleDone(estimate: ResultBundle['estimate'], summary: ResultBundle['summary']) {
    setBundle({ estimate, summary });
    setScreen('result');
  }

  const step = screen === 'vehicle' ? 1 : screen === 'route' ? 2 : 3;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className={`wordmark ${lang === 'en' ? 'wordmark-en' : ''}`}>{t('app.name')}</span>
          <span className="tagline">{t('app.tagline')}</span>
        </div>
        <button type="button" className="lang-btn" onClick={() => setLang(lang === 'ur' ? 'en' : 'ur')}>
          {t('common.switchLang')}
        </button>
      </header>

      <Stepper
        step={step}
        labels={[t('nav.vehicle'), t('nav.route'), t('nav.result')]}
        ariaLabel={t('nav.progress')}
      />

      {boot === 'ready' && screen !== 'result' && prices.length > 0 ? (
        <PriceStrip
          prices={prices}
          lang={lang}
          refreshing={priceRefreshing}
          notice={priceNotice}
          onRefresh={() => void refreshPrices(true)}
        />
      ) : null}

      <main ref={mainRef}>
        {boot === 'loading' ? (
          <div className="skeleton" aria-busy="true" aria-label={t('common.loading')}>
            <div className="skeleton-line skeleton-title" />
            <div className="skeleton-line" />
            <div className="skeleton-grid">
              <div className="skeleton-block" />
              <div className="skeleton-block" />
              <div className="skeleton-block" />
              <div className="skeleton-block" />
            </div>
          </div>
        ) : null}

        {boot === 'error' ? (
          <div className="error-panel">
            <p>{t('error.network')}</p>
            <button type="button" className="btn btn-primary" onClick={() => void load()}>
              {t('error.retry')}
            </button>
          </div>
        ) : null}

        {boot === 'ready' ? (
          <>
            <div hidden={screen !== 'vehicle'}>
              <VehicleScreen
                vehicleTypes={vehicleTypes}
                profile={profile}
                lang={lang}
                onSave={handleSaveProfile}
                onBack={profile ? closeVehicle : undefined}
              />
            </div>

            {profile ? (
              <div hidden={screen !== 'route'}>
                <RouteScreen
                  vehicleTypes={vehicleTypes}
                  prices={prices}
                  profile={profile}
                  lang={lang}
                  onEditProfile={() => openVehicle('route')}
                  onDone={handleDone}
                />
              </div>
            ) : null}

            {screen === 'result' && bundle && profile ? (
              <ResultScreen
                bundle={bundle}
                profile={profile}
                lang={lang}
                onEditTrip={() => setScreen('route')}
                onEditProfile={() => openVehicle('result')}
              />
            ) : null}
          </>
        ) : null}
      </main>

      <footer className="app-footer">{t('app.footer')}</footer>
    </div>
  );
}
