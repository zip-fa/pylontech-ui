import { rm } from 'node:fs/promises';

import { build } from 'esbuild';

// esbuild writes into the directory rather than replacing it, so a renamed entry point would
// otherwise leave its predecessor behind for the image to ship.
await rm('dist', { recursive: true, force: true });

// express, cors, drizzle and the protocol library fold into one file. The database drivers do
// not: serialport resolves a native binding from disk at require time, and mysql2 and pg both
// require lazily by name. All three are imported only when something actually asks for them.
await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.mjs',
  bundle: true,
  platform: 'node',
  target: 'node26',
  format: 'esm',
  external: ['serialport', 'mysql2', 'mysql2/promise', 'pg'],
  // config.ts derives the web root and the migrations folder from import.meta.url; dist/ and
  // src/ sit at the same depth, so both relative paths hold either way.
  banner: {
    js: "import{createRequire as __cr}from'node:module';const require=__cr(import.meta.url);",
  },
  logLevel: 'info',
});
