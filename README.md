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

### Automatic linting and formatting on commit

[Husky](https://typicode.github.io/husky/) is used to run linting and formatting at commit time.  
If something is not correct with Eslint, the commit will be aborted. Then Prettier will format the code but a new commit will be needed to include the formatting changes. This gives more control over the modifications made during the commit process.  
Automatic scripts executed prior commit are defined in [.husky/pre-commit](.husky/pre-commit).

## Debugging

### Debugging Electron

#### Using Chrome

1. Run the app with `npm start:debug`
2. Open Chrome, go to `chrome://inspect` and select to inspect the launched Electron app
3. A new window will open, add breakpoints in the Sources tab and start debugging

For more options see the [general instructions](https://www.electronjs.org/docs/latest/tutorial/debugging-main-process) or the [specific ones](https://www.electronjs.org/docs/latest/tutorial/debugging-vscode) for VS Code

### Debugging Svelte

- Execute `npm run dev` and open the Source tab in the Chormium dev tools (**CTRL+SHIFT+I**). Then manually add the folder containing this repository from the Workspace sub-tab. Now add your breakpoints and start debugging.
- In Svelte code you can also use [`{@debug}`](https://svelte.dev/docs/svelte/@debug) or [`$inspect`](https://svelte.dev/docs/svelte/$inspect).

## Set up Docker containers to test SSH communication to Coral with Slurm jobs + Coral visualizer for .vtk output files

### Build and run the containers

Adjust your path to your public SSH key in the `docker-compose.yml` file (it has to match the private SSH key you will select in the front-end app from the Settings area), then build and start in detached mode

`docker compose up -d`

### Build Coral in the running container

Connect to via SSH client  
`ssh -p 2222 root@localhost`

Or open a shell in the container (restarting the container if needed)

`docker exec -it coral-ssh-slurm bash`

Build the Coral backend in the container  
`cd /app && mkdir build && cd build && cmake .. && make`

#### Test Slurm in the same container

Test Slurm from the runninig container  
`srun whoami`  
or  
`sbatch --wrap="echo Hello from \$(hostname)" --output=hello.out`

Test Slurm and Coral from the running container  
`sbatch --wrap="/app/build/dealii_backend.g /shared-data/graph.json --output=sbatch.out`

Test the state of a specific job id (i.e id 1) with sacct  
`sacct -j 2 -n -X -p -o State,ExitCode,Start,End`  
`-j` job id  
`-n` no header  
`-X` exclude steps (only top-level job)  
`-p` pipe delimited output  
`-o <list>` columns to display

### Debugging Slurm

`slurmctld -Dvv` to run the slurm controller in the forground and debug mode

### Other usefull Docker commands

Stop the containers

`docker compose stop`

Restart

`docker compose restart`

# Packaging

Build the frontend with `npm run build` and then run the following commands to package the app.

### Linux

`npm run make:deb`

### MacOS

Only works on macOS systems  
`npm run make:dmg`

# CI/CD

### GitHub Actions

The GitHub Actions workflows are defined in the [.github/workflows](.github/workflows) directory.

### Pull request template

A pull request template is defined at [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md).

# License

Coral svg free icon by [SVG Repo](https://www.svgrepo.com/svg/170626/coral) with color modifications.
