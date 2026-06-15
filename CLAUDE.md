# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DealiiX Platform is an Electron + Svelte 5 desktop application for building and executing computational graphs. It provides a visual node-based editor (using @xyflow/svelte) that connects to a C++ backend called CORAL (Computational Object-oriented Representation And Library) for scientific computing workflows.

## Code Conventions

- **File declaration order**: In `.ts` / `.svelte.ts` modules, place exported (public) functions before private helpers. Private helpers go at the bottom, separated by a `// ── Private helpers ──` banner comment. This lets readers see the public API first without scrolling past implementation details.
- **Documentation**: Every exported function must have a concise JSDoc block with `@param` tags for each parameter, a `@returns` tag, and `@throws` for any thrown errors. Inside the function body, add inline comments only where the logic is non-obvious — hidden constraints, subtle invariants, or unintuitive decisions.
- **Svelte 5 writable `$derived`**: Since Svelte 5.25, `$derived` values can be temporarily overridden by reassignment and reset automatically when their dependency changes. Prefer `$derived(prop)` over `$state(prop)` + `$effect` for form fields that derive from props — it is writable, stays in sync, and avoids the lint warning `state_referenced_locally`. Use `onClose` on `<Modal>` to reset dirty values on cancel rather than tracking visibility with an effect.
- **Renaming files**: Always use `git mv <old> <new>` to rename files so git tracks the rename rather than treating it as a delete + add. Never delete a file and recreate it manually when the intent is a rename.
- **Explicit else-if over bare else**: When branching on enum-like string unions (e.g. `location === 'local' | 'remote'`, `backendKind === 'coral' | 'executable'`), always use `else if (x === '...')` rather than a bare `else`. This makes the covered cases self-documenting and avoids silently swallowing future variants.

## Git Commit Style

Commit messages use a short subject line followed by a bullet list. Each bullet is prefixed with a conventional commit type:

```
Fix/refactor: short summary of the overall change

- fix: specific bug that was corrected
- refactor: code restructured without behaviour change
- feat: new capability added
- docs: documentation or CLAUDE.md update
- chore: tooling, config, or dependency change
```

Rules:

- No `Co-Authored-By` trailer, no "Generated with Claude Code" attribution
- Keep the subject line concise — detail goes in the PR description, not the commit
- Use sentence case, no trailing period

## Pull Request Procedure

Open PRs with `gh pr create`. Use the template at `.github/PULL_REQUEST_TEMPLATE.md` as the body — it has:

- `It closes #<issue>` — issue reference at the top
- `## Overview` — high-level goal, motivation, and any constraints a reviewer needs
- `## Summary` — bullet list of concrete changes, each prefixed with a conventional commit type
- `## Test plan` — markdown checklist of steps to verify the change
- `- [ ] Update CHANGELOG` — reminder checklist item (appears just after the issue reference, before `## Overview`)

## Working files

Temporary files produced during a session — plans, drafts, issue breakdowns, scratch notes — go in `.ai/`. The directory is gitignored, so nothing there is ever committed.

## Changelog

Update `CHANGELOG.md` under `## [Unreleased]` alongside every commit that touches user-visible behaviour or project structure. Add entries under the appropriate section heading (e.g. `### SSH communication`, `### UI/UX`, `### Electron-Backend`). Write in plain prose — concise, general, no specific file names unless essential for clarity. Do not reference internal implementation details or refactors that have no user-visible effect.

## Architecture

### Desktop Application (Electron + Svelte 5)

- `electron/main.ts` - Electron main process, handles IPC for SSH connections, theme switching, external URLs
- `electron/preload.ts` - Context bridge exposing `window.electron` API (send, on, invoke, getFilePath)
- `electron/utils/sshConnections.ts` - SSH utilities using ssh2 library
- `src/` - Svelte 5 frontend with runes-based reactivity

### Submodules (separate repos)

- `coral/` - C++ computational graph library using deal.II, builds `coral/build/core/coral` (CLI binary) and `coral/build/backends/dealii/libcoral_backend_dealii.so` (deal.II plugin)
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
- `importGraphFromProtocol()` - Full import pipeline: validate + strip qualified IDs + load. Returns `{ invalidEdges, registeredNetworkNodes }` for callers to toast.

### State Management

Stores use Svelte 5 runes (`.svelte.ts` files):

- `nodes.svelte.ts` - Central store for flow nodes/edges. Exports `getNodes()`, `getNodesSnapshot()`, `setNodes()`, `getEdges()`, `getEdgesSnapshot()`, `setEdges()`, `addNode()`, `addEdge()`, `removeNode()`, `updateLastNodeId()`.
- `registryStore.svelte.ts` - Registry for available node types (both standard and network). Exports `setRegistry()`, `getNodeData(type)`, `getAvailableNodes()`, `isNodeInRegistry(type)` for standard nodes; and `addNetworkNode(key, data)`, `removeNetworkNode(name)`, `getNetworkNodeDefinition(name)`, `getStoredNetworkNodes()`, `isNodeInNetworkNodes(name)` for subgraph nodes. Both registries are persisted in electron-store and loaded at startup.
- `graphStack.svelte.ts` - Navigation context stack for entering/exiting subnetworks. `graphStackState` has `breadcrumbs`, `canGoBack`, `currentLabel` reactive getters, plus `pushContext()`, `collapseToParent()`, `updateTopContext()`, `updateParentContext()`, `reset()` mutators, and `syncCurrent()` which snapshots the live canvas into the top stack entry before any navigation action. `graphHistoryState` exposes the per-level undo/redo API: `canUndo`/`canRedo` reactive getters; `checkpoint()` (single-step actions), `begin()`/`commit()` (multi-step gestures), `undo()`, `redo()`, `clearHistory()`. Each `GraphContext` holds `current: HistoryEntry` (navigation snapshot), `past: HistoryEntry[]`, and `future: HistoryEntry[]`.
- `graphNavigation.svelte.ts` - High-level subnetwork navigation actions built on top of `graphStack`. Exports `enterSubnetwork(nodeId)` (drills into a subnetwork node), `loadParentGraph()` (navigates back, persisting edits), and `renameCurrentSubnetwork(name)` (renames without navigating away).
- `nodeIdCounter.svelte.ts` - Isolated store for generating unique node IDs (`getNextNodeId()`). Kept separate from `nodes.svelte.ts` to avoid importing electron side-effects in utility/test contexts.
- `colorModeStore.svelte.ts` - Light/dark theme state. `colorModeState.value` (get/set) and `colorModeState.toggle()`. Setting automatically syncs to electron IPC (`set-theme`) and persists to electron-store under `colorMode`.
- `parametersStore.svelte.ts` - Transient store for the CORAL parameter tree (loaded from a run). `parametersState.value` (get/set) and `parametersState.snapshot` (non-reactive copy).
- `auth.svelte.ts` - JWT token for coral-remote-server API. Methods: `setToken()`, `setUsername()`, `clearToken()`. Persisted in electron-store under `access_token` / `username`.
- `settingsStore.svelte.ts` - User settings stored under a single `'settings'` key in electron-store. Exports named key constants (`SSH_PATH`, `URL_VISUALIZER`, `URL_REMOTE_SERVER`, `USE_MPI`) and a `settingsState` object with `getKey(key)` / `setKey(key, value)` methods.
- `currentProjectStore.svelte.ts` - Current project metadata (`id`, `name`). Methods: `set()`, `clear()`, `updateName()`. Exports `ApiProject` interface for use in components.
- `jobsStore.svelte.ts` - Slurm job tracking. `jobsState` has `isEmpty`/`oneOrLess` getters, `update()` refreshes from SSH. `jobIdMapState` maps Slurm scheduler IDs → internal incremental job IDs (used in touch-dir paths).
- `toastsStore.svelte.ts` - Toast notifications. Use `toastState.add({ message, type })` to show a toast. Supports `'error'`/`'success'` types with auto-dismissal.
- `dndStore.svelte.ts` - Drag-and-drop state (`dndNodeDataState.current`) for tracking which sidebar node is being dragged onto the canvas.

### Node Type System

Defined in `src/lib/types/nodeTypes.ts`. Node types from CORAL:

- `ELEMENTARY_CONSTRUCTOR` - Primitive types (int, double, string)
- `CONSTRUCTOR` / `EMPTY_CONSTRUCTOR` - Class constructors
- `ABSTRACT` - Abstract base classes
- `VOID_METHOD` / `VOID_CONST_METHOD` / `VOID_FUNCTION` / `FUNCTION` - Operations
- `NETWORK` - Encapsulated computational graphs (see Network Nodes below)

Connection validation (`src/lib/utils/connectionsValidation.ts`) enforces type compatibility between node outputs and inputs.

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

- Node definitions are stored in the `networkNodes` section of `registryStore.svelte.ts` (not the standard `registry`)
- Lookup uses the node's `name` field: `getNetworkNodeDefinition(node.name)`
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
- **Creating Network Nodes**: Use `createNetworkNodeDefinition(name, nodes, edges)` from `networkNode.ts` (takes snapshot arrays, not reactive state)
  - The function automatically identifies free inputs/outputs by checking which connections have no edges
  - `analyzeNetworkBoundary(nodes, edges)` from `networkNode.ts` returns the boundary analysis (free inputs/outputs, internal edges) without constructing the full definition
  - Results can be added to the `networkNodes` store via `addNetworkNode(key, nodeData)` from `registryStore.svelte.ts`
- **Canvas-level subnetwork operations** (`src/lib/utils/networkNodeCanvas.ts`): Higher-level operations that work directly on the live canvas state:
  - `explodeNetworkNodeInGraph(nodeId)` — replaces a network node with its constituent nodes/edges, rewiring external connections
  - `collapseSelectionToSubnetwork(name, selectedNodeIds)` — collapses a set of selected nodes into a new named network node
  - `flattenSelectedSubgraphs(selectedNodeIds)` — recursively flattens nested subgraphs within a selection in-place
  - `isNetworkCanvasNode(node)` — type guard for subnetwork canvas nodes
- **Subnetwork Navigation**: `enterSubnetwork(nodeId)` and `loadParentGraph()` from `graphNavigation.svelte.ts` handle drilling into / back out of subnetworks. The graph stack (`graphStackState` in `graphStack.svelte.ts`) holds a `GraphContext` per level (label, current, past, future, parentNodeId). Always call `graphStackState.syncCurrent()` before reading stack state — it snapshots the live canvas into the top context.

## Common Commands

### Development

```bash
npm run dev          # Compile electron TS + build frontend (dev) + run Electron
npm run dev:vite     # Run frontend only with hot-reload
npm start            # Run Electron (requires already-built electron + frontend)
npm start:debug      # Run Electron with Chrome DevTools debugger on port 9229
```

### Build & Package

```bash
npm run build:electron   # Compile electron TypeScript to dist-electron/
npm run build            # Compile electron TS + build frontend to dist/
npm run make:deb         # Package for Linux (.deb)
npm run make:dmg         # Package for macOS (requires macOS)
```

### Code Quality

```bash
npm run lint             # ESLint check
npm run lint:fix         # ESLint with auto-fix
npm run check            # svelte-check (frontend TypeScript + Svelte)
npm run check:electron   # tsc --noEmit for the electron main process
npm run format           # Prettier format
```

### Unit Tests

```bash
npm run test                                          # Run all unit tests
npx vitest run src/lib/utils/graphParser.test.ts      # Run a single test file
```

Test files follow the pattern `src/**/*.test.{js,ts}`. Tests run in a Node environment with Svelte plugin and `browser` resolve conditions (no globals — use explicit imports from `vitest`).

### E2E Tests (Tier 1 — Playwright + Electron)

```bash
npm run build:electron && npm run build   # required before running E2E tests
npm run test:e2e                          # run all E2E tests
npx playwright test e2e/canvas.spec.ts   # run a single spec file
```

Tests live in `e2e/`. Shared fixtures (Electron launch + window ready) are in `e2e/fixtures.ts`.

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

- **Svelte 5 runes**: Uses `$state`, `$derived`, `$effect` for reactivity (not legacy stores). Use `$state.snapshot()` when passing reactive state to non-reactive contexts. See Code Conventions for the writable `$derived` pattern.
- **Parameter file formats** (`src/lib/utils/parameterFileFormat.ts`): Shared utility (imported by both the Svelte frontend and the Electron main process) for parsing and serialising parameter files in JSON or deal.II `.prm` format. Key exports: `parseParametersFileWithFormat(content, fileName?)` (auto-detects format via content sniffing), `serializeParametersFile(tree, fileName?)` (format derived from the filename extension), `getParameterProbeFileNames(fileName)` (returns JSON candidate first, then PRM). **JSON is always preferred over PRM** when probing an executable — JSON carries rich metadata (validation patterns, default values, documentation) while PRM stores every value as plain text. Format detection uses content sniffing first, filename extension second.
- **IPC channels**: `execute-ssh-with-key`, `export-graph-ssh`, `set-theme`, `open-external-url`, `upload-file-ssh`, `store:get`, `store:set`, `store:remove`
- **Electron storage keys** (`electron/utils/storage.ts`): `access_token`, `username`, `settings`, `colorMode` (default: `'light'`), `registered_nodes`, `registered_network_nodes`, `jobs`, `jobIdMap`
- **Electron TypeScript build**: `electron/**/*.ts` files are compiled by `tsc` (not Vite) to `dist-electron/`. The main process uses `tsconfig.electron.json` (ESM output); the preload uses `tsconfig.electron.preload.json` (CJS output, required by Electron's sandboxed preload context). `dist-electron/` is gitignored. Type declarations for `ssh2` (which ships no `.d.ts`) live in `electron/types/ssh2.d.ts`.
- **Git hooks (Husky)**: On commit — `npm run lint` and `npm run check:electron` (failures abort), then Prettier auto-formats.
- **CI (GitHub Actions)**: All workflows run `npm run check` (svelte-check), `npm run check:electron` (electron tsc), and `npm test`. Workflow files: `.github/workflows/ci.yml`, `.github/workflows/release-linux.yml`, `.github/workflows/release-macos.yml`.
- **API requests**: All authenticated requests go through `src/lib/requests/api.js` which auto-attaches the Bearer token. Throws `ApiError` (with `.status` and `.data`) on non-2xx responses. Project CRUD ops are in `src/lib/requests/projects.js`.
- **Canvas node creation**: `createCanvasNode(template, position, options?)` in `src/lib/utils/canvasNodeUtils.ts` creates a new @xyflow Node from a registry template. `getOutputTypeAndName(sourceNode, sourceHandle)` resolves the type/name for a source handle during drag-to-connect.
- **Auto-layout**: `applyAutoLayout(nodes, edges, direction?)` in `src/lib/utils/autoLayout.ts` repositions nodes using the dagre rank-based algorithm (`'LR'` by default). Call after loading or structurally modifying a graph when node positions aren't provided.
- **Registry validation**: `filterValidNodes(registry)` in `src/lib/utils/registryValidator.ts` validates a raw registry payload from CORAL, returning a `[validRegistry, skippedKeys]` tuple. Used when loading the registry at startup to skip malformed entries.
- **Key type enums** (`src/lib/types/`): `ConnectionType` (INPUT/OUTPUT/PASSTHROUGH), `ExecNodeStatus` (FAILED/SUCCEEDED/RUNNING), `JobStatus` (COMPLETED/FAILED/PENDING/RUNNING), `nodeColors` (maps node types to CSS colors), `HIDDEN_SIDEBAR_NODE_TYPES` (excludes ABSTRACT and NETWORK from sidebar listing).
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
