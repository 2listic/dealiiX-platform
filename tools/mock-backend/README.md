# Local CORAL mock

This executable implements the backend side of the [protocol schemas](../../schemas/README.md) behind the existing Local + CORAL settings. It registers two operations of its own, validates a workflow, runs it with CORAL-style status markers, and hands a child workflow to an installed CORAL.

## Try it

Run `npm run dev:mock` from the repository root after installing the app's npm dependencies. This opens **Local + CORAL** with the mock as the parent backend, the local deal.II plugin as a CORAL child, and one local executable in the parent palette. Run `npm run dev:mock -- --native-coral` to use the local CORAL build directly, or `npm run dev:mock -- --mock-only` to use the mock and its local executables without CORAL. The launcher uses separate Electron profiles under `.ai/mock-desktop/`.

On the first launch of each profile, click **Validate & Sync**. For the combined preset, import `network-local-demo.json` and run it with MPI disabled. It prints the mock greeting, runs a CORAL child, and writes `local-executable.txt` in the run directory.

To add an executable, edit the profile's generated `parameters.json` and add an entry under `Executables`. Its `Binary`, optional `Label`, optional `Arguments`, and optional `InputTypes` use the parameter leaf format. Give an absolute executable path. Encode fixed arguments in `Arguments` as a JSON array of strings. Encode the types of the remaining arguments in `InputTypes` as a JSON array chosen from `std::string`, `int`, `double` and `bool`, then connect literal nodes to those inputs in the workflow. The mock registers the entry as `mock::exec::<id>` and passes fixed arguments followed by the connected values, in port order, to the executable in the run directory. A nonzero exit marks the node as failed.

For a command configured directly on the canvas, add an **executable** node and click **Configure node**. Set `executable` to an absolute executable path, a name on `PATH`, or an id under `Executables`. Set `command` to the full invocation template, for example:

```text
config.executable --arg1 config.arg1 arg2 ACTION arg3
```

`config.executable` selects the configured program. The template can also start with that program's configured name or path. A token such as `config.arg1` inserts the value of that field as a single argument, including any spaces. Literal arguments can use quotes. The command is launched directly in the run directory. An alias selects the program only, since the node template supplies its argument list. Import `network-configurable-executable.json` with the desktop preset to try this example with the `local-example` alias.

**Configure node** opens the same parameter editor as a parameter file. Its input and output switches add typed ports for the selected fields. A connected input overrides the saved value in the configuration sent to the run. An output exposes that effective parameter value, which is available before the executable runs.

Add `--prepare-only` to generate and print the settings preset without opening the app.

### Command line

From the repository root:

```sh
python3 -m venv .venv-mock
. .venv-mock/bin/activate
python -m pip install -r tools/mock-backend/requirements.txt

mock="$PWD/tools/mock-backend"
work="$(mktemp -d)"
cd "$work"
"$mock/mock-backend" -p "$mock/parameters.json" register
"$mock/mock-backend" -p "$mock/parameters.json" validate "$mock/network.json"
"$mock/mock-backend" -p "$mock/parameters.json" run "$mock/network.json" --touch-dir status
python "$mock/test_contract.py"
```

The registry is written to `node_types.json`. Validation prints `{"valid": true}`. Run prints `Hello World` and `4`, and writes status markers. Change the values under `Mock` in a copy of `parameters.json` to change the output; a `Greeting` in a `mock::hello` node's `configuration` overrides `Mock.Greeting` for that node.

To use the desktop app, choose **Local + CORAL**, set the binary path to the absolute path of `mock-backend`, the plugin path to the absolute path of `parameters.json`, and the working directory to a writable scratch directory. The mock can use the repository's `.venv-mock` even when the app's Python has no installed dependencies. Click **Validate & Sync**. The palette then includes **Say hello** and **Add integers**. Import `network.json` to inspect and execute the nested example with MPI disabled. The plugin path carries the mock configuration in this mode.

For a real CORAL child, copy `parameters.json` and add a `CORAL` section with `Binary` and `Plugin` leaves in the same format, set to the absolute paths of an installed CORAL binary and plugin. Set `CORAL.MPIEnabled` to `"true"` for an MPI-dependent plugin or workflow, as the combined desktop preset does for deal.II. This initializes MPI in the single CORAL child process. The child workflow can override the default with its own `plugin.MPI.enabled`. Sync with that copy and import `network-coral.json`. The mock puts CORAL's definitions in `value.registry` of the parent registry's **CORAL** node (`network::coral`). The child palette uses those definitions when you open the node. The mock hands the placed node's workflow to CORAL. The child's status files reach the run's status directory while CORAL runs.

## CLI

- `register [INITIALIZATION] --registry-path PATH` writes the registry with its `__backend` header. The header lists the operations `register`, `validate` and `run`, and the digest of the definitions.
- `validate NETWORK` checks a workflow in the execution form without running it.
- `run NETWORK [--register [PATH]] [--graph [PATH]] [--touch-dir [PATH]]` validates, then runs.
- `migrate NETWORK` fails with `unsupported_operation`.

Errors are a JSON object with a machine-readable code on stderr and a nonzero exit status. Native plugin initialization goes to CORAL when it is configured. The DOT output summarizes the outer workflow. SLog options, CORAL nodes at the mock's top level, migration and launching multiple MPI ranks are outside the mock.
