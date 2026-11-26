# Python orchestrator

The orchestrator runs CORAL workflows and standalone programs as nodes in one
workflow. Configure each installation or program as a separate target to use
multiple CORAL plugins or machines. The same graph can mix local processes,
direct SSH and Slurm.

## Run from a checkout

Use Python 3.10 or later on macOS or Linux. Copy the example configuration and
replace the CORAL paths with those of your installation. The example runs a small
CORAL graph and then invokes `wc` with a generated parameter file.

```bash
python3 -m venv .ai/orchestrator-venv
source .ai/orchestrator-venv/bin/activate
python -m pip install -r tools/orchestrator/requirements.txt

cp tools/orchestrator/examples/backend.config.json backend.config.json
orchestrator="$PWD/tools/orchestrator/orchestrator"
network="$PWD/tools/orchestrator/examples/network.json"
"$orchestrator" --configuration backend.config.json register
"$orchestrator" --configuration backend.config.json validate "$network"
"$orchestrator" --configuration backend.config.json run "$network" --touch-dir status
```

`register` writes `node_types.json` in the current directory, or to
`--registry-path`. Each CORAL entry includes the registry returned by that
target's installed plugin. `validate` discovers the current registry and checks
the graph, resources and effective input files. CORAL performs its own graph
construction and argument checks when it runs.

`run` waits for completion. `submit` accepts the same arguments and returns a
`run_id` immediately after validation, materialization and worker startup. Use
that ID with `status`, `logs`, `outputs` and `cancel`. `logs` also accepts a
qualified node ID to select one stage. Commands return JSON on stdout except
`register`, which writes the registry file. Errors exit nonzero and emit
`{"error":{"code":"…","message":"…"}}` on stderr. Failed synchronous runs include
the ID in the error for subsequent inspection.

## Configuration and documents

The CLI uses the [PR #263 schema snapshot](../../schemas/v1/) to validate the
registry and graph structures, the parameter trees and the effective CORAL
graphs. The optional identities are `__backend` in a registry and `backend` in
a graph, with a logical `id` and optional `plugin`. The CLI checks an explicit
identity against the selected target when the target declares a plugin ID.

On top of that snapshot, this prototype implements the configuration example in
[#265](https://github.com/2listic/dealiiX-platform/issues/265). The registry carries
the root parameter tree in `__backend.configuration`, node defaults in
`configuration` and each CORAL node's child registry in `value.registry`.
The root backend header and each node definition have a `capabilities` object.
Its `actions` list declares the operations a client can offer, such as
`configure` or `open_child_workflow`. The `configuration_exposable` flag tells
the client whether configuration parameters can be exposed as graph ports.
A placed CORAL node stores the child **graph** in `value`.
Placed nodes can set `configuration` using the same deal.II parameter leaf format
and override only the fields they need. Installation paths, SSH settings and the
scheduler reside in the root configuration. An executable's own parameter
document is saved in its instance's `configuration.parameters`.

The example configuration is also a template for additional targets. Each section
creates a node named `orchestrator::<section>`. The names `local` and `remote`
for CORAL expand to `orchestrator::CoralLocal` and `orchestrator::CoralRemote`.

| Setting                                | Meaning                                                                                                                                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runs_directory`                       | Absolute local directory for orchestration records.                                                                                                                                                 |
| `binary`, `working_directory`          | Absolute paths on the target.                                                                                                                                                                       |
| `plugin`, `plugin_id`                  | CORAL plugin path and optional logical identity. Omit both for a standalone executable.                                                                                                             |
| `ssh`                                  | Optional section with `host`, `user`, `port`, `identity_file` and `known_hosts_file`. SSH uses the local OpenSSH configuration and verified host keys. Direct SSH requires `python3` on the target. |
| `scheduler`                            | `none` for direct execution (default) or `slurm` for batch execution.                                                                                                                               |
| `mpi_launcher`                         | Command name or absolute path. Defaults to `mpirun -np` or `srun --ntasks` under Slurm. Set the node's `mpi_enabled` and `mpi_processes` to use it.                                                 |
| `parameter_template`, `parameter_file` | An optional full deal.II JSON template on the target and the generated filename (`.json` or `.prm`). The default is `parameters.json`. An empty filename disables file generation.                  |
| `argv`                                 | Optional argument list for a standalone executable, stored as parameter leaves with keys `"0"`, `"1"` and so on.                                                                                    |

For an invocation such as `solver --parameters parameters.json --working-directory /a/path`,
set the values of the four `argv` leaves to `--parameters`, `{parameters_file}`,
`--working-directory` and `/a/path` in that order. Use `{run_directory}` in place
of a fixed path to pass the stage's execution directory. Both placeholders
occupy a whole argument and resolve to absolute paths on the execution target.
Each leaf contributes one argument, including when its value contains spaces.

Omit `argv` to pass the generated filename as the sole argument. With an empty
`parameter_file`, omitting `argv` passes no arguments. Set `"argv": {}` to pass
no arguments while keeping parameter generation controlled by `parameter_file`.

A Slurm node also exposes the number of nodes, partition and wall-clock time.
A workflow edge from port 0 (**Completed**) to port 0 (**After**) requires a
successful predecessor. Independent stages can run concurrently. When both
stages use the same Slurm connection, the orchestrator can submit them together
with `afterok` if the upstream stage has no declared outputs. A stage with
declared outputs must finish the orchestrator's file checks before its
dependents are submitted.

Each run has a private orchestration record with the network, root configuration,
effective inputs, invocation and node states. Each stage gets its own execution
directory on the target, where it writes logs and outputs. The CLI mirrors CORAL
touch markers and emits its own stage markers. Standalone parameter files are
written from the node's effective tree. In saved CORAL graphs, marked parameter
files are copied from the target and simple JSON or PRM bindings are resolved
within each graph level. CORAL child graphs already materialized by another
client can be submitted directly.

The run-time messages are provisional. The detached worker survives the client
exiting. Slurm keeps jobs already submitted if the desktop shuts down, and the
prototype does not resume the worker after an OS restart. Bindings through
CORAL subnetwork boundaries, configuration exposure ports and automatic
filesystem discovery are follow-up work.

## Declared files

The palette includes **LocalFile** and **RemoteFile**. Add one to the root
workflow and edit `path`, `input_file`, `output_file`, `optional`, `location`
and `target`. Use a relative path such as `mesh/mesh.msh`. Connect a stage's
**Output files** port to the file's **Produced by** port. Connect the file's
**Read by** port to a stage's **Input files** port. A stage can accept several
files, and a file can have one producer and several consumers. Enable both
file roles for an intermediate file. Existing workflows saved with
`orchestrator::GenericFile` still load and run.

The `target` option selects a configured working directory and, for
**RemoteFile**, its SSH connection. `auto` uses the producing stage or an
unambiguous consuming stage or target. A **LocalFile** with no suitable
local stage or unique local target uses the `files` subdirectory of the
orchestrator's `runs_directory`. If multiple remote targets are plausible,
select one explicitly.

- `workdir` is permanent. An external input resolves relative to its selected
  or inferred working directory. A produced file is written inside the stage's
  run directory first, then published in the producer's working directory
  after the stage and its output checks succeed. Publishing preserves any
  existing file at that path.
- `rundir` is specific to the run. A producer is required, and all consumers
  use the file in that producer's run directory.

Use `{input:mesh/mesh.msh}` or `{output:solution.vtu}` in executable arguments,
parameter values or CORAL string literals to pass the resolved path to the
program. An output placeholder always resolves to the fresh file within that
stage's run directory. Consumers get the published path for a permanent file.
A generated file can be shared directly among stages on the same execution host.
Use **Transfer** to copy it to a different path or host.

Validation checks required external inputs and verifies that the producer and
consumer relationships are acyclic. Inputs with a producer are checked before
their consumers run. A missing optional file is allowed. A required output
must be created even if the program exits with code zero. If it is missing,
the stage fails and stages depending on it are cancelled.

The default stage policy `always` runs the program. Set `run_policy` to
`if_missing` to reuse a stage's outputs when it declares at least one required
output and every required output is a readable permanent file. A required
`rundir` output forces execution. The file check measures existence and
readability. Applications that need to distinguish inputs or parameter sets
can use distinct permanent paths.

## Transfer files

Connect **LocalFile** or **RemoteFile** to the **Source file** port of a
**Transfer** node. Connect the **Destination file** port to another
**LocalFile** or **RemoteFile**. For example, a Slurm stage can produce a
`RemoteFile` in its run directory, and a transfer can copy it to a
`LocalFile` in `workdir` for later use.

Copies on the same machine use `cp` when both endpoints are local or share
one SSH connection. Copies between local and remote use `scp`. Between
different SSH connections the orchestrator streams
directly from the source connection into the destination connection through
a pipe, without staging a local file. Each connection uses its configured
port, user, identity and verified host key. The stream passes through the
orchestrator, so the remote hosts need no SSH access to each other. Transfers
run independently of the scheduler used by the producing stage. A destination is checked and published like any other
stage output. The copy cannot replace an existing permanent file. Set the
transfer's `run_policy` to `if_missing` to reuse a valid permanent copy.

## Tests

Run the local CLI integration tests from the checkout.

```bash
python -m unittest discover -s tools/orchestrator -v
```
