# Run Coral Locally (no Docker, no SSH)

This approach runs the **local + coral** execution mode directly on your machine without Docker, SSH, or Slurm.

## Install deal.II

```bash
sudo apt install libdeal.ii-dev
```

For a newer version of deal.II:

```bash
sudo add-apt-repository ppa:ginggs/deal.ii-9.7.1-backports
sudo apt update
sudo apt install libdeal.ii-dev
```

## Clone and build Coral

Follow the instructions at https://github.com/2listic/coral, then build:

```bash
cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j4
```

After the build you should have:

- `coral/build/core/coral` — the Coral CLI binary
- `coral/build/backends/dealii/libcoral_backend_dealii.so` — the deal.II plugin

## Configure the app

Open **Settings** and set the following under **Execution Mode**:

| Setting           | Value                                                           |
| ----------------- | --------------------------------------------------------------- |
| Location          | `local`                                                         |
| Backend kind      | `coral`                                                         |
| Working directory | `<repo>/local_runs/coral` (or any writable directory)           |
| Coral binary path | `<repo>/coral/build/core/coral`                                 |
| Coral plugin path | `<repo>/coral/build/backends/dealii/libcoral_backend_dealii.so` |

Click **Save & Sync** to probe the binary, load the node registry into the sidebar, and confirm everything works.

## Manual testing

### Generate the node registry

```bash
./coral/build/core/coral -p ./coral/build/backends/dealii/libcoral_backend_dealii.so register
```

### Run a graph

```bash
./coral/build/core/coral -p ./coral/build/backends/dealii/libcoral_backend_dealii.so run graph.json --touch-dir nodes-exec-status/1
```
