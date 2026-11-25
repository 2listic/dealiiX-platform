# Run Coral with ImmersX on the dealii-X tutorial stack

The [dealii-X tutorial stack](https://github.com/dealii-X/dealii-X/blob/main/doc/tutorial-containers.md) runs prebuilt images, for Linux AMD64 and ARM64:

| Service            | Image                              | What it runs                                                                                                                                    |
| ------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `coral-ssh-slurm`  | `ghcr.io/dealii-x/dealii-x`        | Slurm and an SSH server, on the [ImmersX](https://github.com/luca-heltai/immersx) image: Coral, the ImmersX plugins and Coral's deal.II backend |
| `coral-visualizer` | `ghcr.io/2listic/coral-visualizer` | the VTK visualizer                                                                                                                              |
| `dealiix-platform` | `ghcr.io/2listic/dealiix-platform` | this platform, in the browser through noVNC                                                                                                     |

ImmersX reads parameter files through its "Initialize parameters" node, so use this stack to run graphs with parameter-file nodes end to end. Use it with the platform in the browser, or with the desktop app run from this repository. To test changes to Coral from the `coral/` submodule, use [this repository's stack](run-coral-docker.md) instead, which builds Coral inside its container.

## Prerequisites

A clone of dealii-X, initialized once:

```bash
git clone https://github.com/dealii-X/dealii-X.git
cd dealii-X
./scripts/tutorial-init.sh
```

`tutorial-init.sh` creates the SSH key pair in `.dealiix-tutorial/ssh/` and the `.dealiix-tutorial/shared-data/` folder. The commands below run from the dealii-X folder.

## The platform in the browser

```bash
docker compose pull
docker compose up -d --no-build
```

Open <http://localhost:6080>. The platform image starts with the stack's settings, so **Save & Sync Execution** works without editing Settings, and the examples are in `/opt/dealiix/immersx/coral/examples`. The full description, including release versions, is in dealii-X's [doc/tutorial-containers.md](https://github.com/dealii-X/dealii-X/blob/main/doc/tutorial-containers.md).

## The desktop app on the stack's backend

Start only the backend and the visualizer:

```bash
docker compose pull coral-ssh-slurm coral-visualizer
docker compose up -d --no-build coral-ssh-slurm coral-visualizer
docker compose ps
```

Wait until `docker compose ps` shows `coral-ssh-slurm` as `healthy`. Its SSH server is on host port `2222` and the visualizer on `8008`, the same defaults as this repository's stack. To run both stacks at once, give one of them other ports: `CORAL_SSH_PORT` and `VISUALIZER_PORT` in a `.env` file next to its compose file (see [run-coral-docker.md](run-coral-docker.md#build-and-start-the-containers)).

From this repository, start the app with the [tutorial-stack preset](../docker/presets/immersx-desktop.json):

```bash
DEALIIX_SETTINGS_PRESET=docker/presets/immersx-desktop.json npm run dev
```

The preset fills in everything below except the SSH key path; settings you already changed keep your values. Open **Settings** and set:

**Execution Mode**

| Setting                 | Value                                                          |
| ----------------------- | -------------------------------------------------------------- |
| Location                | `remote`                                                       |
| Backend kind            | `coral`                                                        |
| Host                    | `localhost`                                                    |
| Port                    | `2222`                                                         |
| Username                | `root`                                                         |
| Path to private SSH key | `<dealii-X>/.dealiix-tutorial/ssh/id_ed25519`                  |
| Working directory       | `/app/shared-data`                                             |
| Coral binary path       | `/usr/local/bin/coral-release`                                 |
| Coral plugin path       | `/opt/immersx/lib/immersx/coral/libcoral_backend_immersx_2.so` |

**VTK Visualizer & Editor**

| Setting | Value                   |
| ------- | ----------------------- |
| URL     | `http://localhost:8008` |

Click **Save & Sync Execution** to probe the SSH connection and load the ImmersX nodes into the sidebar.

### Other plugins

The `_2` plugin is the 2D one. The backend has more, each loaded on its own through **Coral plugin path**:

| Plugin                  | Coral binary path              | Coral plugin path                                                          |
| ----------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| ImmersX 1D, 3D          | `/usr/local/bin/coral-release` | `/opt/immersx/lib/immersx/coral/libcoral_backend_immersx_1.so`, `_3.so`    |
| ImmersX 2D, Debug       | `/usr/local/bin/coral-debug`   | `/opt/immersx-debug/lib/immersx/coral/libcoral_backend_immersx_2_debug.so` |
| Coral's deal.II backend | `/usr/local/bin/coral-release` | `/opt/dealiix/coral/Release/lib/Release/libcoral_backend_dealii.so`        |

To list them:

```bash
docker compose exec coral-ssh-slurm ls /opt/immersx/lib/immersx/coral/ /opt/immersx-debug/lib/immersx/coral/ /opt/dealiix/coral/Release/lib/Release/
```

## Shared data folder

`<dealii-X>/.dealiix-tutorial/shared-data/` is mounted into both containers:

- `coral-ssh-slurm` at `/app/shared-data/`
- `coral-visualizer` at `/deploy/data/`

Parameter files referenced by a graph go here, and each run gets its own folder inside it.

## Try a graph with a parameter file

1. Copy ImmersX's Poisson example from the image into the shared folder:

   ```bash
   docker compose exec coral-ssh-slurm cp /opt/immersx/share/immersx/coral/examples/poisson_2d.json /opt/immersx/share/immersx/coral/examples/poisson_2d.prm /app/shared-data/
   ```

2. In the platform, load `poisson_2d.json` with **Import Remote Graph**.
3. On the `poisson_2d.prm` string node, click **Use as parameter file**, expose an entry (e.g. `Domain / Initial refinement`) as an input, and connect a string literal to it.
4. Run. The run folder in `.dealiix-tutorial/shared-data/` holds a copy of `poisson_2d.prm` with the connected value, and `poisson_2d_used.prm`, which ImmersX writes next to the file it read. The source `poisson_2d.prm` is unchanged.

Instead of copying the parameter file, **Use as parameter file** can upload a local copy of `poisson_2d.prm` into the shared folder when it is not there yet. See [Parameter files in runs](parameter-files-in-runs.md#a-missing-file).

The other ImmersX examples are in `/opt/immersx/share/immersx/coral/examples/` in the backend, each with its parameter file; files ending in `.in` are templates and do not run as they are.

### Ready-made graphs

Two graphs in this repository's [examples/graphs/](../examples/graphs/) are already marked and connected. Put their parameter files into `<dealii-X>/.dealiix-tutorial/shared-data/` first (`poisson_2d.prm` as in step 1 above, `refinement.prm` copied from this repository), then import them with **Import Graph**:

| Graph                                                                                                                 | Parameter files                                                                                   | What it shows                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [immersx-poisson-2d-parameter-file.json](../examples/graphs/immersx-poisson-2d-parameter-file.json)                   | `poisson_2d.prm`                                                                                  | A literal bound to `Initial refinement`                                                                                                                           |
| [immersx-poisson-2d-chained-parameter-files.json](../examples/graphs/immersx-poisson-2d-chained-parameter-files.json) | `poisson_2d.prm`, and [examples/parameters/refinement.prm](../examples/parameters/refinement.prm) | `refinement.prm` exposes `Mesh / Initial refinement` as an output, which feeds `poisson_2d.prm`'s `Initial refinement`; the run copy of `poisson_2d.prm` gets `4` |

## Other versions of the images

Each image is selected by a variable, `main` by default:

| Service            | Variable               | Published tags                             |
| ------------------ | ---------------------- | ------------------------------------------ |
| `coral-ssh-slurm`  | `DEALIIX_TAG`          | `main`, `vX.Y.Z`, `latest`                 |
| (its ImmersX base) | `IMMERSX_TAG`          | `main`, `vX.Y.Z`, `latest`, `sha-<commit>` |
| `coral-visualizer` | `CORAL_VISUALIZER_TAG` | `main`, `vX.Y.Z`, `latest`, `sha-<commit>` |
| `dealiix-platform` | `DEALIIX_PLATFORM_TAG` | `main`, `vX.Y.Z`, `latest`                 |

`sha-<commit>` exists for commits on the default branch. Set the variables in the dealii-X `.env` file, or in front of each `docker compose` command, and keep the same values for every command.

Branches and pull requests are not published: build their images locally under a `local` tag, then select it.

- **Platform**, from this repository: `docker build -f docker/platform.Dockerfile -t ghcr.io/2listic/dealiix-platform:local .`, then `DEALIIX_PLATFORM_TAG=local`.
- **Visualizer**, from a coral-visualizer clone: `docker build -t ghcr.io/2listic/coral-visualizer:local .`, then `CORAL_VISUALIZER_TAG=local`.
- **ImmersX**, from an ImmersX clone: `docker build -t ghcr.io/luca-heltai/immersx:local .`, then, in dealii-X, rebuild the backend on it:

  ```bash
  IMMERSX_TAG=local DEALIIX_TAG=local docker compose build coral-ssh-slurm
  IMMERSX_TAG=local DEALIIX_TAG=local docker compose up -d --no-build
  ```

- **Coral**, from a Coral clone with its submodules: `docker build -t ghcr.io/2listic/coral:local .`, then build ImmersX on it with `docker build --build-arg CORAL_IMAGE=ghcr.io/2listic/coral:local -t ghcr.io/luca-heltai/immersx:local .` and continue as for ImmersX.

With a `local` tag, leave out `--pull` on `docker compose build` and do not `docker compose pull` the services you built: both look for the image on GHCR, where `local` does not exist. To pull the others, name them, e.g. `docker compose pull coral-visualizer`.

## Stop the stack

From the dealii-X folder:

```bash
docker compose down
```

The files in `.dealiix-tutorial/` stay for the next start.
