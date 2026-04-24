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
cmake --build build -j$(nproc)
```

### Dimension suffix convention

step-70 (and DealiiX-compatible executables in general) pick up the spatial dimension from a numeric suffix on the parameters file name. For example:

| File name          | Dimension    |
| ------------------ | ------------ |
| `parameters.json`  | default (3D) |
| `parameters2.json` | 2D           |
| `parameters3.json` | 3D           |

### Manually verify the executable contract

```bash
cd local_runs/step-70/build

# Probe: file does not exist → deal.II writes a JSON template and exits
./step-70 parameters2.json
cat parameters2.json   # valid JSON with all parameters and their defaults

# Run: file exists → reads it and runs the simulation
./step-70 parameters2.json
```

### Configure the app

Open **Settings** and set the following under **Execution Mode**:

| Setting              | Value                                                         |
| -------------------- | ------------------------------------------------------------- |
| Location             | `local`                                                       |
| Backend kind         | `executable`                                                  |
| Executable path      | `<repo>/local_runs/step-70/build/step-70`                     |
| Working directory    | `<repo>/local_runs/step-70/build` (or any writable directory) |
| Parameters file name | `parameters2.json` (generated on first probe if absent)       |

Click **Save & Sync** — the app probes the binary, reads back the JSON template, and populates the Parameters panel with all step-70 parameters as an editable tree. Edit the values as needed, then click **Execute** to run the simulation.

### Smoke test (fast 2D run)

For a quick end-to-end check that everything is wired up correctly, use the 2D mode with a coarser solid mesh. The settings in `test_files/template_parameters_step-70-2dim-1ref.json` are a ready-made starting point — the key difference from the defaults is `Initial solid refinement: 1` (default is `5`), which dramatically reduces the mesh size and runtime.

1. Set **Parameters file name** to `parameters2.json`.
2. After **Save & Sync**, load `test_files/template_parameters_step-70-2dim-1ref.json` from the Parameters panel (or copy its values manually — the notable one is `Initial solid refinement → 1`).
3. Click **Execute**. The simulation finishes in seconds rather than minutes.
