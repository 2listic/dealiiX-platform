# Run a Custom Executable Remotely (SSH)

This approach uses the **remote + executable** execution mode to run any deal.II-based program that follows the DealiiX executable contract on a remote machine over SSH — without Coral as an intermediary.

## Prerequisites

Follow [run-coral-docker.md](run-coral-docker.md) to set up the SSH + Slurm containers and confirm the SSH connection works. You do not need Coral built inside the container for this mode — only the SSH server needs to be running.

## Set up the executable on the remote machine

`containers/shared-data/` is mounted into the container at `/app/shared-data/` (see `docker-compose.yml`), so copying files there locally makes them immediately visible inside the container.

Copy the step-70 source files from the repo into a `step-70` subfolder of the shared-data directory:

```bash
# From the repo root
cp local_runs/step-70/step-70.cc containers/shared-data/step-70/step-70.cc
cp local_runs/step-70/CMakeLists.txt containers/shared-data/step-70/CMakeLists.txt
```

Then build inside the container:

```bash
docker exec -it coral-ssh-slurm bash -c "
  cd /app/shared-data/step-70 &&
  cmake -B build -DCMAKE_BUILD_TYPE=Release &&
  cmake --build build -j\$(nproc)
"
```

## Configure the app

Open **Settings** and set the following under **Execution Mode**:

| Setting                 | Value                                     |
| ----------------------- | ----------------------------------------- |
| Location                | `remote`                                  |
| Backend kind            | `executable`                              |
| Host                    | `localhost`                               |
| Port                    | `2222`                                    |
| Username                | `root`                                    |
| Path to private SSH key | private key matching `docker-compose.yml` |
| Working directory       | `/app/shared-data`                        |
| Executable path         | `/app/shared-data/step-70/build/step-70`  |
| Parameters file name    | `parameters.json`                         |

Click **Save & Sync Execution** — the app probes the remote binary via SSH, reads back the JSON parameter template, and populates the Parameters panel as an editable tree.

For everything else — the dimension suffix convention, parameter editing, and the smoke test — follow [run-executable-local.md](run-executable-local.md). The only difference is that the executable and output files live on the remote machine under `/app/shared-data/`.
