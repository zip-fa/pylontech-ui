# syntax=docker/dockerfile:1

# One image, one process: the daemon owns the serial port, serves /api, and serves the built UI
# from the same origin. Splitting them would need two containers sharing one exclusive tty.
#
# Nothing is compiled here. CI installs the workspace, builds the UI and prunes to production
# dependencies on the runner, where the npm and Nx caches live; this file only assembles the
# result. `docker build` therefore expects `node_modules` and `apps/web/dist` to already exist —
# run `npm ci && npm run build --workspace web` first if you are building by hand.

FROM node:26-bookworm-slim

ENV NODE_ENV=production
ENV TZ=UTC
WORKDIR /app

# `SerialPort.list()` shells out to udevadm; without it the adapter cannot be discovered and the
# path would have to be hardcoded through SERIAL_PATH, which is exactly what discovery avoids.
# Reading a tty then needs group membership, not root — `dialout` is gid 20 on Debian.
RUN apt-get update \
  && apt-get install -y --no-install-recommends udev \
  && rm -rf /var/lib/apt/lists/* \
  && usermod -aG dialout node

# The only native dependency is serialport, and it ships prebuilt bindings for every platform
# inside the package, so one installed tree serves both amd64 and arm64.
COPY package.json ./
COPY node_modules node_modules

# The daemon runs its TypeScript directly — Node strips the types, so there is nothing to emit.
# Each package.json comes along because npm's workspace symlinks resolve through them.
COPY apps/daemon/package.json apps/daemon/
COPY apps/daemon/src apps/daemon/src
COPY libs/protocol/package.json libs/protocol/
COPY libs/protocol/src libs/protocol/src
COPY apps/web/package.json apps/web/
COPY apps/web/dist apps/web/dist

USER node

ENV PORT=4300
EXPOSE 4300

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4300)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--experimental-strip-types", "apps/daemon/src/main.ts"]
