export function Money({ value, hero = false }: { value: number; hero?: boolean }) {
  const safe = Number.isFinite(value) ? value : 0;
  const formatted = safe.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [whole, decimals] = formatted.split('.');
  return (
    <span className={hero ? 'money money-hero' : 'money'} dir="ltr">
      <span className="money-whole">{whole}</span>
      <span className="money-dec">.{decimals}</span>
    </span>
  );
}

export function num(value: number, digits = 2): string {
  return value.toLocaleString('en-PK', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function compactDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}
