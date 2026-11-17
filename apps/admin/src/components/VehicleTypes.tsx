import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError, type AdminSession, type VehicleType } from '../api';
import { timestamp } from '../format';
import { Notice, Spinner } from './ui';

interface EditState {
  nameEn: string;
  nameUr: string;
  kmplMin: string;
  kmplMax: string;
  defaultLoadPenaltyK: string;
  seats: string;
  payloadTons: string;
  sortOrder: string;
  active: boolean;
}

function toEditState(vehicle: VehicleType): EditState {
  return {
    nameEn: vehicle.nameEn,
    nameUr: vehicle.nameUr,
    kmplMin: String(vehicle.kmplMin),
    kmplMax: String(vehicle.kmplMax),
    defaultLoadPenaltyK: String(vehicle.defaultLoadPenaltyK),
    seats: vehicle.seats === null ? '' : String(vehicle.seats),
    payloadTons: vehicle.payloadTons === null ? '' : String(vehicle.payloadTons),
    sortOrder: String(vehicle.sortOrder),
    active: vehicle.active,
  };
}

export default function VehicleTypes({
  session,
  onSignOut,
}: {
  session: AdminSession;
  onSignOut: (message: string) => void;
}) {
  const [items, setItems] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      const vehicles = await api.listVehicles(session.token);
      setItems(vehicles.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (error) {
      if (!handleAuth(error)) {
        setLoadError(error instanceof Error ? error.message : 'Could not load vehicle types.');
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

  function startEdit(vehicle: VehicleType) {
    setEditingCode(vehicle.code);
    setEdit(toEditState(vehicle));
    setEditError(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editingCode || !edit || saving) return;
    setEditError(null);

    const kmplMin = Number(edit.kmplMin);
    const kmplMax = Number(edit.kmplMax);
    const penalty = Number(edit.defaultLoadPenaltyK);
    const seats = edit.seats.trim() ? Number(edit.seats) : null;
    const payloadTons = edit.payloadTons.trim() ? Number(edit.payloadTons) : null;
    const sortOrder = Number(edit.sortOrder);

    if (!edit.nameEn.trim() || !edit.nameUr.trim()) {
      setEditError('Both names are required.');
      return;
    }
    if (!Number.isFinite(kmplMin) || kmplMin <= 0 || kmplMin > 100) {
      setEditError('Minimum km/l must be between 0 and 100.');
      return;
    }
    if (!Number.isFinite(kmplMax) || kmplMax <= kmplMin || kmplMax > 200) {
      setEditError('Maximum km/l must be greater than the minimum.');
      return;
    }
    if (!Number.isFinite(penalty) || penalty < 0 || penalty > 0.9) {
      setEditError('Load penalty must be between 0 and 0.9.');
      return;
    }
    if (seats !== null && (!Number.isInteger(seats) || seats < 1 || seats > 100)) {
      setEditError('Seats must be a whole number between 1 and 100.');
      return;
    }
    if (payloadTons !== null && (!Number.isFinite(payloadTons) || payloadTons <= 0 || payloadTons > 100)) {
      setEditError('Payload must be between 0 and 100 tons.');
      return;
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 999) {
      setEditError('Sort order must be a whole number between 0 and 999.');
      return;
    }

    setSaving(true);
    try {
      const updated = await api.patchVehicle(session.token, editingCode, {
        nameEn: edit.nameEn.trim(),
        nameUr: edit.nameUr.trim(),
        kmplMin,
        kmplMax,
        defaultLoadPenaltyK: penalty,
        seats: edit.seats.trim() ? seats : null,
        payloadTons: edit.payloadTons.trim() ? payloadTons : null,
        sortOrder,
        active: edit.active,
      });
      setItems((current) =>
        current
          .map((item) => (item.code === updated.code ? updated : item))
          .sort((a, b) => a.sortOrder - b.sortOrder),
      );
      setEditingCode(null);
      setEdit(null);
      setFlash(`${updated.nameEn} updated.`);
    } catch (error) {
      if (!handleAuth(error)) {
        setEditError(error instanceof Error ? error.message : 'Could not save the vehicle type.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="vehicles-title">
      <div className="section-head">
        <div>
          <h2 id="vehicles-title" className="section-title">
            Vehicle types
          </h2>
          <p className="section-sub">
            These defaults set seating or payload capacity, the kilometre-per-litre range and load
            penalty used in estimates. Hiding a type removes it from the driver app.
          </p>
        </div>
        <button type="button" className="text-btn" onClick={() => void load()} disabled={loading}>
          Refresh
        </button>
      </div>

      {flash && <Notice kind="success">{flash}</Notice>}

      {loading ? (
        <Spinner label="Loading vehicle types…" />
      ) : loadError ? (
        <div className="card card-plain">
          <Notice kind="error">{loadError}</Notice>
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : (
        <div className="table-wrap card-table">
          <table className="vehicle-table">
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Vehicle</th>
                <th scope="col">Class</th>
                <th scope="col">km/l range</th>
                <th scope="col">Capacity</th>
                <th scope="col">Load penalty</th>
                <th scope="col">Sort</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((vehicle) => (
                <VehicleRow
                  key={vehicle.code}
                  vehicle={vehicle}
                  editing={editingCode === vehicle.code}
                  edit={editingCode === vehicle.code ? edit : null}
                  error={editingCode === vehicle.code ? editError : null}
                  saving={saving}
                  onEdit={() => startEdit(vehicle)}
                  onCancel={() => {
                    setEditingCode(null);
                    setEdit(null);
                    setEditError(null);
                  }}
                  onChange={setEdit}
                  onSave={save}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function VehicleRow({
  vehicle,
  editing,
  edit,
  error,
  saving,
  onEdit,
  onCancel,
  onChange,
  onSave,
}: {
  vehicle: VehicleType;
  editing: boolean;
  edit: EditState | null;
  error: string | null;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onChange: (next: EditState) => void;
  onSave: (event: FormEvent) => void;
}) {
  function update<K extends keyof EditState>(key: K, value: EditState[K]) {
    if (!edit) return;
    onChange({ ...edit, [key]: value });
  }

  return (
    <>
      <tr className={`${editing ? 'row-active' : ''} ${vehicle.active ? '' : 'row-inactive'}`}>
        <td data-label="Code">
          <code className="code">{vehicle.code}</code>
        </td>
        <td data-label="Vehicle">
          <span className="vehicle-name">{vehicle.nameEn}</span>
          <span className="vehicle-ur" lang="ur" dir="rtl">
            {vehicle.nameUr}
          </span>
        </td>
        <td data-label="Class">
          <span className={`class-chip class-${vehicle.class}`}>{vehicle.class}</span>
        </td>
        <td data-label="km/l range" className="num">
          {vehicle.kmplMin}–{vehicle.kmplMax}
        </td>
        <td data-label="Capacity" className="num">
          {vehicle.seats !== null
            ? `${vehicle.seats} seats`
            : vehicle.payloadTons !== null
              ? `${vehicle.payloadTons} t`
              : '—'}
        </td>
        <td data-label="Load penalty" className="num">
          {vehicle.defaultLoadPenaltyK.toFixed(2)}
        </td>
        <td data-label="Sort" className="num">
          {vehicle.sortOrder}
        </td>
        <td data-label="Status">
          <span className={`state ${vehicle.active ? 'state-on' : 'state-off'}`}>
            <span className="state-dot" aria-hidden="true" />
            {vehicle.active ? 'Active' : 'Hidden'}
          </span>
        </td>
        <td data-label="Actions" className="cell-actions">
          {!editing && (
            <button type="button" className="text-btn" onClick={onEdit}>
              Edit
            </button>
          )}
        </td>
      </tr>
      {editing && edit && (
        <tr className="edit-row">
          <td colSpan={9}>
            <form className="edit-form" onSubmit={onSave} noValidate>
              <div className="edit-fields">
                <label className="edit-field">
                  <span className="field-label">Name (English)</span>
                  <input
                    className="input"
                    type="text"
                    value={edit.nameEn}
                    onChange={(event) => update('nameEn', event.target.value)}
                    maxLength={80}
                    autoFocus
                  />
                </label>
                <label className="edit-field">
                  <span className="field-label">Name (Urdu)</span>
                  <input
                    className="input input-ur"
                    type="text"
                    lang="ur"
                    dir="rtl"
                    value={edit.nameUr}
                    onChange={(event) => update('nameUr', event.target.value)}
                    maxLength={80}
                  />
                </label>
                <label className="edit-field edit-field-narrow">
                  <span className="field-label">Min km/l</span>
                  <input
                    className="input"
                    type="text"
                    inputMode="decimal"
                    value={edit.kmplMin}
                    onChange={(event) => update('kmplMin', event.target.value)}
                  />
                </label>
                <label className="edit-field edit-field-narrow">
                  <span className="field-label">Max km/l</span>
                  <input
                    className="input"
                    type="text"
                    inputMode="decimal"
                    value={edit.kmplMax}
                    onChange={(event) => update('kmplMax', event.target.value)}
                  />
                </label>
                <label className="edit-field edit-field-narrow">
                  <span className="field-label">Load penalty</span>
                  <input
                    className="input"
                    type="text"
                    inputMode="decimal"
                    value={edit.defaultLoadPenaltyK}
                    onChange={(event) => update('defaultLoadPenaltyK', event.target.value)}
                  />
                </label>
                {vehicle.class === 'passenger' ? (
                  <label className="edit-field edit-field-narrow">
                    <span className="field-label">Seats</span>
                    <input
                      className="input"
                      type="text"
                      inputMode="numeric"
                      value={edit.seats}
                      onChange={(event) => update('seats', event.target.value)}
                      placeholder="4"
                    />
                  </label>
                ) : (
                  <label className="edit-field edit-field-narrow">
                    <span className="field-label">Payload (tons)</span>
                    <input
                      className="input"
                      type="text"
                      inputMode="decimal"
                      value={edit.payloadTons}
                      onChange={(event) => update('payloadTons', event.target.value)}
                      placeholder="2.5"
                    />
                  </label>
                )}
                <label className="edit-field edit-field-narrow">
                  <span className="field-label">Sort order</span>
                  <input
                    className="input"
                    type="text"
                    inputMode="numeric"
                    value={edit.sortOrder}
                    onChange={(event) => update('sortOrder', event.target.value)}
                  />
                </label>
              </div>

              <label className="check-row">
                <input
                  type="checkbox"
                  checked={edit.active}
                  onChange={(event) => update('active', event.target.checked)}
                />
                <span>
                  <strong>Shown to drivers</strong>
                  <span className="check-hint">
                    Turn off to hide this vehicle from the app without deleting its history.
                  </span>
                </span>
              </label>

              {error && <Notice kind="error">{error}</Notice>}

              <div className="edit-actions">
                <button type="submit" className="btn btn-primary btn-small" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={onCancel}
                  disabled={saving}
                >
                  Cancel
                </button>
                <span className="edit-meta">
                  {vehicle.pictureKey} · updated {timestamp(vehicle.updatedAt)}
                </span>
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}
