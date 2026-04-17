# Installation

### Cloning the repository

When cloning for the first time use `--recursive` flag to get also the Coral submodule  
`git clone --recursive git@github.com:2listic/coral.git`

Or if you already cloned the repo, use  
`git submodule update --init --recursive`

### Install all the dependencies

`npm install`

# Development

`npm run dev` to build the front-end and run the Electron app in development mode. You'll need to restart to see changes.

### Build or run the front-end only

- `npm run build` to build the front-end
- `npm run dev:vite` to run only the front-end with hot-reload

### Run the Electron app

- `npm start` to run the electron app (build front-end before), or
- `npm start:forge` then just use `rs` to [restart](https://www.electronforge.io/cli#start).

## Linting and Formatting

### Linting

Eslint is used for linting. Run the following to lint  
`npm run lint` and `npm run lint:fix` to auto-fix.

### Formatting

Prettier is used for formatting. Run the following to format the code or use your IDE  
`npm run format`

### Automatic checks with Husky

[Husky](https://typicode.github.io/husky/) runs automatic checks at commit time ([.husky/pre-commit](.husky/pre-commit)): ESLint aborts the commit on errors; Prettier then auto-formats (a new commit is needed to include those changes).

## Testing

Run unit tests
`npm run test`

## Debugging

### Debugging Electron

#### Using Chrome

1. Run the app with `npm run start:debug`
2. Open Chrome, go to `chrome://inspect` and select to inspect the launched Electron app
3. A new window will open, add breakpoints in the Sources tab and start debugging

For more options see the [general instructions](https://www.electronjs.org/docs/latest/tutorial/debugging-main-process) or the [specific ones](https://www.electronjs.org/docs/latest/tutorial/debugging-vscode) for VS Code

#### Inspecting the Electron Store

The app uses [electron-store](https://github.com/sindresorhus/electron-store) to persist data. You can inspect and modify it from the DevTools console (**CTRL+SHIFT+I**):

```js
// Get a value
await window.electron.store.get('jobIdMap')

// Remove a value
await window.electron.store.remove('jobIdMap')
```

Available keys are defined in [electron/utils/storage.js](electron/utils/storage.js).

## Debugging Svelte

- Execute `npm run dev` and open the Source tab in the Chormium dev tools (**CTRL+SHIFT+I**). Then manually add the folder containing this repository from the Workspace sub-tab. Now add your breakpoints and start debugging.
- In Svelte code you can also use [`{@debug}`](https://svelte.dev/docs/svelte/@debug) or [`$inspect`](https://svelte.dev/docs/svelte/$inspect).

## Run Coral from a container with Slurm and SSH server (simulating a remote cluster) and a separate container for the Coral visualizer

### Build and run the containers

Adjust your path to your public SSH key in the `docker-compose.yml` file (it has to match the private SSH key you will select in the front-end app from the Settings area), then build and start in detached mode

`docker compose up -d`

To rebuild images (e.g. after updating the `coral` submodule or changing the `Dockerfile.coral`):

`docker compose up -d --build`

In the main app window click on the settings button and set the default url for the Visualizer  
`http://localhost:8008/`

### Build Coral in the running container

Connect to via SSH client  
`ssh -p 2222 root@localhost`

Or open a shell in the container (restarting the container if needed)

`docker exec -it coral-ssh-slurm bash`

Build the Coral backend in the container

```bash
cd app
cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j$(nproc)
```

`-j$(nproc)` is optional but significantly speeds up the build.

#### Manually generate available nodes file registry.json

```bash
cd app
./build/core/coral --plugin ./build/backends/dealii/libcoral_backend_dealii.so register --registry-path shared-data/registry.json
```

#### Manually test the Coral backend

Manually execute the backend from the running container with path to the graph.json to execute and the path to the directory where the node execution status files will be written
`/app/build/core/coral --plugin /app/build/backends/dealii/libcoral_backend_dealii.so run /app/shared-data/graph.json --touch-dir node-execution-status`

Read a file located in shared-data from outside the container
`ssh -p 2222 root@localhost 'cat /app/shared-data/slurm-1.out'`

#### Manually test Slurm + Coral

Test Slurm from the runninig container  
`srun whoami`  
or  
`sbatch --wrap="echo Hello from \$(hostname)" --output=hello.out`

Test Slurm and Coral from the running container  
`sbatch --wrap="/app/build/core/coral --plugin /app/build/backends/dealii/libcoral_backend_dealii.so run /app/shared-data/graph.json"`

Test the state of a specific job id (i.e id 1) with sacct  
`sacct -j 2 -n -X -p -o State,ExitCode,Start,End`  
`-j` job id  
`-n` no header  
`-X` exclude steps (only top-level job)  
`-p` pipe delimited output  
`-o <list>` columns to display

#### Debugging Slurm

`slurmctld -Dvv` to run the slurm controller in the forground and debug mode

### Shared data folder

The `containers/shared-data/` local folder is mounted as a volume into the `coral-ssh-slurm` container at `/app/shared-data/` and into the `coral-visualizer` container at `/deploy/data/`. This means any file placed in the local folder is accessible inside the containers and vice versa.

In particular, when the app exports a `graph.json` for execution, it is written to this shared folder. You can inspect or replace it either:

- **Locally**: check `containers/shared-data/graph.json`
- **Inside the container**: `docker exec -it coral-ssh-slurm cat /app/shared-data/graph.json`

Output files (e.g., `.vtk` files, Slurm logs) produced by CORAL during execution are also written here and served by the `coral-visualizer` container.

## Run Coral locally with deal.II (no Docker, no SSH)

This approach lets you use the **local + coral** execution mode directly on your machine, without Docker, SSH, or Slurm.

### Install deal.II and build tools (Ubuntu)

```bash
sudo apt install libdeal.ii-dev
```

If you need newer version of deal.II, you can try a different repository. For example:

```bash
sudo add-apt-repository ppa:ginggs/deal.ii-9.7.1-backports
sudo apt update
sudo apt install libdeal.ii-dev
```

### Clone and build Coral repository

Follow instructions at https://github.com/2listic/coral

Build with something like:

```bash
cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j$(nproc)
```

`-j$(nproc)` tells cmake to run as many parallel compile jobs as you have CPU cores. It is optional but significantly speeds up the build.

After the build, you should have something like the following binaries:

- `coral/build/core/coral` — the Coral CLI binary
- `coral/build/backends/dealii/libcoral_backend_dealii.so` — the deal.II plugin

### Configure the app

Open Settings in the app and set the following under **Execution Mode**:

- **Location**: `local`
- **Backend kind**: `coral`
- **Coral binary path**: `<repo>/coral/build/core/coral`
- **Coral plugin path**: `<repo>/coral/build/backends/dealii/libcoral_backend_dealii.so`
- **Working directory**: `<repo>/coral/build` (or any writable directory)

Click **Save & Sync** to probe the binary, load the node registry into the sidebar, and confirm everything works.

### Manually test the local Coral binary

Generate the node registry:

```bash
./coral/build/core/coral -p ./coral/build/backends/dealii/libcoral_backend_dealii.so register
```

Run a graph:

```bash
./coral/build/core/coral -p ./coral/build/backends/dealii/libcoral_backend_dealii.so run graph.json --touch-dir nodes-exec-status/1
```

## Run a custom executable locally with deal.II (no Docker, no SSH)

This approach lets you use the **local + executable** execution mode with any deal.II-based program that follows the DealiiX executable contract.

### Example: deal.II step-70 (Stokes immersed boundary)

The standard deal.II tutorial step-70 (Stokes flow with an immersed rotating body) works out of the box as an executable backend.

#### Get the source

Download the example from the deal.II repository and place it in `coral/examples/step-70/`:

```bash
mkdir -p coral/examples/step-70
curl -o coral/examples/step-70/step-70.cc \
  https://raw.githubusercontent.com/dealii/dealii/v9.5.0/examples/step-70/step-70.cc
```

Then create `coral/examples/step-70/CMakeLists.txt` with the following content:

```cmake
cmake_minimum_required(VERSION 3.13.4)
project(step-70)
find_package(deal.II 9.5 REQUIRED
  HINTS ${deal.II_DIR} ${DEAL_II_DIR} $ENV{DEAL_II_DIR})
deal_ii_initialize_cached_variables()
add_executable(step-70 step-70.cc)
deal_ii_setup_target(step-70)
```

#### Build

```bash
cd coral/examples/step-70
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j$(nproc)
```

#### Manually test the executable contract

```bash
cd coral/examples/step-70/build

# Probe: file does not exist → deal.II writes JSON template and exits
./step-70 parameters.json
cat parameters.json   # valid JSON with all parameters and their defaults

# Run: file exists → reads it and runs the simulation
./step-70 parameters.json
```

#### Configure the app

Open Settings and set the following under **Execution Mode**:

- **Location**: `local`
- **Backend kind**: `executable`
- **Executable path**: `<repo>/coral/examples/step-70/build/step-70`
- **Working directory**: `<repo>/coral/examples/step-70/build`
- **Parameters file name**: `parameters.json`

Click **Save & Sync** — the app probes the binary, reads back the JSON template, and populates the Parameters panel with all step-70 parameters (viscosity, refinement levels, time steps, grid generators, etc.) as an editable tree. Edit the values as needed, then click Execute to run the simulation.

# Packaging

Build the frontend with `npm run build` and then run the following commands to package the app.

### Linux

`npm run make:deb`

### MacOS

Only works on macOS systems  
`npm run make:dmg`

# CI/CD

### GitHub Actions

The GitHub Actions workflows are defined in the [.github/workflows](.github/workflows) directory:

- **[ci.yml](.github/workflows/ci.yml)**: runs on every push and pull request to `main` — type checking (`npm run check`) and unit tests (`npm run test`), either failing blocks the merge.
- **[release-linux.yml](.github/workflows/release-linux.yml)** / **[release-macos.yml](.github/workflows/release-macos.yml)**: triggered on version tags (`v*`) or manually — runs the full check/test/build pipeline and uploads artifacts to the GitHub Release.

### Creating a Release

To create a new release by triggering the GitHub Actions workflows, tag the commit on `main` and push it:

```bash
git tag -a v1.0.0 -m "Release v1.0.0: brief description of changes"
git push origin v1.0.0
```

### Pull request template

A pull request template is defined at [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md).

# License

Coral svg free icon by [SVG Repo](https://www.svgrepo.com/svg/170626/coral) with color modifications.
