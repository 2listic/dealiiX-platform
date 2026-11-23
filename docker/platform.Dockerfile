# check=skip=CopyIgnoredFile
# (The ignore file excludes everything, then lists what to keep; `COPY . .`
# copies exactly that, which this BuildKit check reports as an ignored copy.)

# dealiiX-platform served through noVNC: Electron runs under Xvfb and its display
# is viewed in a browser on port 6080.
# Build from the repository root: docker build -f docker/platform.Dockerfile .
# The build context is limited by platform.Dockerfile.dockerignore.

# ── Build stage: compile the Electron main process and the Svelte frontend ──
FROM node:22-bookworm AS build

# Same path as in the runtime stage, so the build tree is copied over unchanged.
WORKDIR /opt/dealiix-platform

# The sources, configs, examples and presets let through by the ignore file.
COPY . .

# Install the locked dependencies (Electron's own binary included) and build
# dist-electron/ and dist/. The build context has no git checkout, so the husky
# prepare hook is skipped.
RUN HUSKY=0 npm ci && npm run build

# ── Runtime stage: Electron on a virtual display, served through noVNC ──
FROM node:22-bookworm

# No interactive prompts from apt; Electron draws on display :99, the one Xvfb
# opens in the entrypoint; the app's store lives in the mounted user-data folder.
ENV DEBIAN_FRONTEND=noninteractive \
    DISPLAY=:99 \
    ELECTRON_USERDATA=/var/lib/dealiix-platform

# xvfb: virtual X display; x11vnc: exports it over VNC; novnc: browser VNC client;
# fluxbox: window manager, so the Electron window can be moved and resized.
# The lib* packages are the shared libraries Electron needs at run time.
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb x11vnc novnc fluxbox \
    libgtk-3-0 libnss3 libgbm1 libasound2 libxss1 libxtst6 \
    libxshmfence1 libdrm2 libnotify4 libsecret-1-0 \
    && rm -rf /var/lib/apt/lists/*

# noVNC's start page redirects to its client, connected and scaled to the window.
RUN printf '%s\n' '<!doctype html>' \
      '<meta http-equiv="refresh" content="0; url=/vnc.html?autoconnect=1&resize=scale">' \
      > /usr/share/novnc/index.html

# The user-data folder, for when nothing is mounted there.
RUN mkdir -p /var/lib/dealiix-platform

# The built app. Electron is a devDependency, so node_modules is kept whole.
COPY --from=build /opt/dealiix-platform /opt/dealiix-platform

# The script that starts the display, the VNC servers and the app.
COPY --chmod=755 docker/platform-entrypoint.sh /usr/local/bin/platform-entrypoint.sh

# noVNC's web port.
EXPOSE 6080

ENTRYPOINT ["/usr/local/bin/platform-entrypoint.sh"]
