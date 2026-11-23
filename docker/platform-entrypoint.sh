#!/bin/bash
# Starts dealiiX-platform under Xvfb and serves its display through noVNC on port 6080.

# Stop on any error, unset variable or failed pipe stage.
set -euo pipefail

# Settings preset read by the app at startup: the one given to the container, or
# else the settings of the dealii-X tutorial stack.
export DEALIIX_SETTINGS_PRESET="${DEALIIX_SETTINGS_PRESET:-/opt/dealiix-platform/docker/presets/immersx-tutorial-release.json}"

# The app's store folder (ELECTRON_USERDATA, set in the image), created when not mounted.
mkdir -p "$ELECTRON_USERDATA"

# Virtual X display :99 (the image's DISPLAY), 1600x1000, with GLX for Electron's rendering.
Xvfb :99 -screen 0 1600x1000x24 -ac +extension GLX +render -noreset >/tmp/Xvfb.log 2>&1 &

# Window manager on that display, so the app window can be moved and resized.
fluxbox >/tmp/fluxbox.log 2>&1 &

# VNC server exporting display :99 on port 5900, kept up across viewer disconnects,
# shared by several viewers, with no password (the port is not published).
x11vnc -display :99 -forever -shared -rfbport 5900 -nopw -quiet >/tmp/x11vnc.log 2>&1 &

# noVNC: serves the browser client on port 6080 and relays it to the VNC server.
/usr/share/novnc/utils/novnc_proxy --vnc localhost:5900 --listen 6080 >/tmp/novnc.log 2>&1 &

# Run the app as the container's main process, so it receives docker stop's signal.
# --no-sandbox: Chromium's sandbox cannot run as root in a container.
cd /opt/dealiix-platform
exec node_modules/.bin/electron --no-sandbox .
