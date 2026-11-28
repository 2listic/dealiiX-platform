# Protocol schemas

JSON Schemas (draft 2020-12) for the documents the editor and a backend exchange. Use the root schemas for protocol 1.1 and [the v1 snapshot](v1/) for the previous format.

| Schema                                                                         | Document                                                                 |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| [common.schema.json](common.schema.json)                                       | Definitions the other schemas share                                      |
| [parameters.schema.json](parameters.schema.json)                               | A parameter tree: a backend's configuration, or a node's `configuration` |
| [registry.schema.json](registry.schema.json)                                   | The node definitions a backend offers                                    |
| [network.schema.json](network.schema.json)                                     | A workflow as the editor saves it                                        |
| [network-execution.schema.json](network-execution.schema.json)                 | A workflow as a backend validates and runs it                            |
| [execution-service.schema.json](execution-service.schema.json)                 | Requests, results and diagnostics for the workflow service               |
| [backend-settings.schema.json](backend-settings.schema.json)                   | A portable backend profile with its target identity                      |
| [desktop/frontend-settings.schema.json](desktop/frontend-settings.schema.json) | Local desktop preferences                                                |

[examples/](examples) holds a registry of executables with file inputs and outputs, a network built against it, and a stored CORAL network node. The [JavaScript mock](../test_files/protocol-mock) exercises the examples and every execution-service operation in CI.

## Execution service

The desktop starts a backend with `--configuration PROFILE exchange`. Each
invocation reads a versioned request from stdin and writes a single JSON
response to stdout. The response contains either a result or a structured
diagnostic. An optional `qualified_id` ties an error to a node in a graph.

`describe` advertises the supported operations and the configuration and
registry revisions. `validate` and `submit` require both revisions.
`configure` is optional and requires the configuration revision.
`migrate` returns a saved workflow and a summary of changes.

`submit` returns a run ID. Use that ID to read `status`, `logs`, `outputs`
and chunks of an `artifact`, or to `cancel`, `pause` or `resume` the run.
`replay` starts a new run from the recorded workflow. Pause and resume keep
the same run ID; scheduling state and its revision are separate from stage states.

## Responsibilities

- **Backend:** owns its configuration, discovery, invocation, MPI, scheduling and file placement. It publishes a registry, validates a workflow against its current registry and configuration, runs it, and writes a status file per node.
- **Registry:** describes node types, ports, parameter defaults, editor capabilities, palette sections and scoped child registries.
- **Network:** holds node instances with their values and configuration, and edges between ports.
- **Editor:** builds a network from the registry, checks graph structure and port compatibility, and sends the saved form to the root workflow service.

## Parameters

A tree of sections whose leaves are deal.II entries in full JSON form: `value`, `default_value`, `documentation`, `pattern` and `pattern_description` (all strings), and optionally `actions`. `__extra` marks an entry the user added in the editor; it is removed when the file is written. deal.II alias entries and its compressed `Short` JSON form are outside this tree.

When a leaf declares `selection_options`, its dropdown uses the pipe-separated text in the named sibling leaf.

## Registry

A flat object keyed by `type`; a library of stored network nodes is keyed by `name`. `inputs` and `outputs` hold indices into `arguments`, one per port, and an output of `-1` is the node itself. `node_type` is a rendering hint only. Literal defaults in `value` are strings. A stored subnetwork definition has a workflow in `value`, or `{}` for the generic `coral::Network` entry. A backend node such as `orchestrator::immersx::coral` publishes its child registry in `value.registry`. The parent backend discovers it with the configured CORAL plugin. The child definitions stay scoped to that node and the editor uses them when opening its workflow. A placed node's `value` contains its editable workflow, so saved and submitted networks do not duplicate registry definitions.

Keys starting with `__` carry metadata:

- `__backend`: the backend's `id`, `version` and `plugins`, the `operations` it supports (`register`, `validate`, `run`, and `migrate` when it can upgrade an older network), and `registry_digest`. The digest is the SHA-256 of the RFC 8785 canonical registry definitions, excluding `__` metadata, written `sha256:<hex>`. The Python backend publishes the private profile revision as an opaque `configuration_digest`.
- `__backend_name`: the name CORAL writes when its registry header is switched on.

A definition may also carry:

- `configuration`: a parameter tree that is the template of each instance's own `configuration`.
- `x-dealiix` (draft):
  - `actions`: `open_child_workflow` (the editor can enter the node's workflow) and `configure` (the editor can edit its `configuration`).
  - `execution`: `kind` (`in_process`, `executable` or `child_workflow`), `target` (`local`, `remote` or `any`), `parallelism` (`mode` `serial` or `mpi`, with a fixed `processes` count or the input argument `processes_from` that holds it) and `run_policy` (`always` or `if_outputs_missing_or_inputs_changed`).
  - `files`: `inputs` and `outputs`, each naming an argument whose value is a file path (an output may name a `path` in the run directory instead), with its `media_type`, an optional `role`, and `required` or `must_exist_after_success`.

## Network

A workflow is `workflow.nodes` and `workflow.edges`, both keyed by decimal ids, with optional `version` (always 1), `author`, `date_time_utc`, `plugin` and `backend`.

- **Nodes.** `type` names a registry definition. A literal's `value` is its text, or `null` for a valueless literal. A node whose `node_type` is `network` carries a nested workflow in `value` and its own `arguments`, `inputs` and `outputs`; a `coral::Network` node always has `node_type` `network`. `configuration` is the instance's parameter tree. `qualified_id` is `<parent>_<child>` for nested nodes, and never contains `.`, `/` or `\`, since it names the node's status files. A node may repeat registry metadata such as `class_name`; CORAL then requires it to equal the registry's value.
- **Edges.** `source_output` is a position in the source's `outputs` and `target_input` a position in the target's `inputs`. In a saved network, a parameter port is connected by handle instead: `source_handle` is `parameter-output-` and `target_handle` is `parameter-input-`, each followed by the URI-encoded JSON array of the parameter's path. Each end uses exactly one of the two forms.
- **Execution form.** At every level, each node has a `qualified_id` and each edge uses both port positions. The saved form keeps typed parameter ports under `parameter_file` for file nodes and `configuration_exposures` for inline configurations. Materialization applies bound inputs to the run copy of the file or to the submitted `configuration`, turns used parameter outputs into literals, and drops both kinds of editor metadata.
- **`plugin`** is passed to the backend plugin unchanged. CORAL reads `MPI.enabled`; the deal.II plugin also reads `MPI.args` and `MPI.max_num_threads`.
- **`backend`** names the backend the network targets: `id`, and `version`, `plugins` or `registry_digest`. On save, export and submission, the editor writes the `__backend` header of the active location's registry, without `operations`. A nested workflow may carry its own header to name the backend that runs it, e.g. `{"id": "coral"}`.

## Validation

The schemas check structure and value types. The backend also checks, before running anything:

- every node type is in its registry, and every edge endpoint and port exists;
- every `qualified_id` is unique across all levels;
- the workflow has no cycle;
- the `backend` header matches it: the same `id`, and the current `registry_digest` when one is given, else the same `version`;
- its own configuration, e.g. the mock's `Mock` section.

It reports a failure as `{"error": {"code": "...", "message": "..."}}` on stderr with a nonzero exit status. A network whose `registry_digest` differs from the backend's current one fails with `stale_registry`; syncing the registry again in the editor writes the new header on the next save or submission.

The two current backends read the execution form as follows:

- **CORAL** ignores top-level keys other than `workflow` and `plugin`, requires both port positions on every edge, and generates a `qualified_id` for a node without one.
- **coral-python** requires a `qualified_id` on every node, accepts `null` for a valueless literal, and rejects nested workflows.
