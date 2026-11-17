import { randomBytes } from 'node:crypto';
import { config } from '../config';
import { createSqlClient } from './client';
import { runMigrations } from './migrator';
import { hashPassword } from '../common/crypto';

async function main() {
  const sql = await createSqlClient(config);
  try {
    await runMigrations(sql, { logger: console.log });

    const email = config.adminEmail?.toLowerCase();
    const result = email
      ? await sql.query<{ id: number; email: string }>(
          'SELECT id, email FROM admin_users WHERE email = $1',
          [email],
        )
      : await sql.query<{ id: number; email: string }>(
          'SELECT id, email FROM admin_users ORDER BY id LIMIT 1',
        );

    const user = result.rows[0];
    if (!user) {
      console.log('no admin account found; run npm run admin:boot first');
      process.exitCode = 1;
      return;
    }

    const generated = !config.adminPassword;
    const password = config.adminPassword ?? `Fce-${randomBytes(9).toString('base64url')}`;

    await sql.query(
      'UPDATE admin_users SET password_hash = $1, totp_secret = NULL, mfa_enabled = FALSE WHERE id = $2',
      [hashPassword(password), user.id],
    );

    console.log(`password reset for: ${user.email}`);
    console.log(`one-time password: ${password}`);
    console.log('two-factor reset: you will set it up on next sign-in');
    if (generated) {
      console.log('store the password in your password manager now');
    }
  } finally {
    await sql.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
