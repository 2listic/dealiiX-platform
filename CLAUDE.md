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
- `parseGraph()` - Convert @xyflow format → CORAL network format

### State Management

Stores use Svelte 5 runes (`.svelte.js` / `.svelte.ts` files):

- `nodes.svelte.ts` - Central store for flow nodes/edges and the registry. Exports `getNodes()`, `setNodes()`, `getEdges()`, `setEdges()`, `setRegistry()`, `loadGraph()`
- `auth.svelte.js` - JWT token for coral-remote-server API
- `settingsStore.svelte.js` - User settings (SSH key path, visualizer URL)
- `currentProjectStore.svelte.js` - Current project metadata
- `jobsStore.svelte.js` - Slurm job tracking

### Node Type System

Defined in `src/lib/types/nodeTypes.ts`. Node types from CORAL:

- `ELEMENTARY_CONSTRUCTOR` - Primitive types (int, double, string)
- `CONSTRUCTOR` / `EMPTY_CONSTRUCTOR` - Class constructors
- `ABSTRACT` - Abstract base classes
- `VOID_METHOD` / `VOID_CONST_METHOD` / `VOID_FUNCTION` / `FUNCTION` - Operations

Connection validation (`src/lib/utils/connectionsValidation.js`) enforces type compatibility between node outputs and inputs.

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

### Docker (SSH + Slurm testing)

```bash
docker compose up -d                           # Start containers
ssh -p 2222 root@localhost                     # SSH to container
docker exec -it coral-ssh-slurm bash           # Shell in container
```

**Build Coral in container:**

```bash
cd /app && mkdir build && cd build && cmake .. && make
```

## Key Technical Details

- **Svelte 5 runes**: Uses `$state`, `$derived`, `$effect` for reactivity (not legacy stores). Use `$state.snapshot()` when passing reactive state to non-reactive contexts.
- **IPC channels**: `execute-ssh-with-key`, `export-graph-ssh`, `set-theme`, `open-external-url`
- **Pre-commit hooks**: Husky runs `npm run lint` then Prettier; lint failures abort commit
- **API requests**: All authenticated requests go through `src/lib/requests/api.js` which auto-attaches the Bearer token

## Git Workflow

Clone with submodules:

```bash
git clone --recursive <repo>
# Or if already cloned:
git submodule update --init --recursive
```
