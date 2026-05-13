#!/bin/bash
set -e

# If HOST_UID and HOST_GID are provided, remap the workspace user
if [ -n "$HOST_UID" ] && [ -n "$HOST_GID" ]; then
  # Create a group with the host GID
  if ! getent group "$HOST_GID" > /dev/null 2>&1; then
    groupadd -g "$HOST_GID" shannon-host
  fi

  # Create a user with the host UID
  if ! id -u "$HOST_UID" > /dev/null 2>&1; then
    useradd -u "$HOST_UID" -g "$HOST_GID" -m -s /bin/bash shannon-user
  fi

  # Ensure workspace directory exists and is writable
  chown -R "$HOST_UID:$HOST_GID" /workspace

  # Run the worker as the host user
  exec su-exec "$HOST_UID:$HOST_GID" node /app/dist/worker.js
else
  # Run as default (root)
  exec node /app/dist/worker.js
fi
