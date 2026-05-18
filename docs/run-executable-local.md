# Run a Custom Executable Locally (no Docker, no SSH)

This approach uses the **local + executable** execution mode with any deal.II-based program that follows the DealiiX executable contract.

The contract is simple: when called with a JSON file path that **does not exist**, the binary writes a JSON template with all parameters and exits. When the file **exists**, it reads it and runs the simulation.

## Example: deal.II step-70 (Stokes immersed boundary)

The standard deal.II tutorial step-70 works out of the box as an executable backend.

### Get the source

The source files are already in the repo at `local_runs/step-70/`. No download needed.

### Build

```bash
cd local_runs/step-70
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j4
```

### Dimension suffix convention

step-70 (and DealiiX-compatible executables in general) pick up the spatial dimension from a numeric suffix on the parameters file name. For example:

| File name           | Dimension      |
| ------------------- | -------------- |
| `parameters.json`   | default (2D)   |
| `parameters2.json`  | 2D             |
| `parameters3.json`  | 3D             |
| `parameters23.json` | 2D in 3D space |

### Manually verify the executable contract

```bash
cd local_runs/step-70/build

# Probe: file does not exist → deal.II writes a JSON template and exits
./step-70 parameters.json
cat parameters.json   # valid JSON with all parameters and their defaults

# Run: file exists → reads it and runs the simulation
./step-70 parameters.json
```

### Configure the app

Open **Settings** and set the following under **Execution Mode**:

| Setting              | Value                                                         |
| -------------------- | ------------------------------------------------------------- |
| Location             | `local`                                                       |
| Backend kind         | `executable`                                                  |
| Working directory    | `<repo>/local_runs/step-70/build` (or any writable directory) |
| Executable path      | `<repo>/local_runs/step-70/build/step-70`                     |
| Parameters file name | `parameters.json` (generated on first probe if absent)        |

Click **Save & Sync** — the app probes the binary, reads back the JSON template, and populates the Parameters panel with all step-70 parameters as an editable tree. Edit the values as needed, then click **Execute** to run the simulation.

### Smoke test (fast 2D run)

For a quick end-to-end check that everything is wired up correctly, run in 2D with a minimal time step. After **Save & Sync** populates the Parameters panel:

1. Find **Number of time steps** in the Parameters panel and set it to `1`.
2. Click **Execute**. The simulation finishes in seconds rather than minutes.
