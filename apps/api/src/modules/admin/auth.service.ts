import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AdminLoginResponse } from '@fce/contracts';
import { hashPassword, newTotpSecret, otpauthUrl, verifyPassword, verifyTotp } from '../../common/crypto';
import { AppError, errorCodes } from '../../common/errors';
import { nowIso } from '../../common/time';
import { SQL, type SqlClient } from '../../db/token';
import { AuditService } from './audit.service';

export interface AdminRow {
  id: number;
  email: string;
  password_hash: string;
  totp_secret: string | null;
  mfa_enabled: boolean;
  role: 'admin' | 'editor';
}

export interface AdminClaims {
  sub: number;
  email: string;
  role: 'admin' | 'editor';
  mfa: boolean;
}

@Injectable()
export class AdminAuthService {
  constructor(
    @Inject(SQL) private readonly sql: SqlClient,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, totp?: string): Promise<AdminLoginResponse> {
    const result = await this.sql.query<AdminRow>(
      'SELECT id, email, password_hash, totp_secret, mfa_enabled, role FROM admin_users WHERE email = $1',
      [email.toLowerCase()],
    );
    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new AppError(errorCodes.unauthorized, 'Email or password is incorrect', 401);
    }

    if (user.mfa_enabled) {
      if (!totp) {
        throw new AppError(errorCodes.mfaRequired, 'Authenticator code is required', 401);
      }
      if (!user.totp_secret || !verifyTotp(totp, user.totp_secret)) {
        throw new AppError(errorCodes.mfaInvalid, 'Authenticator code is incorrect', 401);
      }
    }

    await this.sql.query('UPDATE admin_users SET last_login_at = NOW() WHERE id = $1', [user.id]);
    await this.audit.record(user.email, 'admin.login', 'admin_user', String(user.id), null, {
      at: nowIso(),
      mfa: user.mfa_enabled,
    });

    const token = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      mfa: user.mfa_enabled,
    } satisfies AdminClaims);

    return {
      token,
      email: user.email,
      mfaEnabled: user.mfa_enabled,
      mfaRequired: !user.mfa_enabled,
    };
  }

  async startMfaSetup(email: string): Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string }> {
    const user = await this.findByEmail(email);
    if (user.mfa_enabled) {
      throw new AppError(errorCodes.conflict, 'MFA is already enabled for this account', 409);
    }
    let secret = user.totp_secret;
    if (!secret) {
      const candidate = newTotpSecret();
      const stored = await this.sql.query<{ totp_secret: string }>(
        'UPDATE admin_users SET totp_secret = COALESCE(totp_secret, $1) WHERE id = $2 RETURNING totp_secret',
        [candidate, user.id],
      );
      secret = stored.rows[0]!.totp_secret;
      if (secret === candidate) {
        await this.audit.record(email, 'admin.mfa.setup_started', 'admin_user', String(user.id), null, null);
      }
    }

    const uri = otpauthUrl(email, secret);
    const QRCode = await import('qrcode');
    const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 240 });
    return { secret, otpauthUrl: uri, qrDataUrl };
  }

  async confirmMfa(email: string, code: string): Promise<{ mfaEnabled: true }> {
    const user = await this.findByEmail(email);
    if (!user.totp_secret) {
      throw new AppError(errorCodes.conflict, 'Start MFA setup first', 409);
    }
    if (!verifyTotp(code, user.totp_secret)) {
      throw new AppError(errorCodes.mfaInvalid, 'Authenticator code is incorrect', 400);
    }
    await this.sql.query('UPDATE admin_users SET mfa_enabled = TRUE WHERE id = $1', [user.id]);
    await this.audit.record(email, 'admin.mfa.enabled', 'admin_user', String(user.id), null, { at: nowIso() });
    return { mfaEnabled: true };
  }

  async ensureBootstrapAdmin(email: string, password: string): Promise<{ created: boolean }> {
    const existing = await this.sql.query<{ count: string | number }>('SELECT COUNT(*) AS count FROM admin_users');
    const count = Number(existing.rows[0]?.count ?? 0);
    if (count > 0) return { created: false };
    await this.sql.query(
      'INSERT INTO admin_users (email, password_hash, role) VALUES ($1, $2, $3)',
      [email.toLowerCase(), hashPassword(password), 'admin'],
    );
    return { created: true };
  }

  private async findByEmail(email: string): Promise<AdminRow> {
    const result = await this.sql.query<AdminRow>(
      'SELECT id, email, password_hash, totp_secret, mfa_enabled, role FROM admin_users WHERE email = $1',
      [email.toLowerCase()],
    );
    const user = result.rows[0];
    if (!user) throw new AppError(errorCodes.notFound, 'Admin account not found', 404);
    return user;
  }
}
