import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import type { AppConfig } from '../config';

export interface TxClient {
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<void>;
}

export interface SqlClient extends TxClient {
  transaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

function postgresPoolOptions(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  const sslMode = parsed.searchParams.get('sslmode');
  const requiresTls = sslMode !== null && sslMode !== 'disable';
  const verifiesCertificate = sslMode === 'verify-full' || sslMode === 'verify-ca';
  parsed.searchParams.delete('sslmode');
  return {
    connectionString: parsed.toString(),
    ssl: requiresTls ? { rejectUnauthorized: verifiesCertificate } : false,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  };
}

export async function createSqlClient(cfg: AppConfig): Promise<SqlClient> {
  if (cfg.dbDriver === 'postgres') {
    if (!cfg.databaseUrl) throw new Error('DATABASE_URL missing');
    const pool = new Pool(postgresPoolOptions(cfg.databaseUrl));
    return {
      async query<T>(sql: string, params?: readonly unknown[]) {
        const result = await pool.query(sql, params as unknown[] | undefined);
        return { rows: result.rows as T[] };
      },
      async exec(sql: string) {
        await pool.query(sql);
      },
      async transaction<T>(fn: (tx: TxClient) => Promise<T>) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const value = await fn({
            async query<R>(sql: string, params?: readonly unknown[]) {
              const result = await client.query(sql, params as unknown[] | undefined);
              return { rows: result.rows as R[] };
            },
            async exec(sql: string) {
              await client.query(sql);
            },
          });
          await client.query('COMMIT');
          return value;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      },
      async close() {
        await pool.end();
      },
    };
  }

  const dir = resolve(cfg.pgliteDir);
  mkdirSync(dirname(dir), { recursive: true });
  const pglite = new PGlite(dir);
  await pglite.waitReady;
  return {
    async query<T>(sql: string, params?: readonly unknown[]) {
      const result = await pglite.query<T>(sql, params as unknown[] | undefined);
      return { rows: result.rows };
    },
    async exec(sql: string) {
      await pglite.exec(sql);
    },
    async transaction<T>(fn: (tx: TxClient) => Promise<T>) {
      return pglite.transaction(async (tx) =>
        fn({
          async query<R>(sql: string, params?: readonly unknown[]) {
            const result = await tx.query<R>(sql, params as unknown[] | undefined);
            return { rows: result.rows };
          },
          async exec(sql: string) {
            await tx.exec(sql);
          },
        }),
      );
    },
    async close() {
      await pglite.close();
    },
  };
}
