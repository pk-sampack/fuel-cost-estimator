import { config } from '../config';
import { createSqlClient } from './client';
import { runMigrations } from './migrator';

async function main() {
  const sql = await createSqlClient(config);
  try {
    const report = await runMigrations(sql, { logger: console.log });
    console.log(`migrations: ${report.applied.length} applied, ${report.skipped.length} already current`);
  } finally {
    await sql.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
