import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SqlClient } from './client';

export const MIGRATIONS_DIR = join(__dirname, '..', '..', 'db', 'migrations');

export interface MigrationReport {
  applied: string[];
  skipped: string[];
}

export async function runMigrations(
  sql: SqlClient,
  options: { dir?: string; logger?: (line: string) => void } = {},
): Promise<MigrationReport> {
  const dir = options.dir ?? MIGRATIONS_DIR;
  const log = options.logger ?? (() => undefined);

  await sql.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())',
  );

  const applied = new Map<string, string>();
  const existing = await sql.query<{ name: string; checksum: string }>('SELECT name, checksum FROM schema_migrations');
  for (const row of existing.rows) applied.set(row.name, row.checksum);

  const files = readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const report: MigrationReport = { applied: [], skipped: [] };

  for (const file of files) {
    const body = readFileSync(join(dir, file), 'utf8');
    const checksum = createHash('sha256').update(body).digest('hex');
    const previous = applied.get(file);
    if (previous) {
      if (previous !== checksum) {
        throw new Error(`Migration ${file} changed after it was applied. Add a new migration instead.`);
      }
      report.skipped.push(file);
      continue;
    }
    await sql.transaction(async (tx) => {
      await tx.exec(body);
      await tx.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [file, checksum]);
    });
    report.applied.push(file);
    log(`applied ${file}`);
  }

  return report;
}
