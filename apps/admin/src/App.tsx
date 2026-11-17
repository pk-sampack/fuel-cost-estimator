import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, TOKEN_KEY, type AdminMe, type AdminSession, type LoginResult } from './api';
import LoginScreen from './screens/LoginScreen';
import MfaSetupScreen from './screens/MfaSetupScreen';
import Dashboard from './screens/Dashboard';

type Screen =
  | { kind: 'boot' }
  | { kind: 'login'; notice?: string }
  | { kind: 'mfa'; token: string; email: string; password: string }
  | { kind: 'dashboard'; session: AdminSession; me: AdminMe };

function saveToken(token: string) {
  try {
    window.sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* private mode - session stays in memory */
  }
}

function clearToken() {
  try {
    window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function readToken(): string | null {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'boot' });

  useEffect(() => {
    const token = readToken();
    if (!token) {
      setScreen({ kind: 'login' });
      return;
    }

    let alive = true;
    api
      .me(token)
      .then((me) => {
        if (!alive) return;
        setScreen({ kind: 'dashboard', session: { token, email: me.email }, me });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        clearToken();
        const notice =
          error instanceof ApiError && error.status === 401
            ? 'Session expired. Sign in again.'
            : undefined;
        setScreen({ kind: 'login', notice });
      });

    return () => {
      alive = false;
    };
  }, []);

  const authenticated = useCallback((result: LoginResult) => {
    saveToken(result.token);
    setScreen({
      kind: 'dashboard',
      session: { token: result.token, email: result.email },
      me: { email: result.email, role: 'admin', mfaEnabled: result.mfaEnabled },
    });
  }, []);

  const signOut = useCallback((message: string) => {
    clearToken();
    setScreen({ kind: 'login', notice: message });
  }, []);

  if (screen.kind === 'boot') {
    return (
      <main className="login">
        <p className="boot" role="status">
          Loading admin…
        </p>
      </main>
    );
  }

  if (screen.kind === 'login') {
    return (
      <LoginScreen
        notice={screen.notice}
        onAuthenticated={authenticated}
        onNeedsMfa={(token, email, password) =>
          setScreen({ kind: 'mfa', token, email, password })
        }
      />
    );
  }

  if (screen.kind === 'mfa') {
    return (
      <MfaSetupScreen
        token={screen.token}
        email={screen.email}
        password={screen.password}
        onDone={authenticated}
        onCancel={() => setScreen({ kind: 'login' })}
      />
    );
  }

  return <Dashboard session={screen.session} me={screen.me} onSignOut={signOut} />;
}
