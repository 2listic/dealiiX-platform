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

## Execution service protocol

`orchestrator --configuration backend.config.json exchange` reads one request
from stdin and writes one response to stdout. [Protocol 1.1](../../schemas/execution-service.schema.json)
validates both messages. For example:

```json
{ "version": "1.1", "operation": "describe" }
```

The response contains `version`, `operation` and either `result` or `error`.
`describe` returns the complete registry. `validate` and `submit` receive the
saved network plus the registry's `configuration_digest` and `registry_digest`.
Refresh and validate again on `stale_configuration` or `stale_registry`.
SHA-256 hashes the RFC 8785 representation of the configuration's current
values and of the registry definitions, including child registries. The
root header itself is outside the registry digest.

Settings files for the Python backend carry a `backend` header with
`"id": "orchestrator"` and put the [parameter tree](../../schemas/parameters.schema.json)
under `configuration`. See [the example profile](examples/backend.config.json)
and the [settings schema](../../schemas/backend-settings.schema.json).
The CLI also accepts existing profiles that contain just the parameter tree.
The configuration digest is an
opaque revision in the execution service.
`submit`, `status`, `cancel` and `replay` return run and node states. `status`,
`logs`, `outputs`, `cancel` and `replay` use the returned `run_id`. The wire status exposes
state and diagnostics while the CLI run record retains execution provenance.

Node states are keyed by qualified ID. A checked external input and a bound
Selection are already `succeeded` when a run enters the queue. Output files
follow their producer until the backend checks the actual files. A successful
stage with matching cached outputs reports `reused: true`. An absent optional
file has no terminal state. File diagnostics include the affected File node's
`qualified_id`, including when a required input fails before submission.

`migrate` opens a saved document or converts a legacy pipeline against
configured execution targets, returning the converted network and a summary.
`artifact` reads a listed output by run, qualified node ID and name in base64
chunks. The backend resolves file locations on the execution target.

## Configuration and documents

The CLI validates the full registry and saved graph, parameter trees and
effective CORAL graphs using the versioned schema identifiers in `schemas/`.
The [PR #263 snapshot](../../schemas/v1/) remains the baseline for older
files. The identities are `__backend` in a registry and `backend` in
a graph, with a logical `id` and optional `plugin`. The CLI checks an explicit
identity against the selected target when the target declares a plugin ID.

On top of that snapshot, this prototype implements the configuration example in
[#265](https://github.com/2listic/dealiiX-platform/issues/265). The registry carries
node defaults in `configuration` and each CORAL node's child registry in
`value.registry`. The Python profile specifies the implementations and launch
settings.
The root backend header and each node definition have a `capabilities` object.
Its `actions` list declares the operations a client can offer, such as
`configure` or `open_child_workflow`. The `configuration_exposable` flag tells
the client whether configuration parameters can be exposed as graph ports.
A placed CORAL node stores the child **graph** in `value`.
Placed nodes can set `configuration` using the same deal.II parameter leaf format
and override only the fields they need. Installation paths, SSH settings and the
scheduler reside in the root configuration. An executable's own parameter
document is saved in its instance's `configuration.parameters`.

An instance that permits exposure can connect scalar configuration ports.
The orchestrator copies the value into the effective target parameters before
launch. These connections do not introduce run-time scheduling dependencies.
An unconnected exposure uses the instance's own value.

**Selection** supplies a string to an exposed configuration input. Set
`options` to a pipe-separated list and choose a `choice`. The registry marks
the output with `configuration_path` and links the dropdown to the options
through `selection_options`. The backend checks the chosen value against the
source options and any declared destination choices before it starts the run.

The example configuration is also a template for additional targets. Each section
creates a node named `orchestrator::<section>` by default. Set `node_id`
to publish a stable scoped identifier such as `orchestrator::immersx::coral`
while retaining a separate profile section name. The names `local` and `remote`
for CORAL expand to `orchestrator::CoralLocal` and `orchestrator::CoralRemote`.
The default palette section is **Orchestrator**, with the ID's short name as
the tile label. Set `display_name` to label a target, `class_name` to publish
it under a class, or `palette_section` to choose a section explicitly. A profile
can contain direct local and SSH targets together. Set `palette_subsection`
on each target to group their tiles by host within the section or class.

| Setting                                | Meaning                                                                                                                                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runs_directory`                       | Absolute local directory for orchestration records.                                                                                                                                                 |
| `binary`, `working_directory`          | Absolute paths on the target.                                                                                                                                                                       |
| `node_id` | Optional registry identifier relative to `orchestrator::`. |
| `display_name`, `palette_section`, `class_name`, `overload_group`, `variant_name` | Registry labels for concrete entries, sections, classes and overload families. |
| `plugin`, `plugin_id`                  | CORAL plugin path and optional logical identity. Omit both for a standalone executable.                                                                                                             |
| `ssh`                                  | Optional section with `host`, `user`, `port`, `identity_file` and `known_hosts_file`. SSH uses the local OpenSSH configuration and verified host keys. Direct SSH requires `python3` on the target. |
| `scheduler`                            | `none` for direct execution (default) or `slurm` for batch execution.                                                                                                                               |
| `mpi_launcher`                         | Command name or absolute path. Defaults to `mpirun -np` or `srun --ntasks` under Slurm. Set the node's `mpi_enabled` and `mpi_processes` to use it.                                                 |
| `mpi_mode`                             | `backend` (default) launches the stage through MPI. `application` is for CORAL plugins that delegate MPI to an application they call. |
| `parameter_template`, `parameter_file` | An optional full deal.II JSON template on the target and the generated filename (`.json` or `.prm`). The default is `parameters.json`. An empty filename disables file generation.                  |
| `argv`                                 | Optional argument list for a standalone executable, stored as parameter leaves with keys `"0"`, `"1"` and so on.                                                                                    |
| `environment`                          | Optional section of named environment values on the target, applied to the executable and its MPI launcher.                                                                                         |

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
With `mpi_mode=application`, the backend allocates the selected Slurm tasks
and runs CORAL once with its MPI support disabled. The application receives
`DEALIIX_MPI_ENABLED` (`true` or `false`), `DEALIIX_MPI_PROCESSES` (the selected
rank count, or `1` when disabled) and `DEALIIX_MPI_LAUNCHER` (the configured
command). It owns the MPI launch and interprets the launcher's options.
A workflow edge from port 0 (**Completed**) to port 0 (**After**) requires a
successful predecessor. Independent stages can run concurrently. When both
stages use the same Slurm connection, the orchestrator can submit them together
with `afterok` if the upstream stage has no declared outputs. A stage with
declared outputs must finish the orchestrator's file checks before its
dependents are submitted.

`pause RUN_ID` stops admission of new stages. Running stages finish,
including output checks. For pending Slurm jobs it uses `scontrol hold` and
waits for confirmation before reporting `scheduling.state: paused`. Jobs that
start before Slurm accepts the hold are treated as running and allowed to
finish. `resume RUN_ID` releases the orchestrator's holds with `scontrol release`
and continues the same workflow without rerunning completed stages. Slurm
retains the job ID and dependencies. Queue priority and projected start
time follow cluster policy. Cancellation remains available while paused.

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
CORAL subnetwork boundaries and automatic filesystem discovery are follow-up
work.

## Declared files

The palette includes **LocalFile** and **RemoteFile**. Add one to the root
workflow and edit `path`, `input_file`, `output_file`, `optional`, `location`
and `target`. Use a relative path such as `mesh/mesh.msh`. Connect a stage's
**Output files** port to the file's **Produced by** port. Connect the file's
**Read by** port to a stage's **Input files** port. A stage can accept several
files, and a file can have one producer and several consumers. Enable both
file roles for an intermediate file. Existing workflows saved with
`orchestrator::GenericFile` still load and run.

File configuration fields can be exposed as inputs and outputs. The
orchestrator resolves their connections before assigning files to stages.
An exposed `path` provides the configured relative path as a string.

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
- `workflowdir` uses the collection configured on the execution host.
  Published outputs follow the same exclusive-write rule as `workdir`.

| Placeholder | Resolved value |
| --- | --- |
| `{input:inputs/file.csv}` | The path of the connected input File with declared path `inputs/file.csv`. |
| `{input_dir:inputs/file.csv}` | The parent directory of that connected input. |
| `{output:solution.vtu}` | The fresh output path inside the current stage's run directory. |

Use these placeholders in executable arguments, parameter values or CORAL
string literals. The text after the colon matches the File node's declared
relative path, and the file must be wired to the stage. Consumers receive the
published path for a permanent output. A generated file can be shared directly
among stages on the same execution host. Use **Transfer** to copy it to a
different path or host.

Validation checks required external inputs and verifies that the producer and
consumer relationships are acyclic. Inputs with a producer are checked before
their consumers run. A missing optional file is allowed. A required output
must be created even if the program exits with code zero. If it is missing,
the stage fails and stages depending on it are cancelled.

The default stage policy `always` runs the program. Set `run_policy` to
`if_missing` to reuse a successful stage with permanent outputs. The required
outputs must be readable and their SHA-256 digests must match the run record.
The stage fingerprint includes declared input contents, effective parameters,
programs, arguments and target settings. Runs with `rundir` outputs execute
every time. A permanent output with no matching record is preserved and a
new publication to its path fails. Use a different path for a new result.

`replay` uses the saved execution plan and effective parameter documents from
a successful run. The original target and files must still be accessible.
Changed declared inputs or executable bytes fail the affected stage before it
starts. The original permanent-output policy applies. An `exclusive` stage
waits for other active stages in the workflow to finish and runs alone. The
status names that wait separately from graph dependencies.

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

## Contract review

The profile in [examples/immersx.config.json](examples/immersx.config.json)
publishes ImmersX as a scoped CORAL node. Local and remote variants can opt
into the same overload family when their declared interfaces are compatible.
Child registries remain scoped to the concrete variant.

Questions for the next protocol revision include the stability of native
CORAL signature keys between builds, typed capabilities for parameter widgets,
and named file ports. The current prototype uses deal.II parameter patterns,
port positions and explicit File nodes in a saved workflow. Status is polled
by run ID. CORAL subnetworks own their implementation graph and artifact paths
are interpreted by the backend.

### Workflow locations

In the Python profile, add a `workflow_locations` group. Each named entry
contains parameter leaves `directory` (absolute path), optional `label`,
`writable` (default `false`), and optional `target` (name of a configured
execution target whose SSH connection to reuse). With no target the directory
is on the orchestrator host. The directory must already exist. Collections
contain top-level regular JSON files up to 4 MiB. Writes use a content revision
and atomically publish a complete file within the collection.

Each execution target uses the sole collection on its host by default. If it
has multiple choices, set the target's `workflow_location` to one of their
IDs. A runtime reference to `{workflowdir}` requires an unambiguous collection
on the stage's host. The backend also expands `{workdir}` and `{rundir}` in
arguments, runtime parameters and nested CORAL string values. A parameter
source that must be read during validation can use `{workdir}` or
`{workflowdir}`. File nodes accept these names in `location`, or as a leading
placeholder in `path` such as `{workflowdir}/input.json`.
