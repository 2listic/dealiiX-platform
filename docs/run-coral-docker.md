# Run Coral in Docker (Remote mode with Slurm + SSH)

This approach simulates a remote HPC cluster using Docker containers: one container runs Coral with a Slurm scheduler and an SSH server, another runs the Coral visualizer. Use this to test the **remote + coral** execution mode without real cluster access.

## Prerequisites

A public/private SSH key pair. The public key is baked into the container; the private key is selected in the app Settings.

## Build and start the containers

Adjust the path to your public SSH key in `docker-compose.yml`, then:

```bash
docker compose up -d
```

To rebuild images (e.g. after updating the `coral` submodule or changing `Dockerfile.coral`):

```bash
docker compose up -d --build
```

## Build Coral inside the container

Connect via SSH:

```bash
ssh -p 2222 root@localhost
```

Or open a shell directly:

```bash
docker exec -it coral-ssh-slurm bash
```

Then build:

```bash
cd /app
cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j4
```

## Configure the app

Open **Settings** and set the following:

**Execution Mode**

| Setting                 | Value                                                   |
| ----------------------- | ------------------------------------------------------- |
| Location                | `remote`                                                |
| Backend kind            | `coral`                                                 |
| Host                    | `localhost`                                             |
| Port                    | `2222`                                                  |
| Username                | `root`                                                  |
| Path to private SSH key | private key matching `docker-compose.yml`               |
| Working directory       | `/app/shared-data`                                      |
| Coral binary path       | `/app/build/core/coral`                                 |
| Coral plugin path       | `/app/build/backends/dealii/libcoral_backend_dealii.so` |

**VTK Visualizer & Editor**

| Setting | Value                   |
| ------- | ----------------------- |
| URL     | `http://localhost:8008` |

Click **Save & Sync Execution** to probe the SSH connection, load the node registry into the sidebar, and confirm everything works.

## Shared data folder

`containers/shared-data/` is mounted into both containers:

- `coral-ssh-slurm` at `/app/shared-data/`
- `coral-visualizer` at `/deploy/data/`

Graph files written by the app and output files (`.vtk`, Slurm logs) produced by CORAL are all accessible here. You can inspect them locally or from inside the container:

```bash
docker exec -it coral-ssh-slurm cat /app/shared-data/graph.json
```

## Manual testing

### Generate the node registry

```bash
cd /app
./build/core/coral --plugin ./build/backends/dealii/libcoral_backend_dealii.so register --registry-path shared-data/registry.json
```

### Run a graph directly

```bash
/app/build/core/coral --plugin /app/build/backends/dealii/libcoral_backend_dealii.so run /app/shared-data/graph.json --touch-dir node-execution-status
```

### Read a file from outside the container

```bash
ssh -p 2222 root@localhost 'cat /app/shared-data/slurm-1.out'
```

### Test Slurm

```bash
srun whoami
sbatch --wrap="echo Hello from \$(hostname)" --output=hello.out
```

### Test Slurm + Coral together

```bash
sbatch --wrap="/app/build/core/coral --plugin /app/build/backends/dealii/libcoral_backend_dealii.so run /app/shared-data/graph.json"
```

### Inspect a Slurm job (e.g. job id 2)

```bash
sacct -j 2 -n -X -p -o State,ExitCode,Start,End
```

| Flag | Meaning                            |
| ---- | ---------------------------------- |
| `-j` | job id                             |
| `-n` | no header                          |
| `-X` | exclude steps (top-level job only) |
| `-p` | pipe-delimited output              |
| `-o` | columns to display                 |

### Debug Slurm controller

```bash
slurmctld -Dvv
```
