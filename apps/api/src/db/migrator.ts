import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SqlClient } from './client';
import { BUNDLED_MIGRATIONS } from './migrations.generated';

export const MIGRATIONS_DIR = join(__dirname, '..', '..', 'db', 'migrations');
const MIGRATION_LOCK_SQL = 'SELECT pg_advisory_xact_lock(731907421)';

export interface MigrationReport {
  applied: string[];
  skipped: string[];
}

interface MigrationSource {
  name: string;
  body: string;
}

function loadSources(dir?: string): MigrationSource[] {
  if (!dir) return BUNDLED_MIGRATIONS.map((migration) => ({ ...migration }));
  return readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, body: readFileSync(join(dir, name), 'utf8') }));
}

export async function runMigrations(
  sql: SqlClient,
  options: { dir?: string; logger?: (line: string) => void } = {},
): Promise<MigrationReport> {
  const log = options.logger ?? (() => undefined);
  const sources = loadSources(options.dir);

  await sql.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())',
  );

  return sql.transaction(async (tx) => {
    await tx.query(MIGRATION_LOCK_SQL);

    const existing = await tx.query<{ name: string; checksum: string }>('SELECT name, checksum FROM schema_migrations');
    const applied = new Map<string, string>();
    for (const row of existing.rows) applied.set(row.name, row.checksum);

    const report: MigrationReport = { applied: [], skipped: [] };

    for (const { name, body } of sources) {
      const checksum = createHash('sha256').update(body).digest('hex');
      const previous = applied.get(name);
      if (previous) {
        if (previous !== checksum) {
          throw new Error(`Migration ${name} changed after it was applied. Add a new migration instead.`);
        }
        report.skipped.push(name);
        continue;
      }
      await tx.exec(body);
      await tx.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [name, checksum]);
      report.applied.push(name);
      log(`applied ${name}`);
    }

    return report;
  });
}
