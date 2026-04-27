# Installation

### Cloning the repository

When cloning for the first time use `--recursive` flag to get also the Coral submodule  
`git clone --recursive git@github.com:2listic/dealiiX-platform.git`

Or if you already cloned the repo, use  
`git submodule update --init --recursive`

### Install all the dependencies

`npm install`

# Development

`npm run dev` to compile the Electron TypeScript, build the front-end, and run the Electron app in development mode. You'll need to restart to see changes.

### Build or run the front-end only

- `npm run build` to compile the Electron TypeScript and build the front-end
- `npm run build:electron` to compile only the Electron TypeScript (outputs to `dist-electron/`)
- `npm run dev:vite` to run only the front-end with hot-reload

### Run the Electron app

- `npm start` to run the electron app (run `npm run build` first), or
- `npm start:forge` then just use `rs` to [restart](https://www.electronforge.io/cli#start).

## Linting and Formatting

### Linting

Eslint is used for linting. Run the following to lint  
`npm run lint` and `npm run lint:fix` to auto-fix.

### Formatting

Prettier is used for formatting. Run the following to format the code or use your IDE  
`npm run format`

### Automatic checks with Husky

[Husky](https://typicode.github.io/husky/) runs automatic checks at commit time ([.husky/pre-commit](.husky/pre-commit)): ESLint and `check:electron` (Electron TypeScript type check) abort the commit on errors; Prettier then auto-formats (a new commit is needed to include those last changes).

## TypeScript

### Renderer (Frontend UI - Svelte)

In the renderer part (`src/`) the TypeScript code is transpiled to JavaScript and bundled into the `dist/` folder by Vite. Typechecking is done with `svelte-check`.

### Electron (Backend Main Process and Preload)

The Electron main process (`electron/`) is directly typechecked and compiled with `tsc`.

Two configs exist because the main process and the preload need different JavaScript module formats: **[tsconfig.electron.json](tsconfig.electron.json)** and **[tsconfig.electron.preload.json](tsconfig.electron.preload.json)**.

Run `npm run build:electron` to compile into `dist-electron/`, or use `npm run check:electron` for a type-check-only pass without emitting files.

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

Available keys are defined in [electron/utils/storage.ts](electron/utils/storage.ts).

## Debugging Svelte

- Execute `npm run dev` and open the Source tab in the Chormium dev tools (**CTRL+SHIFT+I**). Then manually add the folder containing this repository from the Workspace sub-tab. Now add your breakpoints and start debugging.
- In Svelte code you can also use [`{@debug}`](https://svelte.dev/docs/svelte/@debug) or [`$inspect`](https://svelte.dev/docs/svelte/$inspect).

## Execution modes

The app supports four execution modes. See the dedicated guide for each:

| Mode                    | Description                                                                   | Guide                                                          |
| ----------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Remote + Coral**      | Docker containers with Slurm and SSH, simulating a remote HPC cluster         | [docs/run-coral-docker.md](docs/run-coral-docker.md)           |
| **Local + Coral**       | Coral binary running directly on your machine, no Docker or SSH               | [docs/run-coral-local.md](docs/run-coral-local.md)             |
| **Local + Executable**  | Any deal.II executable following the DealiiX executable contract, run locally | [docs/run-executable-local.md](docs/run-executable-local.md)   |
| **Remote + Executable** | Any deal.II executable run on a remote machine over SSH                       | [docs/run-executable-remote.md](docs/run-executable-remote.md) |

# Packaging

Compile Electron Typescript + build the frontend with `npm run build` and then run the following commands to package the app.

### Linux (Debian / Ubuntu)

```bash
npm run make:deb    # package into a .deb distributable
```

#### Install

Double-click the `.deb` file to open it in the App Center, or install from the terminal:

```bash
sudo dpkg -i out/make/deb/x64/dealiix-platform_<version>_amd64.deb
```

#### Uninstall

```bash
sudo apt remove dealiix-platform
```

### MacOS

Only works on macOS systems  
`npm run make:dmg`

# CI/CD

### GitHub Actions

The GitHub Actions workflows are defined in the [.github/workflows](.github/workflows) directory:

- **[ci.yml](.github/workflows/ci.yml)**: runs on every push and pull request to `main` — Svelte type check (`npm run check`), Electron type check (`npm run check:electron`), and unit tests (`npm run test`), either failing blocks the merge.
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
