import { rm } from 'node:fs/promises';

import { build } from 'esbuild';

// esbuild writes into the directory rather than replacing it, so a renamed entry point would
// otherwise leave its predecessor behind for the image to ship.
await rm('dist', { recursive: true, force: true });

// express, cors and the protocol library fold into one file; serialport cannot, because its
// native binding is resolved from disk at require time relative to the package directory.
await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.mjs',
  bundle: true,
  platform: 'node',
  target: 'node26',
  format: 'esm',
  external: ['serialport'],
  // config.ts derives the web root from import.meta.url; dist/ and src/ sit at the same depth,
  // so the relative path to apps/web/dist holds either way.
  banner: {
    js: "import{createRequire as __cr}from'node:module';const require=__cr(import.meta.url);",
  },
  logLevel: 'info',
});
