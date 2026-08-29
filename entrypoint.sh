#!/bin/sh
# The image cannot know who owns /data. On most installs it is a bind mount, so the ownership is
# the host's and the chown baked into the image never applies: the daemon runs as `node` against
# a directory it cannot write, and history is disabled with "unable to open database file".
#
# So adopt the directory's owner rather than imposing one. The recorded history stays owned by
# the account the operator already uses — on Unraid that is nobody:users, and the files stay
# readable over the share — and nothing of theirs is chowned. PUID/PGID override it.
set -e

# An explicit --user means the operator has already chosen; there is nothing to adopt, and no
# privilege left to drop.
if [ "$(id -u)" != 0 ]; then
  exec "$@"
fi

uid=${PUID:-$(stat -c %u /data)}
gid=${PGID:-$(stat -c %g /data)}

# A root-owned /data is the one case with no owner worth adopting: running the daemon as root to
# get past a permission problem is not a fix. Hand the directory to `node` instead.
if [ "$uid" = 0 ]; then
  uid=$(id -u node)
  gid=$(id -g node)
  chown "$uid:$gid" /data
fi

# Supplementary groups are what grant the tty: `dialout` from the image, plus whatever
# --group-add named for a device the host groups differently. Dropping to a bare uid loses both.
extra=$(id -G | tr ' ' '\n' | grep -vx 0 | tr '\n' ',')
dialout=$(getent group dialout | cut -d: -f3)

exec setpriv --reuid="$uid" --regid="$gid" --groups="${extra}${dialout}" "$@"
