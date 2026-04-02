# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DealiiX Platform is an Electron + Svelte 5 desktop application for building and executing computational graphs. It provides a visual node-based editor (using @xyflow/svelte) that connects to a C++ backend called CORAL (Computational Object-oriented Representation And Library) for scientific computing workflows.

## Architecture

### Desktop Application (Electron + Svelte 5)

- `electron/main.js` - Electron main process, handles IPC for SSH connections, theme switching, external URLs
- `electron/preload.js` - Context bridge exposing `window.electron` API (send, on, invoke, getFilePath)
- `electron/utils/sshConnections.js` - SSH utilities using ssh2 library
- `src/` - Svelte 5 frontend with runes-based reactivity

### Submodules (separate repos)

- `coral/` - C++ computational graph library using deal.II, builds `dealii_backend.g` executable
- `coral-remote-server/` - Go REST API server for project management and authentication
- `coral-visualizer/` - Python Flask app for VTK file visualization

## Data Flow & Protocols

The application uses two JSON protocols to communicate with CORAL:

1. **Registry Protocol** (`RegisteredNodes` type) - Defines available node types with their arguments, inputs/outputs, and metadata. Loaded at startup and used to populate the sidebar.

2. **Network Protocol** (`Network` type) - Represents a computational graph with nodes and edges. Used for saving/loading projects and sending to CORAL for execution.

**Key conversion functions** in `src/lib/utils/graphParser.ts`:

- `nodesFromProtocolToFlow()` / `edgesFromProtocolToFlow()` - Convert CORAL network format → @xyflow format
- `parseGraphToProtocol()` - Convert @xyflow format → CORAL network format
- `parseGraphWithQualifiedIds()` - Same as above but adds hierarchical `qualified_id` to all nodes (used for export/save/download)
- `addQualifiedIds()` / `removeQualifiedIds()` - Add/remove `qualified_id` fields recursively through nested network nodes
- `loadGraphFromProtocol()` - Load a graph from CORAL protocol format (renamed from `loadGraph()`)

### State Management

Stores use Svelte 5 runes (`.svelte.js` / `.svelte.ts` files):

- `nodes.svelte.ts` - Central store for flow nodes/edges and the registry. Exports `getNodes()`, `getNodesSnapshot()`, `setNodes()`, `getEdges()`, `getEdgesSnapshot()`, `setEdges()`, `setRegistry()`. Network nodes use dedicated `RegisteredNetworkNodes` / `NetworkNodeOfTypeNetwork` types.
- `auth.svelte.js` - JWT token for coral-remote-server API
- `settingsStore.svelte.js` - User settings stored under a single `'settings'` key in electron-store. Exports named key constants (`SSH_PATH`, `URL_VISUALIZER`, `URL_REMOTE_SERVER`, `USE_MPI`) and a `settingsState` object with `getKey(key)` / `setKey(key, value)` methods.
- `currentProjectStore.svelte.js` - Current project metadata
- `jobsStore.svelte.js` - Slurm job tracking

### Node Type System

Defined in `src/lib/types/nodeTypes.ts`. Node types from CORAL:

- `ELEMENTARY_CONSTRUCTOR` - Primitive types (int, double, string)
- `CONSTRUCTOR` / `EMPTY_CONSTRUCTOR` - Class constructors
- `ABSTRACT` - Abstract base classes
- `VOID_METHOD` / `VOID_CONST_METHOD` / `VOID_FUNCTION` / `FUNCTION` - Operations
- `NETWORK` - Encapsulated computational graphs (see Network Nodes below)

Connection validation (`src/lib/utils/connectionsValidation.js`) enforces type compatibility between node outputs and inputs.

### How Nodes and Edges Work Together

The computational graph system connects nodes through edges, with strict type validation to ensure correct data flow.

#### Node Structure

Each node in the system has:

- **`type`**: Identifier for the node class (e.g., `"Triangulation"`, `"DoFHandler"`, or `"coral::Network"`)
- **`base`**: Optional base class type (for inheritance)
- **`arguments`**: Array of argument definitions, each with:
  - `name`: Argument name
  - `type`: Data type (e.g., `"int"`, `"double"`, `"Triangulation"`)
  - `connection_type`: `"input"`, `"output"`, or `"pass_through"`
- **`inputs`**: Array of indices mapping to `arguments` array for input connections
- **`outputs`**: Array of indices mapping to `arguments` array for output connections, or `Outputs.SELF` (-1) for constructor/self-returning methods

#### Edge Structure

Edges connect node outputs to node inputs:

```typescript
{
  source: 123,           // Source node ID
  source_output: 0,      // Index into source node's outputs array
  target: 456,           // Target node ID
  target_input: 1        // Index into target node's inputs array
}
```

#### Connection Logic

When an edge connects two nodes:

1. **Source node output lookup**:
   - Check `sourceNode.outputs[edge.source_output]`
   - If value is `Outputs.SELF` (-1): The output type is `sourceNode.base ?? sourceNode.type` (the node itself)
   - Otherwise: The output type is `sourceNode.arguments[edge.source_output].type`

2. **Target node input lookup**:
   - Get `targetNode.arguments[edge.target_input].type`

3. **Type validation**:
   - Source output type must exactly match target input type
   - Validation happens in `validateGraphData()` in `src/lib/utils/graphParser.ts`

#### Example: Connecting Constructor to Method

```typescript
// Constructor node (creates Triangulation object)
{
  type: "Triangulation",
  node_type: "constructor",
  arguments: [
    { name: "dimension", type: "int", connection_type: "input" }
  ],
  inputs: [0],      // dimension is at arguments[0]
  outputs: [-1]     // Outputs.SELF - returns the Triangulation object
}

// Method node (operates on Triangulation)
{
  type: "Triangulation::refine_global",
  node_type: "void_method",
  base: "Triangulation",
  arguments: [
    { name: "self", type: "Triangulation", connection_type: "pass_through" },
    { name: "times", type: "int", connection_type: "input" }
  ],
  inputs: [0, 1],   // both self and times are inputs
  outputs: [-1]     // Outputs.SELF - returns the modified Triangulation
}

// Edge connecting them
{
  source: 1,        // Constructor node ID
  source_output: 0, // First output (SELF)
  target: 2,        // Method node ID
  target_input: 0   // First input (self parameter)
}
```

**Validation process**:

1. Source output: `outputs[0] === -1` (SELF), so type is `"Triangulation"`
2. Target input: `arguments[inputs[0]]` = `arguments[0]` = `{ type: "Triangulation" }`
3. Types match: ✓ `"Triangulation" === "Triangulation"`

#### Network Node Lookups

For network nodes (`type === "coral::Network"`):

- Node definitions are stored in `networkNodes` store (not `registry`)
- Lookup uses the node's `name` field: `getNetworkNodeData(node.name)`
- Regular nodes use: `getNodeData(node.type)`

#### Network Nodes

Network nodes (`node_type: NodeType.NETWORK`) encapsulate entire computational graphs as reusable components:

- **Free Inputs/Outputs**: Only unconnected inputs/outputs become the network node's external interface
- **Arguments, inputs, outputs**: Those fields are optional for network nodes. In the case they are present they must follow the rules below.
- **Arguments Array**: The order of the contained objects must follow the order of the ids of the internal nodes.
- **Index Mapping**: As for other nodes, each node's `inputs[i]` contains an index into its `arguments` array
  - Example: `inputs: [0, 2, 5]` means arguments at indices 0, 2, and 5 are inputs
  - Edges reference these via handles: `targetHandle: "input-1"` connects to `arguments[inputs[1]]`
- **Pass-through Arguments**: An argument with `connection_type: 'pass_through'` stays the same only if both input and output are free for the same internal node. On the contrary if one of internal `pass_trough` is connected, then at the netwrok node level the argument will be marked with a `connection_type: 'input'` or `output`.
- **Value Field**: Contains the sub-graph as a `Network` object. The value is stripped from node data when on canvas and restored during export via `parseGraphToProtocol()`.
- **Qualified IDs**: On export/save/download, `addQualifiedIds()` adds a `qualified_id` field to every node encoding its position in the nesting hierarchy (e.g., `"12_3"` for node 3 inside network node 12). Removed on import via `removeQualifiedIds()`.
- **Creating Network Nodes**: Use `createNewNetworkNode(name, nodes, edges)` from `networkNode.ts` (takes snapshot arrays, not reactive state)
  - The function automatically identifies free inputs/outputs by checking which connections have no edges
  - Results can be added to the `networkNodes` store via `addNetworkNode(key, nodeData)`

## Common Commands

### Development

```bash
npm run dev          # Build frontend + run Electron in dev mode
npm run dev:vite     # Run frontend only with hot-reload
npm start            # Run Electron (requires built frontend)
npm start:debug      # Run Electron with Chrome DevTools debugger on port 9229
```

### Build & Package

```bash
npm run build        # Build frontend to dist/
npm run make:deb     # Package for Linux (.deb)
npm run make:dmg     # Package for macOS (requires macOS)
```

### Code Quality

```bash
npm run lint         # ESLint check
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier format
```

### Unit Tests

```bash
npm run test         # Run unit tests
```

### Docker (SSH + Slurm testing)

```bash
docker compose up -d                           # Start containers
ssh -p 2222 root@localhost                     # SSH to container
docker exec -it coral-ssh-slurm bash           # Shell in container
```

**Build Coral in container:**

```bash
cd /app && cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build
```

## Key Technical Details

- **Svelte 5 runes**: Uses `$state`, `$derived`, `$effect` for reactivity (not legacy stores). Use `$state.snapshot()` when passing reactive state to non-reactive contexts.
- **IPC channels**: `execute-ssh-with-key`, `export-graph-ssh`, `set-theme`, `open-external-url`
- **Git hooks (Husky)**: On commit — `npm run lint` (failures abort), then Prettier auto-formats.
- **CI (GitHub Actions)**: Both workflows (`create_deb.yml`, `create-macos.yml`) run `npm run check` (svelte-check) and `npm test` on pull requests and pushes to `main`.
- **API requests**: All authenticated requests go through `src/lib/requests/api.js` which auto-attaches the Bearer token
- **Slurm batch templates**: Two templates in `src/lib/templates/` — `sbatch.template.sh` (non-MPI) and `sbatch-mpi.template.sh` (MPI via `mpirun --allow-run-as-root -np ${SLURM_NTASKS:-1}`). Imported at build time via Vite's `?raw` suffix. `sshMessages.ts` selects between them based on the `USE_MPI` setting. Both templates expose `{{INTERNAL_JOB_ID}}` (used for `--touch-dir nodes-exec-status/<id>`) and `{{TIME_LIMIT}}`. The MPI template additionally exposes `{{NODES}}` and `{{NTASKS_PER_NODE}}`, filled at runtime from `JobConfig` (defaults: 1 node, 4 tasks/node, 01:00:00 time limit). Clicking Execute always opens `JobConfigModal.svelte` (renamed from `MpiConfigModal.svelte`) — it shows MPI-specific fields (nodes, tasks/node) only when MPI is enabled, and always shows the time limit field.
- **MPI graph payload**: When MPI is enabled, `buildGraphPayload()` in `sshMessages.ts` injects a `plugin: { MPI: { enabled: true, max_num_threads: 1 } }` block at the top of the exported network JSON, as required by CORAL for MPI initialization.
- **Node execution status**: `getNodesExecutionStatus(jobIdInternal)` reads files from `/app/shared-data/nodes-exec-status/<internalJobId>/` on the remote server, returning a `Map<qualifiedNodeId, string[]>` of status sequences (e.g. `'running'`, `'succeeded'`, `'failed'`).

## Git Workflow

Clone with submodules:

```bash
git clone --recursive <repo>
# Or if already cloned:
git submodule update --init --recursive
```
