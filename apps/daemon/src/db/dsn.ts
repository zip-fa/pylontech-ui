export type Dialect = 'sqlite' | 'mysql' | 'postgres';

export interface Dsn {
  dialect: Dialect;
  /** For sqlite, the file path. For the servers, the URL handed to the driver unchanged. */
  target: string;
}

/**
 * One env var picks the engine. Anything without a recognised scheme is a sqlite path, so
 * `DATABASE_URL=/data/pylontech.db` and the bare default both land on the same branch.
 */
export function parseDsn(value: string): Dsn {
  const url = value.trim();

  if (/^mysql:\/\//i.test(url)) {
    return { dialect: 'mysql', target: url };
  }

  if (/^postgres(ql)?:\/\//i.test(url)) {
    return { dialect: 'postgres', target: url };
  }

  return {
    dialect: 'sqlite',
    target: url.replace(/^(file|sqlite):(\/\/)?/i, ''),
  };
}
