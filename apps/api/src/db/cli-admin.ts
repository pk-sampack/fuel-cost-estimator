import { randomBytes } from 'node:crypto';
import { config } from '../config';
import { createSqlClient } from './client';
import { runMigrations } from './migrator';
import { hashPassword } from '../common/crypto';

async function main() {
  const sql = await createSqlClient(config);
  try {
    await runMigrations(sql, { logger: console.log });
    const email = config.adminEmail ?? 'admin@fuelcost.local';
    const generated = !config.adminPassword;
    const password = config.adminPassword ?? `Fce-${randomBytes(9).toString('base64url')}`;

    const existing = await sql.query<{ count: string | number }>('SELECT COUNT(*) AS count FROM admin_users');
    if (Number(existing.rows[0]?.count ?? 0) > 0) {
      console.log('admin account already exists; nothing to do');
      return;
    }

    await sql.query('INSERT INTO admin_users (email, password_hash, role) VALUES ($1, $2, $3)', [
      email.toLowerCase(),
      hashPassword(password),
      'admin',
    ]);
    console.log(`admin created: ${email}`);
    if (generated) {
      console.log(`one-time password: ${password}`);
      console.log('store it in your password manager now, then enable MFA on first sign-in');
    }
  } finally {
    await sql.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
