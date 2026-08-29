import { existsSync } from 'node:fs';
import { join } from 'node:path';

import cors from 'cors';
import express from 'express';

import { config } from './config.ts';
import { ConsolePort } from './console-port.ts';
import { METRICS_CONTENT_TYPE, renderMetrics } from './metrics.ts';
import { Poller } from './poller.ts';

const consolePort = new ConsolePort(config.baudRate);
const poller = new Poller(consolePort);

const app = express();

app.use(cors());

app.get('/api/state', (_req, res) => res.json(poller.current));

app.get('/api/health', (_req, res) =>
  res.json({
    connected: consolePort.connected,
    port: consolePort.path,
    error: consolePort.lastError,
  }),
);

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

async function boot(): Promise<void> {
  try {
    await consolePort.open();
    console.log(`serial open on ${consolePort.path} @ ${config.baudRate}`);
  } catch (error) {
    console.error(`serial open failed: ${(error as Error).message}`);
  }

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
  process.exit(0);
});

void boot();
