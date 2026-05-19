# Remote setup guide

How to connect the DealiiX Electron app (running locally) to a real remote machine
that runs the CORAL + Slurm containers.

## Architecture

```
Local machine
  │
  ├─ SSH tunnel (as <remote-user>) ──→ <remote-host>:22  (native sshd)
  │   localhost:2222 maps                  │
  │   to container:22                      └─ container coral-ssh-slurm
  │                                             sshd on :22 (mapped to host :2222)
  │                                             Slurm (slurmctld + slurmd)
  │                                             CORAL binary at /app/build/core/coral
  │
  ├─ HTTP → localhost:8008 ──────→ coral-visualizer container
  └─ HTTP → localhost:8080 ──────→ coral-remote-server container (optional)
```

The tunnel runs as a regular user for safety — even if the SSH key is compromised,
access is limited to that user's privileges on the host. The Electron app SSHes
into the container as `root` through the tunnel, but that risk is contained inside Docker.

## Prerequisites

- Docker installed and your user in the `docker` group on the remote machine
- Your SSH public key in `/home/<remote-user>/.ssh/authorized_keys` on the remote machine (for the tunnel)
- Your SSH public key copied to `/home/<remote-user>/.ssh/<yourname>_id_ed25519.pub` on the remote machine (for the container)

## Step 1 — clone the repository on the remote machine

Generate a personal access token on GitHub (Settings → Developer settings → Personal access tokens)
with `repo` scope, then clone with it:

```bash
git clone --recursive https://<your-github-token>@github.com/2listic/dealiiX-platform.git
```

The `--recursive` flag is required to also fetch the `coral` and other submodules.
If you forgot it, run this afterwards:

```bash
git submodule update --init --recursive
```

## Step 2 — copy your public key to the remote machine

```bash
scp ~/.ssh/id_ed25519.pub <remote-user>@<remote-host>:~/.ssh/<yourname>_id_ed25519.pub
```

Then on the remote machine, append it to the user's `authorized_keys`:

```bash
cat ~/.ssh/<yourname>_id_ed25519.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

## Step 3 — create a `.env` file on the remote machine

The SSH public key path is machine-specific, so it is configured via a `.env`
file that is gitignored and must be created on each machine. Copy the provided
example and set the correct path:

```bash
cp .env.example .env
# then edit .env and set SSH_PUB_KEY_PATH to the actual path, e.g.:
# SSH_PUB_KEY_PATH=/home/<remote-user>/.ssh/<yourname>_id_ed25519.pub
```

## Step 4 — build and start the containers

```bash
docker compose up -d --build
```

## Step 5 — build CORAL inside the container

This takes several minutes the first time:

```bash
ssh -p 2222 root@localhost 'cd /app && cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build'
```

## Step 6 — open the SSH tunnel on your local machine

Keep this session open while using the app. Specifying the user explicitly overrides
any `User` rule you may have in `~/.ssh/config` for this host:

```bash
ssh -L 2222:localhost:2222 -L 8008:localhost:8008 -L 8080:localhost:8080 <remote-user>@<remote-host>
```

## Step 7 — configure the Electron app

Open Settings → Execution Mode → Remote:

| Field             | Value                                                   |
| ----------------- | ------------------------------------------------------- |
| Host              | `localhost`                                             |
| Port              | `2222`                                                  |
| Username          | `root`                                                  |
| SSH key path      | `~/.ssh/id_ed25519` (your local private key)            |
| Working directory | `/app/shared-data`                                      |
| Coral binary path | `/app/build/core/coral`                                 |
| Coral plugin path | `/app/build/backends/dealii/libcoral_backend_dealii.so` |

Click **Save & Sync Execution** to verify the connection.

## Verification checklist

```bash
# Tunnel is up and container SSH works
ssh -p 2222 root@localhost 'echo hello'

# Slurm is healthy inside the container
ssh -p 2222 root@localhost 'sinfo'

# CORAL binary exists
ssh -p 2222 root@localhost '/app/build/core/coral --help'

# Visualizer is reachable
curl http://localhost:8008
```
