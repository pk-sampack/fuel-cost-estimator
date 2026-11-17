const DIGIT_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  '٫': '.',
  '٬': '',
  ',': '',
};

export function normalizeDigits(input: string): string {
  return input
    .split('')
    .map((char) => DIGIT_MAP[char] ?? char)
    .join('');
}

export function parseDecimal(input: string): number | null {
  const normalized = normalizeDigits(input).replace(/[^\d.]/g, '');
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function formatDuration(seconds: number, lang: 'ur' | 'en'): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (lang === 'ur') {
    if (hours === 0) return `${minutes} منٹ`;
    if (minutes === 0) return `${hours} گھنٹے`;
    return `${hours} گھنٹے ${minutes} منٹ`;
  }
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

export function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
