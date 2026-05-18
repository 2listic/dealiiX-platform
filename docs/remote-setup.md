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

## Step 3 — copy your public key to the remote machine

```bash
scp ~/.ssh/id_ed25519.pub <remote-user>@<remote-host>:~/.ssh/<yourname>_id_ed25519.pub
```

Then on the remote machine, append it to the user's `authorized_keys`:

```bash
cat ~/.ssh/<yourname>_id_ed25519.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

## Step 4 — `Dockerfile.coral` on the remote machine

Make sure these lines are **uncommented** so the container's sshd starts correctly
and allows root login via key:

```dockerfile
RUN mkdir -p /run/sshd
RUN mkdir -p /root/.ssh && chmod 700 /root/.ssh
RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
  echo "PasswordAuthentication no" >> /etc/ssh/sshd_config
EXPOSE 6817 6818 8000 22
```

Leave the `--mount=type=secret` block commented — the key arrives via volume mount.

## Step 5 — `docker-compose.yml` on the remote machine

The `coral-ssh-slurm` service must have port 2222 mapped and the public key
mounted as `authorized_keys` inside the container:

```yaml
ports:
  - '2222:22'
volumes:
  - ./containers/shared-data:/app/shared-data
  - /home/<remote-user>/.ssh/<yourname>_id_ed25519.pub:/root/.ssh/authorized_keys:ro
```

The secrets sections must remain commented out.

## Step 6 — build and start the containers

```bash
docker compose up -d --build
```

## Step 7 — build CORAL inside the container

This takes several minutes the first time:

```bash
ssh -p 2222 root@localhost 'cd /app && cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build'
```

## Step 8 — open the SSH tunnel on your local machine

Keep this session open while using the app. Specifying the user explicitly overrides
any `User` rule you may have in `~/.ssh/config` for this host:

```bash
ssh -L 2222:localhost:2222 -L 8008:localhost:8008 <remote-user>@<remote-host>
```

## Step 9 — configure the Electron app

Open Settings → Execution Mode → Remote:

| Field | Value |
|-------|-------|
| Host | `localhost` |
| Port | `2222` |
| Username | `root` |
| SSH key path | `~/.ssh/id_ed25519` (your local private key) |
| Working directory | `/app/shared-data` |
| Coral binary path | `/app/build/core/coral` |
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
