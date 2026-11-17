import type { ReactNode } from 'react';

export function Notice({
  kind,
  children,
  id,
}: {
  kind: 'error' | 'success' | 'info';
  children: ReactNode;
  id?: string;
}) {
  return (
    <div id={id} className={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: 'draft' | 'approved' }) {
  return (
    <span className={`badge ${status === 'draft' ? 'badge-draft' : 'badge-live'}`}>
      <span className="badge-dot" aria-hidden="true" />
      {status === 'draft' ? 'Draft' : 'Live'}
    </span>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="loading" role="status">
      <span className="loading-dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
