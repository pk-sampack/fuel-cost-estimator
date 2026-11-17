const PK_TZ = 'Asia/Karachi';

export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function displayDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-');
  if (!year || !month || !day) return iso;
  return `${day}-${month}-${year}`;
}

export function money(value: number): string {
  return new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function timestamp(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: PK_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
