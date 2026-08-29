import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { getTableName, sql, type SQL } from 'drizzle-orm';

import { parseDsn, type Dialect } from './dsn.ts';
import * as mysqlSchema from './schema/mysql.ts';
import * as pgSchema from './schema/pg.ts';
import * as sqliteSchema from './schema/sqlite.ts';

export type StackRow = typeof sqliteSchema.stackSample.$inferInsert;
export type PackRow = typeof sqliteSchema.packSample.$inferInsert;
export type HealthRow = typeof sqliteSchema.packHealth.$inferInsert;

/**
 * What the rest of the daemon is allowed to know about storage. Writes go through Drizzle's typed
 * builders; the aggregate reads are `sql` templates compiled by Drizzle's dialect and run on the
 * driver directly, because those queries are all bucketing and SUM/MIN/MAX and gain nothing from
 * the builder while costing three copies of themselves.
 */
export interface Store {
  dialect: Dialect;
  /** Shown on `/api/health` so a misdirected DSN is visible without reading logs. */
  describe: string;
  insertStack(row: StackRow): Promise<void>;
  insertPacks(rows: PackRow[]): Promise<void>;
  insertHealth(row: HealthRow): Promise<void>;
  prune(before: number): Promise<number>;
  rows<T>(query: SQL): Promise<T[]>;
  close(): Promise<void>;
}

export async function openStore(
  url: string,
  migrationsRoot: string,
): Promise<Store> {
  const dsn = parseDsn(url);

  if (dsn.dialect === 'mysql') {
    return openMysql(dsn.target, `${migrationsRoot}/mysql`);
  }

  if (dsn.dialect === 'postgres') {
    return openPostgres(dsn.target, `${migrationsRoot}/postgres`);
  }

  return openSqlite(dsn.target, `${migrationsRoot}/sqlite`);
}

/**
 * `node:sqlite` rather than a compiled binding: the image is published for amd64 and arm64 from
 * one `node_modules` tree installed on an amd64 runner, and a native driver would ship that
 * runner's binary to both. Drizzle reaches it through the proxy driver, which is ordinal-based —
 * hence the `Object.values` on the way out.
 */
async function openSqlite(file: string, migrations: string): Promise<Store> {
  const { DatabaseSync } = await import('node:sqlite');
  const { drizzle } = await import('drizzle-orm/sqlite-proxy');
  const { migrate } = await import('drizzle-orm/sqlite-proxy/migrator');
  const { SQLiteSyncDialect } = await import('drizzle-orm/sqlite-core');

  if (file !== ':memory:') {
    mkdirSync(dirname(file), { recursive: true });
  }

  const sqlite = new DatabaseSync(file);

  // WAL keeps the minute-by-minute writes from blocking a dashboard query mid-flight.
  sqlite.exec('PRAGMA journal_mode = WAL');
  sqlite.exec('PRAGMA synchronous = NORMAL');
  sqlite.exec('PRAGMA busy_timeout = 5000');

  const bind = (params: unknown[]): unknown[] =>
    params.map((value) => (typeof value === 'boolean' ? Number(value) : value));

  const db = drizzle(async (query, params, method) => {
    const statement = sqlite.prepare(query);

    if (method === 'run') {
      statement.run(...(bind(params) as never[]));

      return { rows: [] };
    }

    const rows = statement
      .all(...(bind(params) as never[]))
      .map((row) => Object.values(row as object));

    return { rows: method === 'get' ? ((rows[0] ?? []) as never) : rows };
  });

  await migrate(
    db,
    async (queries) => {
      for (const query of queries) {
        sqlite.exec(query);
      }
    },
    { migrationsFolder: migrations },
  );

  const dialect = new SQLiteSyncDialect();
  const schema = sqliteSchema;

  return {
    dialect: 'sqlite',
    describe: `sqlite ${file}`,
    insertStack: async (row) => {
      await db.insert(schema.stackSample).values(row).onConflictDoNothing();
    },
    insertPacks: async (rows) => {
      if (rows.length) {
        await db.insert(schema.packSample).values(rows).onConflictDoNothing();
      }
    },
    insertHealth: async (row) => {
      await db.insert(schema.packHealth).values(row);
    },
    prune: async (before) => {
      let removed = 0;

      for (const table of [schema.stackSample, schema.packSample]) {
        const result = sqlite
          .prepare(`DELETE FROM "${getTableName(table)}" WHERE at < ?`)
          .run(before);

        removed += Number(result.changes);
      }

      return removed;
    },
    rows: async <T>(query: SQL) => {
      const compiled = dialect.sqlToQuery(query);

      return sqlite
        .prepare(compiled.sql)
        .all(...(bind(compiled.params) as never[])) as T[];
    },
    close: async () => sqlite.close(),
  };
}

async function openMysql(url: string, migrations: string): Promise<Store> {
  const { createPool } = await import('mysql2/promise');
  const { drizzle } = await import('drizzle-orm/mysql2');
  const { migrate } = await import('drizzle-orm/mysql2/migrator');
  const { MySqlDialect } = await import('drizzle-orm/mysql-core');

  const pool = createPool(url);
  const db = drizzle(pool);

  await migrate(db, { migrationsFolder: migrations });

  const dialect = new MySqlDialect();
  const schema = mysqlSchema;

  return {
    dialect: 'mysql',
    describe: `mysql ${redact(url)}`,
    insertStack: async (row) => {
      // MySQL has no `DO NOTHING`; assigning the key to itself is the portable no-op.
      await db
        .insert(schema.stackSample)
        .values(row)
        .onDuplicateKeyUpdate({ set: { id: sql`id` } });
    },
    insertPacks: async (rows) => {
      if (rows.length) {
        await db
          .insert(schema.packSample)
          .values(rows)
          .onDuplicateKeyUpdate({ set: { id: sql`id` } });
      }
    },
    insertHealth: async (row) => {
      await db.insert(schema.packHealth).values(row);
    },
    prune: async (before) => {
      let removed = 0;

      for (const table of ['stack_sample', 'pack_sample']) {
        const [result] = await pool.query(
          `DELETE FROM \`${table}\` WHERE at < ?`,
          [before],
        );

        removed += (result as { affectedRows?: number }).affectedRows ?? 0;
      }

      return removed;
    },
    rows: async <T>(query: SQL) => {
      const compiled = dialect.sqlToQuery(query);
      const [result] = await pool.query(compiled.sql, compiled.params);

      return result as T[];
    },
    close: async () => pool.end(),
  };
}

async function openPostgres(url: string, migrations: string): Promise<Store> {
  const pg = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const { migrate } = await import('drizzle-orm/node-postgres/migrator');
  const { PgDialect } = await import('drizzle-orm/pg-core');

  const pool = new pg.default.Pool({ connectionString: url });
  const db = drizzle(pool);

  await migrate(db, { migrationsFolder: migrations });

  const dialect = new PgDialect();
  const schema = pgSchema;

  return {
    dialect: 'postgres',
    describe: `postgres ${redact(url)}`,
    insertStack: async (row) => {
      await db.insert(schema.stackSample).values(row).onConflictDoNothing();
    },
    insertPacks: async (rows) => {
      if (rows.length) {
        await db.insert(schema.packSample).values(rows).onConflictDoNothing();
      }
    },
    insertHealth: async (row) => {
      await db.insert(schema.packHealth).values(row);
    },
    prune: async (before) => {
      let removed = 0;

      for (const table of ['stack_sample', 'pack_sample']) {
        const result = await pool.query(
          `DELETE FROM "${table}" WHERE at < $1`,
          [before],
        );

        removed += result.rowCount ?? 0;
      }

      return removed;
    },
    rows: async <T>(query: SQL) => {
      const compiled = dialect.sqlToQuery(query);
      const result = await pool.query(compiled.sql, compiled.params);

      return result.rows as T[];
    },
    close: async () => pool.end(),
  };
}

/** Credentials appear in a DSN and this string is served over the API. */
const redact = (url: string): string =>
  url.replace(/\/\/[^@/]*@/, '//***@').replace(/\?.*$/, '');
