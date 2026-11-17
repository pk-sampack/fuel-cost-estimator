const DEVICE_KEY = 'fce.device.v1';
const PROFILE_KEY = 'fce.profile.v1';
const LOCALE_KEY = 'fce.locale.v1';

export interface Profile {
  vehicleTypeCode: string;
  kmpl: number;
  kmplFull: number | null;
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage may be unavailable in private mode; the app still works for this session
  }
}

export function getDeviceToken(): string {
  const existing = read(DEVICE_KEY);
  if (existing) return existing;
  const token = createToken();
  write(DEVICE_KEY, token);
  return token;
}

function createToken(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }
  const bytes = new Uint8Array(24);
  if (cryptoRef && typeof cryptoRef.getRandomValues === 'function') {
    cryptoRef.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function loadProfile(): Profile | null {
  const raw = read(PROFILE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Profile;
    if (typeof parsed.vehicleTypeCode !== 'string' || !Number.isFinite(parsed.kmpl) || parsed.kmpl <= 0) return null;
    return {
      vehicleTypeCode: parsed.vehicleTypeCode,
      kmpl: parsed.kmpl,
      kmplFull: typeof parsed.kmplFull === 'number' && parsed.kmplFull > 0 ? parsed.kmplFull : null,
    };
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile): void {
  write(PROFILE_KEY, JSON.stringify(profile));
}

export function clearProfile(): void {
  try {
    window.localStorage.removeItem(PROFILE_KEY);
  } catch {
    // ignore
  }
}

export function loadLocale(): 'ur' | 'en' | null {
  const raw = read(LOCALE_KEY);
  return raw === 'ur' || raw === 'en' ? raw : null;
}

export function saveLocale(locale: 'ur' | 'en'): void {
  write(LOCALE_KEY, locale);
}
