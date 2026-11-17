import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError, type LoginResult } from '../api';
import { Notice } from '../components/ui';

export default function LoginScreen({
  onAuthenticated,
  onNeedsMfa,
  notice,
}: {
  onAuthenticated: (result: LoginResult) => void;
  onNeedsMfa: (token: string, email: string, password: string) => void;
  notice?: string | null;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const feedbackId = notice || error ? 'login-feedback' : undefined;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setPending(true);
    try {
      const result = await api.login(email.trim(), password, totp.trim() || undefined);
      if (result.mfaRequired) {
        onNeedsMfa(result.token, result.email, password);
      } else {
        onAuthenticated(result);
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'mfa_required' && !totp) {
        setShowCode(true);
        setError('Enter the 6-digit code from your authenticator app.');
        requestAnimationFrame(() => codeRef.current?.focus());
      } else if (caught instanceof ApiError && caught.status === 429) {
        setError('Too many attempts. Wait 15 minutes and try again.');
      } else {
        setError(caught instanceof Error ? caught.message : 'Sign in failed.');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login">
      <section className="login-card">
        <div className="login-intro">
          <div className="login-brand">
            <span className="wordmark" lang="ur" dir="rtl">
              ایندھن
            </span>
            <span className="brand-tag">Admin</span>
          </div>
          <h1>
            Prices drivers
            <br />
            can trust.
          </h1>
          <p className="login-lede">
            Change a fuel price in two steps: save it as a draft, then approve it. Nothing reaches
            drivers until it is approved.
          </p>
          <ol className="login-steps">
            <li>Add the new pump price</li>
            <li>Check it against the OGRA notification</li>
            <li>Approve — it goes live immediately</li>
          </ol>
        </div>

        <div className="login-panel">
          <h2>Sign in</h2>
          <p className="form-lede">Use your admin account. Sessions last 8 hours.</p>

          {(notice || error) && (
            <Notice kind={error ? 'error' : 'info'} id="login-feedback">
              {error ?? notice}
            </Notice>
          )}

          <form onSubmit={submit} noValidate>
            <div className="field">
              <label className="field-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@fuelcost.local"
                aria-invalid={Boolean(error) && !email.trim()}
                aria-describedby={feedbackId}
                autoFocus
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="password">
                Password
              </label>
              <div className="input-wrap">
                <input
                  id="password"
                  className="input input-with-action"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={Boolean(error) && !password}
                  aria-describedby={feedbackId}
                />
                <button
                  type="button"
                  className="input-action"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {showCode ? (
              <div className="field">
                <label className="field-label" htmlFor="totp">
                  Authenticator code
                </label>
                <input
                  id="totp"
                  ref={codeRef}
                  className="input input-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={totp}
                  onChange={(event) => setTotp(event.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                />
              </div>
            ) : (
              <button
                type="button"
                className="text-btn inline-link"
                onClick={() => {
                  setShowCode(true);
                  requestAnimationFrame(() => codeRef.current?.focus());
                }}
              >
                I have an authenticator code
              </button>
            )}

            <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
              {pending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="login-meta">
            Protected by two-factor authentication. New accounts set it up on first sign-in.
          </p>
        </div>
      </section>
    </main>
  );
}
