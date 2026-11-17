import { useRef, useState, type KeyboardEvent } from 'react';
import FuelPrices from '../components/FuelPrices';
import VehicleTypes from '../components/VehicleTypes';
import type { AdminMe, AdminSession } from '../api';
import { displayDate, todayIso } from '../format';

type Tab = 'prices' | 'vehicles';

const TAB_ORDER: Tab[] = ['prices', 'vehicles'];

export default function Dashboard({
  session,
  me,
  onSignOut,
}: {
  session: AdminSession;
  me: AdminMe;
  onSignOut: (message: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('prices');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function onTabsKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = TAB_ORDER.indexOf(tab);
    let next = current;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TAB_ORDER.length - 1;
    else if (event.key === 'ArrowRight') next = (current + 1) % TAB_ORDER.length;
    else next = (current - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    const nextTab = TAB_ORDER[next];
    if (!nextTab) return;
    setTab(nextTab);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="wordmark" lang="ur" dir="rtl">
              ایندھن
            </span>
            <span className="brand-tag">Admin</span>
          </div>
          <div className="topbar-meta">
            <span className="who" title={me.email}>
              {me.email}
            </span>
            <span className={`mfa ${me.mfaEnabled ? 'mfa-on' : 'mfa-off'}`}>
              <span className="state-dot" aria-hidden="true" />
              {me.mfaEnabled ? '2FA on' : '2FA off'}
            </span>
            <button type="button" className="text-btn" onClick={() => onSignOut('Signed out.')}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="container">
        <div className="page-head">
          <div>
            <p className="eyebrow">Operations · {displayDate(todayIso())}</p>
            <h1 className="page-title">Reference data</h1>
            <p className="page-sub">
              Update what the driver app calculates with. Changes are audited under your account.
            </p>
          </div>
        </div>

        <div className="tabs" role="tablist" aria-label="Admin sections" onKeyDown={onTabsKeyDown}>
          <button
            type="button"
            ref={(element) => {
              tabRefs.current[0] = element;
            }}
            role="tab"
            id="tab-prices"
            aria-selected={tab === 'prices'}
            aria-controls="panel-prices"
            tabIndex={tab === 'prices' ? 0 : -1}
            className={`tab ${tab === 'prices' ? 'is-active' : ''}`}
            onClick={() => setTab('prices')}
          >
            Fuel prices
          </button>
          <button
            type="button"
            ref={(element) => {
              tabRefs.current[1] = element;
            }}
            role="tab"
            id="tab-vehicles"
            aria-selected={tab === 'vehicles'}
            aria-controls="panel-vehicles"
            tabIndex={tab === 'vehicles' ? 0 : -1}
            className={`tab ${tab === 'vehicles' ? 'is-active' : ''}`}
            onClick={() => setTab('vehicles')}
          >
            Vehicle types
          </button>
        </div>

        <div
          id="panel-prices"
          role="tabpanel"
          aria-labelledby="tab-prices"
          hidden={tab !== 'prices'}
        >
          <FuelPrices session={session} onSignOut={onSignOut} />
        </div>
        <div
          id="panel-vehicles"
          role="tabpanel"
          aria-labelledby="tab-vehicles"
          hidden={tab !== 'vehicles'}
        >
          <VehicleTypes session={session} onSignOut={onSignOut} />
        </div>

        <footer className="admin-foot">
          <p>
            Approved prices reach drivers immediately. Every estimate records the price, date and
            formula version used.
          </p>
          <p className="foot-meta">Sessions expire after 8 hours · changes are audit-logged</p>
        </footer>
      </main>
    </div>
  );
}
