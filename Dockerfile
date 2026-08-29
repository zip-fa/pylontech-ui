# syntax=docker/dockerfile:1

# One image, one process: the daemon owns the serial port, serves /api, and serves the built UI
# from the same origin. Splitting them would need two containers sharing one exclusive tty.

# ---------------------------------------------------------------------------------------------
# deps — the full workspace install, cached on the lockfile alone
# ---------------------------------------------------------------------------------------------
FROM node:26-bookworm-slim AS deps
WORKDIR /app

# `npm ci` needs every workspace manifest present before it will resolve the workspace links.
COPY package.json package-lock.json ./
COPY apps/daemon/package.json apps/daemon/
COPY apps/web/package.json apps/web/
COPY libs/protocol/package.json libs/protocol/

RUN --mount=type=cache,target=/root/.npm npm ci

# ---------------------------------------------------------------------------------------------
# build — compile the UI to static files
# ---------------------------------------------------------------------------------------------
FROM deps AS build
COPY . .
# Straight npm, not nx: the image has no cache to warm and no daemon to keep alive.
RUN npm run build --workspace web

# ---------------------------------------------------------------------------------------------
# runtime — production dependencies, daemon sources, built UI
# ---------------------------------------------------------------------------------------------
FROM node:26-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# `SerialPort.list()` shells out to udevadm; without it the adapter cannot be discovered and the
# path would have to be hardcoded through SERIAL_PATH, which is exactly what discovery avoids.
RUN apt-get update \
  && apt-get install -y --no-install-recommends udev \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/daemon/package.json apps/daemon/
COPY apps/web/package.json apps/web/
COPY libs/protocol/package.json libs/protocol/

# The install is workspace-wide because npm resolves workspaces as one tree; the web app's
# runtime deps come along, which costs a few megabytes and buys a lockfile-exact install.
# serialport's postinstall fetches the prebuilt native binding for the image's architecture.
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# The daemon runs its TypeScript directly — Node strips the types, so there is nothing to emit.
COPY apps/daemon/src apps/daemon/src
COPY libs/protocol/src libs/protocol/src
COPY --from=build /app/apps/web/dist apps/web/dist

# Reading a tty needs group membership, not root. `dialout` is gid 20 on Debian; the runtime
# user is added to it so `--device=/dev/ttyUSB0` is enough on the host side.
RUN usermod -aG dialout node
USER node

ENV PORT=4300
EXPOSE 4300

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4300)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--experimental-strip-types", "apps/daemon/src/main.ts"]
