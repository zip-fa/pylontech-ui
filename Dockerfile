# syntax=docker/dockerfile:1

# One image, one process: the daemon owns the serial port, serves /api, and serves the built UI
# from the same origin. Splitting them would need two containers sharing one exclusive tty.
#
# Nothing is compiled here. CI installs, builds and prunes on the runner, where the npm and Nx
# caches live; this file only assembles the result. Building by hand means running the same three
# steps first — see the README.

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

# The daemon is one bundled file. serialport stays outside it — its native binding is resolved
# from disk at require time — and is the only reason node_modules is here at all. That binding
# ships prebuilt for every platform inside the package, so one tree serves amd64 and arm64.
COPY node_modules node_modules
COPY apps/daemon/dist apps/daemon/dist
COPY apps/daemon/migrations apps/daemon/migrations
COPY apps/web/dist apps/web/dist

# History lands in /data. Mount a volume there to keep it across upgrades; without one it is
# still recorded, just discarded with the container.
RUN mkdir -p /data && chown node:node /data
VOLUME /data

# The container starts as root only long enough to work out who should own the history, then
# drops for good. See entrypoint.sh — a bind-mounted /data belongs to the host, not the image.
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

ENV PORT=4300
EXPOSE 4300

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4300)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/daemon/dist/main.mjs"]
