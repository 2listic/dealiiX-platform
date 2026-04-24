# Run a Custom Executable Locally (no Docker, no SSH)

This approach uses the **local + executable** execution mode with any deal.II-based program that follows the DealiiX executable contract.

The contract is simple: when called with a JSON file path that **does not exist**, the binary writes a JSON template with all parameters and exits. When the file **exists**, it reads it and runs the simulation.

## Example: deal.II step-70 (Stokes immersed boundary)

The standard deal.II tutorial step-70 works out of the box as an executable backend.

### Get the source

```bash
mkdir -p coral/examples/step-70
curl -o coral/examples/step-70/step-70.cc \
  https://raw.githubusercontent.com/dealii/dealii/v9.5.0/examples/step-70/step-70.cc
```

Create `coral/examples/step-70/CMakeLists.txt`:

```cmake
cmake_minimum_required(VERSION 3.13.4)
project(step-70)
find_package(deal.II 9.5 REQUIRED
  HINTS ${deal.II_DIR} ${DEAL_II_DIR} $ENV{DEAL_II_DIR})
deal_ii_initialize_cached_variables()
add_executable(step-70 step-70.cc)
deal_ii_setup_target(step-70)
```

### Build

```bash
cd coral/examples/step-70
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j$(nproc)
```

### Manually verify the executable contract

```bash
cd coral/examples/step-70/build

# Probe: file does not exist → deal.II writes a JSON template and exits
./step-70 parameters.json
cat parameters.json   # valid JSON with all parameters and their defaults

# Run: file exists → reads it and runs the simulation
./step-70 parameters.json
```

### Configure the app

Open **Settings** and set the following under **Execution Mode**:

| Setting              | Value                                                             |
| -------------------- | ----------------------------------------------------------------- |
| Location             | `local`                                                           |
| Backend kind         | `executable`                                                      |
| Executable path      | `<repo>/coral/examples/step-70/build/step-70`                     |
| Working directory    | `<repo>/coral/examples/step-70/build` (or any writable directory) |
| Parameters file name | `parameters.json` (generated on first probe if absent)            |

Click **Save & Sync** — the app probes the binary, reads back the JSON template, and populates the Parameters panel with all step-70 parameters as an editable tree. Edit the values as needed, then click **Execute** to run the simulation.
