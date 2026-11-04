# Run Coral with ImmersX in Docker (Remote mode with Slurm + SSH)

This setup runs Coral with the [ImmersX](https://github.com/luca-heltai/immersx) plugin in prebuilt Docker images, with a Slurm scheduler and an SSH server, and connects the platform you run locally to it. ImmersX reads parameter files through its "Initialize parameters" node, so use this setup to run graphs with parameter-file nodes end to end.

The images come from the `dealiix-tutorial` branch of ImmersX, used for the dealiiX tutorial. That branch also runs the platform in the browser through noVNC; here only the Coral and visualizer containers are used, and the platform runs from this repository. The full tutorial stack is described in ImmersX's [docs/dealiix-tutorial-docker.md](https://github.com/luca-heltai/immersx/blob/dealiix-tutorial/docs/dealiix-tutorial-docker.md).

## Prerequisites

A clone of ImmersX on the `dealiix-tutorial` branch:

```bash
git clone -b dealiix-tutorial https://github.com/luca-heltai/immersx.git
cd immersx
./scripts/tutorial-init.sh
```

`tutorial-init.sh` creates the SSH key pair in `docker/tutorial-ssh/` and the `docker/shared-data/` folder. The images are prebuilt for Linux AMD64 and ARM64, so nothing is compiled.

## Free the container names

This repository's [docker-compose.yml](../docker-compose.yml) and the ImmersX one both define `coral-ssh-slurm` (port `2222`) and `coral-visualizer` (port `8008`). Before starting the ImmersX containers, stop this repository's two and rename its `coral-ssh-slurm`, which holds the Coral build made inside it:

```bash
docker stop coral-ssh-slurm coral-visualizer
docker rename coral-ssh-slurm coral-ssh-slurm-platform
docker rm coral-visualizer
```

`coral-remote-server` exists only in this repository's compose file and can keep running.

## Start the containers

From the ImmersX folder:

```bash
docker compose pull coral-ssh-slurm coral-visualizer
docker compose up -d coral-ssh-slurm coral-visualizer
docker exec coral-ssh-slurm sinfo
```

Wait until `sinfo` shows the node as `idle`.

## Configure the app

Open **Settings** and set the following:

**Execution Mode**

| Setting                 | Value                                                                          |
| ----------------------- | ------------------------------------------------------------------------------ |
| Location                | `remote`                                                                       |
| Backend kind            | `coral`                                                                        |
| Host                    | `localhost`                                                                    |
| Port                    | `2222`                                                                         |
| Username                | `root`                                                                         |
| Path to private SSH key | `<immersx>/docker/tutorial-ssh/id_ed25519`                                     |
| Working directory       | `/app/shared-data`                                                             |
| Coral binary path       | `/usr/local/bin/coral-release`                                                 |
| Coral plugin path       | `/opt/dealiix/immersx/Release/lib/immersx/coral/libcoral_backend_immersx_2.so` |

The `_2` plugin is the 2D one. To see the other plugins, including the Debug builds (`/usr/local/bin/coral-debug` with the `_debug` plugins under `/opt/dealiix/immersx/Debug/`):

```bash
docker exec coral-ssh-slurm ls /opt/dealiix/immersx/Release/lib/immersx/coral/
```

**VTK Visualizer & Editor**

| Setting | Value                   |
| ------- | ----------------------- |
| URL     | `http://localhost:8008` |

Click **Save & Sync Execution** to probe the SSH connection and load the ImmersX nodes into the sidebar.

## Shared data folder

`<immersx>/docker/shared-data/` is mounted into both containers:

- `coral-ssh-slurm` at `/app/shared-data/`
- `coral-visualizer` at `/deploy/data/`

Parameter files referenced by a graph go here, and each run gets its own folder inside it.

## Try a graph with a parameter file

1. Copy the example parameter file into the shared folder: `cp coral/examples/poisson_2d.prm docker/shared-data/` (from the ImmersX folder).
2. In the platform, import `<immersx>/coral/examples/poisson_2d.json`.
3. On the `poisson_2d.prm` string node, click **Use as parameter file**, expose an entry (e.g. `Domain / Initial refinement`) as an input, and connect a string literal to it.
4. Run. The run folder in `docker/shared-data/` holds a copy of `poisson_2d.prm` with the connected value, and `poisson_2d_used.prm`, which ImmersX writes next to the file it read. The source `poisson_2d.prm` is unchanged.

### Ready-made graphs

Two graphs in this repository's [examples/graphs/](../examples/graphs/) are already marked and connected. Copy their parameter files into `<immersx>/docker/shared-data/` first, then import them with **Import Graph**:

| Graph                                                                                                                 | Parameter files                                                                                   | What it shows                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [immersx-poisson-2d-parameter-file.json](../examples/graphs/immersx-poisson-2d-parameter-file.json)                   | `<immersx>/coral/examples/poisson_2d.prm`                                                         | A literal bound to `Initial refinement`                                                                                                                           |
| [immersx-poisson-2d-chained-parameter-files.json](../examples/graphs/immersx-poisson-2d-chained-parameter-files.json) | `poisson_2d.prm`, and [examples/parameters/refinement.prm](../examples/parameters/refinement.prm) | `refinement.prm` exposes `Mesh / Initial refinement` as an output, which feeds `poisson_2d.prm`'s `Initial refinement`; the run copy of `poisson_2d.prm` gets `4` |

The other ImmersX examples are in `<immersx>/coral/examples/`, each with its parameter file.

## Troubleshooting

### `sbatch: error: Unable to contact slurm controller`

On a cold start the Slurm controller can start before its database daemon is ready and exit (`/var/log/slurm/slurmctld.log` ends with `fatal: ... no TRES`). Start it again and wait for the node to be `idle`:

```bash
docker exec coral-ssh-slurm service slurmctld start
docker exec coral-ssh-slurm sinfo
```

For other Slurm checks (pending jobs, `sacct`), see [run-coral-docker.md](run-coral-docker.md#manual-testing).

## Stop and restore this repository's containers

From the ImmersX folder:

```bash
docker compose down
```

Then give the names back and start this repository's containers again:

```bash
docker rename coral-ssh-slurm-platform coral-ssh-slurm
docker compose up -d   # from this repository's root
```
