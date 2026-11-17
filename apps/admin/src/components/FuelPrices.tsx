import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { FuelType } from '@fce/contracts';
import {
  api,
  ApiError,
  type AdminSession,
  type FuelPrice,
  type FuelPriceInput,
} from '../api';
import { displayDate, money, parseMoney, timestamp, todayIso } from '../format';
import { Notice, Spinner, StatusBadge } from './ui';

const FUELS: { value: FuelType; label: string; ur: string }[] = [
  { value: 'petrol', label: 'Petrol', ur: 'پٹرول' },
  { value: 'diesel', label: 'Diesel', ur: 'ڈیزل' },
  { value: 'cng', label: 'CNG', ur: 'سی این جی' },
  { value: 'lpg', label: 'LPG', ur: 'ایل پی جی' },
];

const FUEL_LABEL = Object.fromEntries(FUELS.map((fuel) => [fuel.value, fuel.label])) as Record<
  FuelType,
  string
>;

interface Flash {
  kind: 'success' | 'error' | 'info';
  text: string;
}

export default function FuelPrices({
  session,
  onSignOut,
}: {
  session: AdminSession;
  onSignOut: (message: string) => void;
}) {
  const [items, setItems] = useState<FuelPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);

  const [fuelType, setFuelType] = useState<FuelType>('petrol');
  const [price, setPrice] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [source, setSource] = useState('OGRA');
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [approveId, setApproveId] = useState<number | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  const handleAuth = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && (error.status === 401 || error.code === 'mfa_required')) {
        onSignOut('Session expired. Sign in again.');
        return true;
      }
      return false;
    },
    [onSignOut],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setItems(await api.listPrices(session.token));
    } catch (error) {
      if (!handleAuth(error)) {
        setLoadError(error instanceof Error ? error.message : 'Could not load fuel prices.');
      }
    } finally {
      setLoading(false);
    }
  }, [handleAuth, session.token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 7000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const ordered = useMemo(
    () =>
      [...items].sort((a, b) =>
        a.effectiveFrom === b.effectiveFrom
          ? b.id - a.id
          : a.effectiveFrom < b.effectiveFrom
            ? 1
            : -1,
      ),
    [items],
  );
  const drafts = ordered.filter((item) => item.status === 'draft');
  const approved = ordered.filter((item) => item.status === 'approved');

  const live = useMemo(() => {
    const today = todayIso();
    return FUELS.map((fuel) => {
      const candidates = approved.filter(
        (item) => item.fuelType === fuel.value && item.effectiveFrom <= today,
      );
      return candidates[0] ?? null;
    });
  }, [approved]);

  async function syncPrices() {
    if (syncing) return;
    setSyncing(true);
    setFlash(null);
    try {
      const result = await api.syncPrices(session.token);
      const changed = result.results.filter(
        (item) => item.action === 'inserted' || item.action === 'updated',
      );
      const skipped = result.results.filter((item) => item.action === 'skipped');
      await load();

      if (changed.length > 0) {
        const detail = changed
          .map(
            (item) =>
              `${FUEL_LABEL[item.fuelType]} Rs ${money(item.pricePerLitre)} ${item.action}`,
          )
          .join(', ');
        setFlash({
          kind: 'success',
          text: `OGRA feed synced: ${detail}.${skipped.length ? ` ${skipped.length} skipped.` : ''}`,
        });
      } else if (skipped.length > 0) {
        setFlash({
          kind: 'info',
          text: `OGRA feed checked. Nothing imported: ${skipped
            .map((item) => `${FUEL_LABEL[item.fuelType]} (${item.reason ?? 'skipped'})`)
            .join(', ')}.`,
        });
      } else {
        setFlash({ kind: 'info', text: 'OGRA feed checked. Prices are already up to date.' });
      }
    } catch (error) {
      if (!handleAuth(error)) {
        setFlash({
          kind: 'error',
          text: error instanceof Error ? error.message : 'Could not sync the OGRA feed.',
        });
      }
    } finally {
      setSyncing(false);
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (creating) return;
    setFormError(null);

    const value = parseMoney(price);
    if (value === null || value <= 0) {
      setFormError('Enter a price greater than zero.');
      return;
    }
    if (value > 1000) {
      setFormError('That price looks wrong. Enter a value below Rs 1,000.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
      setFormError('Choose the date this price takes effect.');
      return;
    }
    if (source.trim().length < 2) {
      setFormError('Add a source, for example "OGRA".');
      return;
    }

    const input: FuelPriceInput = {
      fuelType,
      pricePerLitre: value,
      effectiveFrom,
      source: source.trim(),
    };

    setCreating(true);
    try {
      const created = await api.createPrice(session.token, input);
      setItems((current) => [created, ...current]);
      setPrice('');
      setFlash({
        kind: 'success',
        text: `${FUEL_LABEL[created.fuelType]} draft saved for ${displayDate(created.effectiveFrom)}. Approve it to make it live.`,
      });
    } catch (error) {
      if (!handleAuth(error)) {
        setFormError(error instanceof Error ? error.message : 'Could not save the price.');
      }
    } finally {
      setCreating(false);
    }
  }

  function startEdit(item: FuelPrice) {
    setApproveId(null);
    setDeleteId(null);
    setEditingId(item.id);
    setEditPrice(String(item.pricePerLitre));
    setEditDate(item.effectiveFrom);
    setEditSource(item.source);
    setEditError(null);
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (editingId === null || savingEdit) return;
    setEditError(null);

    const value = parseMoney(editPrice);
    if (value === null || value <= 0 || value > 1000) {
      setEditError('Enter a price between Rs 0.01 and Rs 1,000.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editDate)) {
      setEditError('Choose a valid effective date.');
      return;
    }
    if (editSource.trim().length < 2) {
      setEditError('Add a source.');
      return;
    }

    setSavingEdit(true);
    try {
      const updated = await api.patchPrice(session.token, editingId, {
        pricePerLitre: value,
        effectiveFrom: editDate,
        source: editSource.trim(),
      });
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setEditingId(null);
      setFlash({ kind: 'success', text: 'Draft updated.' });
    } catch (error) {
      if (!handleAuth(error)) {
        setEditError(error instanceof Error ? error.message : 'Could not update the draft.');
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function approve(item: FuelPrice) {
    setApprovingId(item.id);
    try {
      const updated = await api.approvePrice(session.token, item.id);
      setItems((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      setApproveId(null);
      setFlash({
        kind: 'success',
        text: `${FUEL_LABEL[updated.fuelType]} is live for drivers at Rs ${money(updated.pricePerLitre)} per litre.`,
      });
    } catch (error) {
      if (!handleAuth(error)) {
        setFlash({
          kind: 'error',
          text: error instanceof Error ? error.message : 'Could not approve the price.',
        });
        void load();
      }
    } finally {
      setApprovingId(null);
    }
  }

  async function remove(item: FuelPrice) {
    setDeletingId(item.id);
    try {
      await api.deletePrice(session.token, item.id);
      setItems((current) => current.filter((row) => row.id !== item.id));
      if (editingId === item.id) setEditingId(null);
      setDeleteId(null);
      setFlash({
        kind: 'info',
        text: `${FUEL_LABEL[item.fuelType]} draft for ${displayDate(item.effectiveFrom)} deleted.`,
      });
    } catch (error) {
      if (!handleAuth(error)) {
        setFlash({
          kind: 'error',
          text: error instanceof Error ? error.message : 'Could not delete the draft.',
        });
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section aria-labelledby="prices-title">
      <div className="section-head">
        <div>
          <h2 id="prices-title" className="section-title">
            Fuel prices
          </h2>
          <p className="section-sub">
            Petrol and diesel go live automatically at 12:00 am from the OGRA feed. CNG and LPG
            stay manual. Future-dated prices stay hidden until that date.
          </p>
        </div>
        <div className="section-actions">
          <button
            type="button"
            className="text-btn"
            onClick={() => void syncPrices()}
            disabled={syncing || loading}
          >
            {syncing ? 'Syncing…' : 'Sync OGRA feed'}
          </button>
          <button type="button" className="text-btn" onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      <div className="live-strip">
        <span className="live-strip-label">Live now</span>
        <div className="live-chips">
          {live.map((item, index) => (
            <div className={`live-chip ${item ? '' : 'is-empty'}`} key={FUELS[index]!.value}>
              <span className="live-fuel">{FUELS[index]!.label}</span>
              {item ? (
                <>
                  <span className="live-price">Rs {money(item.pricePerLitre)}</span>
                  <span className="live-date">from {displayDate(item.effectiveFrom)}</span>
                </>
              ) : (
                <span className="live-none">No approved price</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {flash && <Notice kind={flash.kind}>{flash.text}</Notice>}

      <div className="prices-grid">
        <form className="card" onSubmit={create} noValidate>
          <h3 className="card-title">Add a price</h3>
          <p className="card-sub">Saved as a draft. Not visible to drivers until approved.</p>

          {formError && <Notice kind="error">{formError}</Notice>}

          <div className="field">
            <label className="field-label" htmlFor="fuel">
              Fuel
            </label>
            <select
              id="fuel"
              className="input"
              value={fuelType}
              onChange={(event) => setFuelType(event.target.value as FuelType)}
            >
              {FUELS.map((fuel) => (
                <option key={fuel.value} value={fuel.value}>
                  {fuel.label} — {fuel.ur}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="price">
              Price per litre
            </label>
            <div className="input-wrap">
              <span className="input-prefix">Rs</span>
              <input
                id="price"
                className="input input-money"
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="Enter amount"
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="effective">
              Effective from
            </label>
            <input
              id="effective"
              className="input"
              type="date"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="source">
              Source
            </label>
            <input
              id="source"
              className="input"
              type="text"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="OGRA notification"
              maxLength={200}
            />
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={creating}>
            {creating ? 'Saving draft…' : 'Save as draft'}
          </button>
        </form>

        <div className="price-lists">
          {loading ? (
            <Spinner label="Loading prices…" />
          ) : loadError ? (
            <div className="card card-plain">
              <Notice kind="error">{loadError}</Notice>
              <button type="button" className="btn btn-secondary" onClick={() => void load()}>
                Try again
              </button>
            </div>
          ) : (
            <>
              <div className="list-head">
                <h3 className="list-title">
                  Drafts <span className="count">{drafts.length}</span>
                </h3>
              </div>

              {drafts.length === 0 ? (
                <p className="empty">No drafts waiting. Add a new price to get started.</p>
              ) : (
                <div className="table-wrap">
                  <table className="price-table">
                    <thead>
                      <tr>
                        <th scope="col">Fuel</th>
                        <th scope="col">Price (Rs/l)</th>
                        <th scope="col">Effective</th>
                        <th scope="col">Source</th>
                        <th scope="col">Status</th>
                        <th scope="col">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {drafts.map((item) => (
                        <FragmentRow
                          key={item.id}
                          item={item}
                          editing={editingId === item.id}
                          editPrice={editPrice}
                          editDate={editDate}
                          editSource={editSource}
                          editError={editError}
                          saving={savingEdit}
                          busy={approvingId === item.id || deletingId === item.id}
                          confirmAction={
                            approveId === item.id
                              ? 'approve'
                              : deleteId === item.id
                                ? 'delete'
                                : null
                          }
                          onPrice={setEditPrice}
                          onDate={setEditDate}
                          onSource={setEditSource}
                          onEdit={() => startEdit(item)}
                          onCancelEdit={() => setEditingId(null)}
                          onSave={saveEdit}
                          onAskApprove={() => {
                            setEditingId(null);
                            setDeleteId(null);
                            setApproveId(item.id);
                          }}
                          onAskDelete={() => {
                            setEditingId(null);
                            setApproveId(null);
                            setDeleteId(item.id);
                          }}
                          onCancelConfirm={() => {
                            setApproveId(null);
                            setDeleteId(null);
                          }}
                          onConfirm={() =>
                            approveId === item.id ? void approve(item) : void remove(item)
                          }
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="list-head list-head-spaced">
                <h3 className="list-title">
                  Approved <span className="count">{approved.length}</span>
                </h3>
              </div>

              {approved.length === 0 ? (
                <p className="empty">Approved prices will appear here.</p>
              ) : (
                <div className="table-wrap">
                  <table className="price-table">
                    <thead>
                      <tr>
                        <th scope="col">Fuel</th>
                        <th scope="col">Price (Rs/l)</th>
                        <th scope="col">Effective</th>
                        <th scope="col">Source</th>
                        <th scope="col">Approved</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approved.map((item) => (
                        <tr key={item.id}>
                          <td data-label="Fuel">
                            <span className="fuel-name">{FUEL_LABEL[item.fuelType]}</span>
                          </td>
                          <td data-label="Price (Rs/l)" className="num">
                            {money(item.pricePerLitre)}
                          </td>
                          <td data-label="Effective from">{displayDate(item.effectiveFrom)}</td>
                          <td data-label="Source" className="cell-muted">
                            {item.source}
                          </td>
                          <td data-label="Approved" className="cell-muted cell-small">
                            {item.approvedBy ?? '—'}
                            <br />
                            {timestamp(item.approvedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function FragmentRow({
  item,
  editing,
  editPrice,
  editDate,
  editSource,
  editError,
  saving,
  busy,
  confirmAction,
  onPrice,
  onDate,
  onSource,
  onEdit,
  onCancelEdit,
  onSave,
  onAskApprove,
  onAskDelete,
  onCancelConfirm,
  onConfirm,
}: {
  item: FuelPrice;
  editing: boolean;
  editPrice: string;
  editDate: string;
  editSource: string;
  editError: string | null;
  saving: boolean;
  busy: boolean;
  confirmAction: 'approve' | 'delete' | null;
  onPrice: (value: string) => void;
  onDate: (value: string) => void;
  onSource: (value: string) => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (event: FormEvent) => void;
  onAskApprove: () => void;
  onAskDelete: () => void;
  onCancelConfirm: () => void;
  onConfirm: () => void;
}) {
  const future = item.effectiveFrom > todayIso();

  return (
    <>
      <tr className={editing ? 'row-active' : undefined}>
        <td data-label="Fuel">
          <span className="fuel-name">{FUEL_LABEL[item.fuelType]}</span>
        </td>
        <td data-label="Price (Rs/l)" className="num">
          {money(item.pricePerLitre)}
        </td>
        <td data-label="Effective from">{displayDate(item.effectiveFrom)}</td>
        <td data-label="Source" className="cell-muted">
          {item.source}
        </td>
        <td data-label="Status">
          <StatusBadge status="draft" />
        </td>
        <td data-label="Actions" className="cell-actions">
          {editing || confirmAction ? null : (
            <span className="row-actions">
              <button type="button" className="text-btn" onClick={onEdit}>
                Edit
              </button>
              <button type="button" className="btn btn-outline btn-small" onClick={onAskApprove}>
                Approve
              </button>
              <button type="button" className="text-btn text-btn-danger" onClick={onAskDelete}>
                Delete
              </button>
            </span>
          )}
        </td>
      </tr>
      {confirmAction && (
        <tr className={`confirm-row ${confirmAction === 'approve' ? 'is-approve' : 'is-delete'}`}>
          <td colSpan={6}>
            <div className={`confirm-bar ${confirmAction === 'approve' ? 'is-approve' : 'is-delete'}`}>
              <div className="confirm-copy">
                <p className="confirm-title">
                  {confirmAction === 'approve' ? 'Approve this price?' : 'Delete this draft?'}
                </p>
                <p className="confirm-text">
                  {confirmAction === 'approve' ? (
                    <>
                      {FUEL_LABEL[item.fuelType]} at Rs {money(item.pricePerLitre)} per litre,
                      effective {displayDate(item.effectiveFrom)}.{' '}
                      {future
                        ? 'Drivers will see it from that date.'
                        : 'Drivers will see it immediately.'}
                    </>
                  ) : (
                    <>
                      {FUEL_LABEL[item.fuelType]} draft for {displayDate(item.effectiveFrom)}. This
                      cannot be undone.
                    </>
                  )}
                </p>
              </div>
              <div className="confirm-actions">
                <button
                  type="button"
                  className={`btn btn-small ${confirmAction === 'approve' ? 'btn-live' : 'btn-danger'}`}
                  onClick={onConfirm}
                  disabled={busy}
                  autoFocus
                >
                  {busy
                    ? confirmAction === 'approve'
                      ? 'Approving…'
                      : 'Deleting…'
                    : confirmAction === 'approve'
                      ? 'Approve and go live'
                      : 'Delete draft'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={onCancelConfirm}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
      {editing && (
        <tr className="edit-row">
          <td colSpan={6}>
            <form className="edit-form" onSubmit={onSave} noValidate>
              <div className="edit-fields">
                <label className="edit-field">
                  <span className="field-label">Price (Rs/l)</span>
                  <input
                    className="input"
                    type="text"
                    inputMode="decimal"
                    value={editPrice}
                    onChange={(event) => onPrice(event.target.value)}
                    autoFocus
                  />
                </label>
                <label className="edit-field">
                  <span className="field-label">Effective from</span>
                  <input
                    className="input"
                    type="date"
                    value={editDate}
                    onChange={(event) => onDate(event.target.value)}
                  />
                </label>
                <label className="edit-field edit-field-wide">
                  <span className="field-label">Source</span>
                  <input
                    className="input"
                    type="text"
                    value={editSource}
                    onChange={(event) => onSource(event.target.value)}
                    maxLength={200}
                  />
                </label>
              </div>
              {editError && <Notice kind="error">{editError}</Notice>}
              <div className="edit-actions">
                <button type="submit" className="btn btn-primary btn-small" disabled={saving}>
                  {saving ? 'Saving…' : 'Save draft'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={onCancelEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

