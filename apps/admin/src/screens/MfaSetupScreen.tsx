import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError, type LoginResult } from '../api';
import { Notice, Spinner } from '../components/ui';

interface SetupData {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

export default function MfaSetupScreen({
  token,
  email,
  password,
  onDone,
  onCancel,
}: {
  token: string;
  email: string;
  password: string;
  onDone: (result: LoginResult) => void;
  onCancel: () => void;
}) {
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .setupMfa(token)
      .then((data) => {
        if (alive) setSetup(data);
      })
      .catch((caught: unknown) => {
        if (!alive) return;
        if (caught instanceof ApiError && caught.status === 401) {
          setError('Your sign-in expired. Go back and sign in again.');
        } else if (caught instanceof ApiError && caught.code === 'conflict') {
          setError('Two-factor is already enabled on this account. Sign in with your code instead.');
        } else {
          setError(caught instanceof Error ? caught.message : 'Could not start two-factor setup.');
        }
      });
    return () => {
      alive = false;
    };
  }, [token]);

  const finish = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (pending) return;
      setError(null);

      if (!/^\d{6}$/.test(code)) {
        setError('Enter the 6-digit code shown in your authenticator app.');
        return;
      }

      setPending(true);
      try {
        await api.verifyMfa(token, code);
        setEnabled(true);
        const result = await api.login(email, password, code);
        onDone(result);
      } catch (caught) {
        if (caught instanceof ApiError && caught.code === 'mfa_invalid') {
          setError('That code is not valid. Check the app and try the current code.');
        } else if (caught instanceof ApiError && caught.status === 401) {
          setError('Sign-in expired. Go back and sign in again.');
        } else {
          setError(caught instanceof Error ? caught.message : 'Could not verify the code.');
        }
        setEnabled(false);
        setPending(false);
      }
    },
    [code, email, onDone, password, pending, token],
  );

  return (
    <main className="login">
      <section className="setup-card">
        <div className="setup-head">
          <div className="login-brand">
            <span className="wordmark" lang="ur" dir="rtl">
              ایندھن
            </span>
            <span className="brand-tag">Admin</span>
          </div>
          <button type="button" className="text-btn" onClick={onCancel}>
            Back to sign in
          </button>
        </div>

        <h1 className="setup-title">Set up two-factor authentication</h1>
        <p className="form-lede">
          Required before you can manage prices. Scan the code with Google Authenticator, Authy, or
          any TOTP app, then enter the 6-digit code it shows.
        </p>

        {error && <Notice kind="error">{error}</Notice>}

        {!setup && !error && <Spinner label="Preparing your authenticator code…" />}

        {setup && (
          <div className="setup-grid">
            <div className="setup-qr">
              <img src={setup.qrDataUrl} alt="QR code for authenticator app" width={240} height={240} />
              <p className="setup-qr-hint">Scan this with your phone</p>
            </div>

            <div className="setup-form">
              <div className="field">
                <span className="field-label">Manual setup key</span>
                <code className="secret">{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
              </div>

              <form onSubmit={finish} noValidate>
                <div className="field">
                  <label className="field-label" htmlFor="setup-code">
                    6-digit code
                  </label>
                  <input
                    id="setup-code"
                    className="input input-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    disabled={enabled}
                    autoFocus
                  />
                </div>

                {enabled ? (
                  <p className="setup-done">Two-factor enabled. Signing you in…</p>
                ) : (
                  <button className="btn btn-primary btn-block" type="submit" disabled={pending || !setup}>
                    {pending ? 'Checking code…' : 'Turn on two-factor'}
                  </button>
                )}
              </form>

              <p className="login-meta">
                Keep the authenticator app installed. You will need a code each time you sign in.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
