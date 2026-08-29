import { existsSync } from 'node:fs';
import { join } from 'node:path';

import cors from 'cors';
import express, { type Router } from 'express';

import { config } from './config.ts';
import { ConsolePort } from './console-port.ts';
import { openStore, type Store } from './db/client.ts';
import { Recorder } from './history/recorder.ts';
import { historyRoutes } from './history/routes.ts';
import { METRICS_CONTENT_TYPE, renderMetrics } from './metrics.ts';
import { Poller } from './poller.ts';

const consolePort = new ConsolePort(config.baudRate);
const poller = new Poller(consolePort);

let store: Store | null = null;
let recorder: Recorder | null = null;
let history: Router | null = null;

const app = express();

app.use(cors());

app.get('/api/state', (_req, res) => res.json(poller.current));

app.get('/api/health', (_req, res) =>
  res.json({
    connected: consolePort.connected,
    port: consolePort.path,
    error: consolePort.lastError,
    history: store ? { storage: store.describe } : null,
  }),
);

/**
 * Mounted before storage is open, because the routes are registered at module scope and the
 * database is not. Until it opens — or if it never does — the page is told so rather than
 * being left to time out.
 */
app.use('/api/history', (req, res, next) => {
  if (!history) {
    res.status(503).json({ error: 'history storage is unavailable' });

    return;
  }

  history(req, res, next);
});

app.get('/metrics', (_req, res) => {
  // `res.send` reserialises the content type and reorders its parameters; scrapers read the
  // version parameter, so the header goes out verbatim.
  res.setHeader('content-type', METRICS_CONTENT_TYPE);
  res.end(renderMetrics(poller.current));
});

/**
 * In development Vite serves the page and proxies `/api` here. In a built image there is no Vite,
 * so the daemon serves the compiled bundle itself — same origin, one port, one process.
 */
const servesWeb = existsSync(join(config.webRoot, 'index.html'));

if (servesWeb) {
  app.use(express.static(config.webRoot));
  // Anything that is not an API call and not a real file is the single-page app.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) {
      return next();
    }

    res.sendFile(join(config.webRoot, 'index.html'));
  });
}

/** A database that will not open costs the history, never the live readings. */
async function openHistory(): Promise<void> {
  if (!config.historyEnabled) {
    return;
  }

  try {
    store = await openStore(config.databaseUrl, config.migrationsRoot);
  } catch (error) {
    console.error(`history disabled: ${(error as Error).message}`);

    return;
  }

  const options = {
    intervalMs: config.historyIntervalMs,
    retentionDays: config.historyRetentionDays,
  };

  recorder = new Recorder(store, {
    ...options,
    // Two missed polls still integrate; a longer silence is downtime and is left as a gap.
    maxGapMs: config.pollPwrMs * 3,
  });

  poller.on((event, snapshot) => {
    if (event === 'sample') {
      recorder?.observe(snapshot);
    } else {
      recorder?.observeHealth(snapshot);
    }
  });

  recorder.start();
  history = historyRoutes(store, options);

  console.log(`history on ${store.describe}`);
}

async function boot(): Promise<void> {
  try {
    await consolePort.open();
    console.log(`serial open on ${consolePort.path} @ ${config.baudRate}`);
  } catch (error) {
    console.error(`serial open failed: ${(error as Error).message}`);
  }

  await openHistory();
  poller.start();
  app.listen(config.port, () =>
    console.log(
      servesWeb
        ? `ui and api on http://localhost:${config.port}`
        : `api on http://localhost:${config.port} (no built ui at ${config.webRoot})`,
    ),
  );
}

process.on('SIGINT', () => {
  poller.stop();
  consolePort.close();

  // The open bucket is worth one flush on the way out; a hung database is not worth hanging on.
  void Promise.race([
    (async () => {
      await recorder?.stop();
      await store?.close();
    })(),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]).finally(() => process.exit(0));
});

void boot();
