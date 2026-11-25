# Protocol v1

This snapshot specifies the document shapes used by CORAL and Platform at the
time of the freeze. coral-python reads the same flat registry and graph shapes, without nested
subnetworks. A new backend can use the schemas and fixtures as a
reference. Any future format will replace this snapshot without requiring
two active protocols.

| Schema                                                         | Document                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------- |
| [registry.schema.json](registry.schema.json)                   | Flat node registry, keyed by type                         |
| [network.schema.json](network.schema.json)                     | Graph saved by the editor                                 |
| [network-execution.schema.json](network-execution.schema.json) | Graph Platform submits after resolving parameter bindings |
| [parameters.schema.json](parameters.schema.json)               | Full deal.II-style JSON parameter tree                    |
| [common.schema.json](common.schema.json)                       | Shared schema definitions                                 |

## Register a backend

Platform uses its configured backend command for **Validate & Sync** in
CORAL mode. The command runs in the target's working directory, locally or
over SSH.

```sh
cd "$working_directory"
"$backend_binary" -p "$plugin_setting" register
```

On success, the command exits with status zero and writes `node_types.json`
in that directory. Platform reads that file to build the node palette.
`plugin_setting` is the configured CLI argument. Its interpretation belongs
to the backend.

## Registry and backend identity

CORAL's `register` command emits a flat registry. A node definition contains
`type`, `node_type`, `arguments`, `inputs` and `outputs`. The latter two map
port positions to argument indices, with `-1` in `outputs` denoting SELF. Metadata
such as `bases` and `overload_group` comes from the registry producer.

The sole new protocol field is a logical backend identity. The same shape is
used as `__backend` in the registry and `backend` at the top of a graph:

```json
{ "id": "coral", "plugin": "dealii" }
```

`id` identifies the backend. `plugin` identifies its plugin when relevant.
Both exclude installation paths. The header is optional because existing
CORAL and Platform emitters produce documents without it. The pinned CORAL
executable selects the plugin library from its CLI settings and does not
enforce this header. CORAL's top-level `plugin` object holds initialization
options and has a separate purpose.

Platform reads `id` and `plugin` from `__backend` and ignores any other key.
**Validate & Sync** reports a header whose `id` or `plugin` is not a logical
identifier, and does not use it. CORAL can also write its backend name as a
string under `__backend_name`; Platform keeps both keys out of the node
palette.

On save, export and submission, Platform writes the identity of the selected
location's synced registry and replaces the identity an imported graph carried.
No component compares identities yet: a graph built against an older registry
is not detected as stale, and a backend runs a submission whatever identity it
carries.

## Saved and submitted graphs

Use the saved-graph schema to validate files produced by **Download Graph**.
Use the execution-graph schema to validate the JSON that Platform supplies
as the graph argument to `run`.

A graph contains `workflow.nodes` and `workflow.edges` keyed by decimal IDs.
The wire uses numeric node IDs and port positions. A saved graph can also use
named editor handles for parameters exposed from a file. The editor resolves
them into effective run parameters and numeric edges before submitting. In the
submitted form, each node has a qualified identifier for status markers and
each edge has both numeric port positions. File exposure metadata is absent.
An elementary literal uses text on the CORAL wire. Omit its `value` when there
is no literal to pass. The saved form also accepts `value: null` for such a
literal, as coral-python's own graphs write it; the submitted form does not,
since CORAL rejects any non-text literal value, and coral-python accepts the
omitted `value` as well.

A CORAL subnetwork stores its workflow in `value`. A saved node can carry its
explicit interface through `arguments`, `inputs` and `outputs`. CORAL derives the
interface when no override is supplied. Registry membership, port index
bounds and type compatibility, uniqueness of qualified identifiers, and
acyclicity require semantic checks in addition to JSON Schema validation.

## Parameter files

The parameter schema describes sections and leaves of deal.II's full JSON
format. A leaf contains string values, defaults, documentation and pattern
metadata. Platform strips its editor-only `__extra` marks before writing a
parameter file.

## Examples and validation

Load the schema files together in a Draft 2020-12 validator. Use their
declared `$id` values so that references to sibling schemas resolve within
the same snapshot.

A small producer/consumer pair is shown in [registry.json](examples/registry.json)
and [network-execution.json](examples/network-execution.json). The actual
Platform fixtures under [examples/graphs](../examples/graphs) and
[examples/parameters](../examples/parameters) illustrate the saved form. The
v1 snapshot covers these existing formats and the identity header. Child
registries, execution capabilities, configurable executable nodes, and
changes to port representation remain design work.
