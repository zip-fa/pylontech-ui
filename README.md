# pylontech-ui

Live monitor for a Pylontech US5000 stack, read over the RS-232 console port.

A Node daemon owns the serial link — only one process may hold it — polls the console, and serves
both the JSON API and the React UI on one port. Nothing about the stack is configured: the serial
adapter, the pack addresses, the model, the cell count and the nameplate capacity are all discovered
from what the packs report.

## Development

```sh
npm install
npm run dev          # daemon on :4300, UI on :4200 proxying /api
```

Individually: `npm run daemon`, `npm run web`. Then `npm run lint`, `npm run format`,
`npm run build`.

## Container

One image, one process. The daemon serves the built UI from the same origin as the API, so there is
no second container and no CORS or host configuration.

The image compiles nothing: CI installs, builds and prunes on the runner, and the Dockerfile only
copies the finished tree — a bundled daemon, the built UI, and serialport. Building by hand means
doing the same three steps first.

```sh
npm ci
npm run build
npm ci --omit=dev --workspace daemon

docker build -t pylontech-ui .
docker run -d --name pylontech-ui \
  -p 4300:4300 \
  --device /dev/ttyUSB0 \
  -v /run/udev:/run/udev:ro \
  pylontech-ui
```

Open <http://localhost:4300>.

`--device` hands the adapter to the container; `/run/udev` lets `SerialPort.list()` read the device
database so the path is still discovered rather than pinned. If discovery cannot see the adapter,
set `SERIAL_PATH=/dev/ttyUSB0` to name it directly.

**The host must be Linux.** Docker Desktop on macOS and Windows runs containers inside a VM with no
USB passthrough, so a container there will start and serve the UI but never open the port. Run the
container on the machine physically wired to the stack — a Pi or a NUC — and develop on macOS with
`npm run dev`.

A `compose.yaml` is included for that deployment.

### Published image

```sh
docker run -d --name pylontech-ui \
  -p 4300:4300 --device /dev/ttyUSB0 -v /run/udev:/run/udev:ro \
  ghcr.io/zip-fa/pylontech-ui:latest
```

Images are built for `linux/amd64` and `linux/arm64` by `.github/workflows/docker.yml` on every push
to `main` and every `v*` tag.

### Environment

| Variable           | Default         | Meaning                                        |
| ------------------ | --------------- | ---------------------------------------------- |
| `PORT`             | `4300`          | HTTP port for the API and the UI               |
| `SERIAL_PATH`      | discovered      | Overrides adapter discovery                    |
| `BAUD_RATE`        | `115200`        | Console baud rate                              |
| `WEB_ROOT`         | `apps/web/dist` | Where the built UI is served from              |
| `PACK_ADDRESSES`   | discovered      | Pins a subset of pack addresses, for debugging |
| `POLL_PWR_MS`      | `5000`          | Live readings sweep                            |
| `POLL_CELLS_MS`    | `30000`         | Per-cell sweep                                 |
| `POLL_IDENTITY_MS` | `300000`        | Firmware and hardware sweep                    |
| `POLL_STAT_MS`     | `3600000`       | Lifetime and protection counters sweep         |

## API

| Route             | Returns                                                             |
| ----------------- | ------------------------------------------------------------------- |
| `GET /api/state`  | The whole snapshot: packs, cells, info, stats, `euro`, stack totals |
| `GET /api/health` | Link state only — answers even when the console is silent           |

## Measuring degradation

`euro` is the only command that reports a _measured_ remaining capacity in amp-hours. Unlike every
other command it takes no address: it describes only the pack whose console port holds the cable.
Reading another pack's true capacity means moving the cable to that pack.

`SOH` from `stat` is firmware-computed and some builds leave it at zero, and the charge-cycle
counter is derived from accumulated amp-hours rather than counted independently — so on its own it
restates lifetime throughput and says nothing about wear. The Degradation tab shows all three,
labelled for what each one is.
