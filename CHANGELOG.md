# Changelog

See [docs/changelog-template.md](docs/changelog-template.md) for formatting your changelog.

## [Unreleased]

### Canvas-graph

- [#175](https://github.com/2listic/dealiiX-platform/issues/175) Per-level undo/redo history for the canvas. Each navigation level (root graph and each open subnetwork) keeps its own independent undo/redo stacks, capped at 50 entries. Undo (Ctrl/⌘+Z) and Redo (Ctrl/⌘+Shift+Z) are available as keyboard shortcuts and as items inside the Layout sidebar group button.

### UI/UX

- [#102](https://github.com/2listic/dealiiX-platform/issues/102) Complete colour-palette overhaul: all hard-coded hex values replaced with semantic CSS variables. Dark-mode depth hierarchy established (primary → surface → secondary → ternary). All 16 SVG icon components migrated to `currentColor` so they adapt automatically to the active theme. Form elements given explicit `color: var(--ternary-color)` to override the UA-stylesheet reset. Node action buttons and elementary constructor inputs styled to match the active theme. Zoom controls panel removed as it didn't provide any real value and a complex fix was needed to style it properly.
- [#169](https://github.com/2listic/dealiiX-platform/issues/169) When multiple nodes are selected on the canvas a "Delete Selected" button appears in the bottom-centre panel, removing all selected nodes and their connected edges in a single operation.
- [#112](https://github.com/2listic/dealiiX-platform/issues/112) The Project button group is now disabled when the user is not logged in, in addition to when no remote server is configured.
- [#185](https://github.com/2listic/dealiiX-platform/pull/185) Parameter section duplicate logis is via a new duplicate button instead of via right-click. Duplicated sections can be deleted with a new delete button. Sections are set back to native `<details>`/`<summary>` elements for collapsible behaviour.
- [#185](https://github.com/2listic/dealiiX-platform/pull/185) The execution modal now includes an editable parameters file name field, letting users override the file path per run without changing the global settings.

### Electron-Backend

- [#185](https://github.com/2listic/dealiiX-platform/pull/185) `.prm` (deal.II text parameter) files are now supported alongside JSON as a parameter file format. Format is auto-detected from content; JSON is preferred when probing since it carries richer metadata (validation patterns, defaults, documentation). When probing, the app tries the JSON candidate first and falls back to `.prm` if absent or unparseable. "Merge from file" no longer overwrites the stored parameters file name.

### SSH communication

- Added support for connecting to CORAL + Slurm containers running on a real remote machine over SSH. SSH access into the container is enabled on port 2222 via public key authentication using a volume-mounted authorised key. The SSH public key path is configured via a gitignored `.env` file so the same `docker-compose.yml` works on any machine. A step-by-step setup guide is available at `docs/remote-setup.md`.

### Docker

- `coral-remote-server` is now included in the main `docker-compose.yml` alongside `coral-ssh-slurm` and `coral-visualizer`, so a single `docker compose up` starts the full stack. The database is persisted in `coral-remote-server/data/coral.db` via a directory volume mount.

### Testing

- [#193](https://github.com/2listic/dealiiX-platform/issues/193) Tier 1 E2E test suite added using Playwright and Electron. Tests cover app launch, sidebar node loading, drag-and-drop node creation, undo/redo, JSON graph import, edge connection between handles, and subnetwork collapse/explode. Each test establishes its own canvas state via graph import to remain independent of execution order. CI runs the suite headlessly via `xvfb-run` after the frontend build step.

### Project-Structure

- The renderer is now fully strict TypeScript. `jsconfig.json` renamed to `tsconfig.json` with `"strict": true` enabled; all Svelte component `<script>` blocks use `lang="ts"`; all stores converted from `.svelte.js` to `.svelte.ts`; entry point renamed from `main.js` to `main.ts`. The codebase passes `svelte-check` with zero errors under strict mode.

## [1.4.0] - 2026-05-11

### Canvas-graph

- [#174](https://github.com/2listic/dealiiX-platform/pull/174) Subnetwork nodes can now be opened and edited in-place directly from the canvas. Navigation through nested graphs is handled via a breadcrumb bar with back navigation. Subnetworks can be renamed from the breadcrumb while editing. A selection of nodes can be collapsed into a new named subnetwork, and any subnetwork node can be exploded back into its constituent nodes in the parent graph. When a subnetwork is emptied while editing and the user navigates back, the corresponding subnetwork node is automatically removed from the parent graph.
- [#174](https://github.com/2listic/dealiiX-platform/pull/174) Creating a subnetwork is now a contextual action triggered from a canvas selection. The old "Create Sub-Graph" entry has been removed from the Import panel.
- [#174](https://github.com/2listic/dealiiX-platform/pull/174) Fixed edge validation when returning to the parent graph from an open subnetwork, and on graph import, to correctly resolve input/output indices. Fixed a crash on dynamic node creation via edge-drag when multiple network nodes are present on the canvas.
- [#173](https://github.com/2listic/dealiiX-platform/pull/173) Create-on-connect flow: dragging a connection handle onto an empty canvas area now finds compatible node types, creates the node immediately if only one option exists, or opens a selection modal when multiple options are available.

### Project-Structure

- [#181](https://github.com/2listic/dealiiX-platform/pull/181) All Electron source files migrated from `.js` to `.ts`. New `tsconfig.electron.json` (ESM) and `tsconfig.electron.preload.json` (CJS) added. Type declarations for `ssh2` added in `electron/types/ssh2.d.ts`.
- [#181](https://github.com/2listic/dealiiX-platform/pull/181) `settingsStore.svelte.js` → `settingsStore.svelte.ts`; `auth.svelte.js` → `auth.svelte.ts`; `jobsStore.svelte.js` → `jobsStore.svelte.ts`; `api.js` → `api.ts`; `authentication.js` → `authentication.ts`; `projects.js` → `projects.ts`.
- [#181](https://github.com/2listic/dealiiX-platform/pull/181) New modules: `settingsTypes.ts` for settings type definitions, `settingsActions.ts` with `probeAndSaveExecution`, `parameterTypes.ts`. `executionStatus.ts` renamed to `jobTypes.ts`.
- [#181](https://github.com/2listic/dealiiX-platform/pull/181) IPC handlers extracted from `main.ts` into a dedicated `ipcHandlers.ts` module.
- [#181](https://github.com/2listic/dealiiX-platform/pull/181) `Settings.svelte` replaced by `SettingsModal.svelte`; the settings component now owns its modal instead of being wrapped externally.
- [#174](https://github.com/2listic/dealiiX-platform/pull/174) Registry node stores extracted to a dedicated module. New `graphStack.svelte.ts` store added to manage the hierarchical navigation context stack (breadcrumbs, graph snapshots per level, parent node references).
- [#174](https://github.com/2listic/dealiiX-platform/pull/174) `@dagrejs/dagre@3.0.0` added to dependencies.
- [#174](https://github.com/2listic/dealiiX-platform/pull/174) Vite dev config updated to exclude `@xyflow/svelte` from dependency pre-bundling, fixing an optimization conflict in browser dev mode.
- [#173](https://github.com/2listic/dealiiX-platform/pull/173) `connectionsValidation.js` migrated to TypeScript. Node ID counter extracted to its own store (`nodeIdCounter.svelte.ts`). New modal `CreateConnectedNodeModal.svelte` added to handle node type selection when multiple compatible options exist. `canvasNodeUtils.ts` with new helpers to create nodes dynamically.

### Testing

- [#174](https://github.com/2listic/dealiiX-platform/pull/174) Added tests for `networkNode.ts`, `networkNodeCanvas.ts` and `graphNavigation.ts`.
- [#174](https://github.com/2listic/dealiiX-platform/pull/174) Unit tests added for `autoLayout.ts`.
- [#173](https://github.com/2listic/dealiiX-platform/pull/173) Unit tests for create-on-connect utilities.

### CI/CD

- [#181](https://github.com/2listic/dealiiX-platform/pull/181) TypeScript compilation of the Electron process (`check:electron`) added to CI/CD workflows (`ci.yml`, `release-linux.yml`, `release-macos.yml`) and the Husky pre-commit hook.
- [#174](https://github.com/2listic/dealiiX-platform/pull/174) Fixed a race condition in the GitHub Actions pipeline causing `esbuild` version mismatches during `npm install`.
- [#173](https://github.com/2listic/dealiiX-platform/pull/173) CI/CD workflows restructured: new `ci.yml` runs type check (`svelte-check`) and tests on every push/PR to `main` (ubuntu only, no duplicate macOS run); `create_deb.yml` and `create-macos.yml` renamed to `release-linux.yml` and `release-macos.yml` trigger now only on tags.

### UI/UX

- [#182](https://github.com/2listic/dealiiX-platform/pull/182) File and directory pickers in the settings modal now open the native OS dialog directly via a single Edit click, replacing the two-step browser `<input type="file">` flow.
- [#181](https://github.com/2listic/dealiiX-platform/pull/181) Settings modal redesigned with accordions grouping related sections, pill-shaped radio buttons, and smooth CSS transitions.
- [#181](https://github.com/2listic/dealiiX-platform/pull/181) New execution badge always visible in the app showing the currently active execution mode.
- [#181](https://github.com/2listic/dealiiX-platform/pull/181) Sidebar buttons are hidden or disabled based on the currently selected execution mode.
- [#181](https://github.com/2listic/dealiiX-platform/pull/181) ParametersView now fills the full canvas area; the jobs table sits on top as a floating overlay.
- [#181](https://github.com/2listic/dealiiX-platform/pull/181) Jobs table shows a new "backend" column indicating whether each job used the Coral or Executable backend. Node-status button is hidden for executable jobs.
- [#181](https://github.com/2listic/dealiiX-platform/pull/181) Jobs table formats submission and completion dates with time zone conversion for local-mode jobs.
- [#181](https://github.com/2listic/dealiiX-platform/pull/181) Sidebar state is stabilized when switching between execution modes.
- [#181](https://github.com/2listic/dealiiX-platform/pull/181) Parameter sections can be duplicated in the ParametersView.
- [#181](https://github.com/2listic/dealiiX-platform/pull/181) HTML-level form validation in the settings modal provides immediate native browser feedback.
- [#180](https://github.com/2listic/dealiiX-platform/pull/180) New execution settings picker: users can choose between Remote (SSH + Slurm), Local Coral, and Local Executable execution modes. The selected mode is persisted in the settings store.
- [#174](https://github.com/2listic/dealiiX-platform/pull/174) Project name merged into the new breadcrumb bar added to the bottom-left panel. New dedicated icons for the "Open subgraph" and "Explode" actions added to the header of every network (subgraph) node.
- [#174](https://github.com/2listic/dealiiX-platform/pull/174) New auto-layout button icon added. Layout tools are now grouped under a dedicated "Layout" sidebar menu with separate Horizontal and Vertical layout options. All the sidebar button dropdowns now close automatically after selecting an option.
- [#174](https://github.com/2listic/dealiiX-platform/pull/174) Selected nodes now display explicit visual selection styling on the canvas.
- [#174](https://github.com/2listic/dealiiX-platform/pull/174) Pressing `Enter` now triggers the primary action in all main dialogs and forms.
- [#158](https://github.com/2listic/dealiiX-platform/issues/158) New collapsible parameters panel on the right side of the canvas, toggled by a vertical "Parameters" tab.
- [#158](https://github.com/2listic/dealiiX-platform/issues/158) "Upload Graph" and "Upload Parameters" checkboxes added to the "Job Execution" modal so users can choose what to upload before job execution.

### Electron-Backend

- [#182](https://github.com/2listic/dealiiX-platform/pull/182) Added `pick-file` IPC handler and switched `pick-directory` to `dialog.showOpenDialogSync`.
- [#181](https://github.com/2listic/dealiiX-platform/pull/181) Entire Electron backend migrated to TypeScript: `main.ts`, `ipcHandlers.ts`, `executionProbe.ts`, `localCoralRuns.ts`, `sshConnections.ts`, `storage.ts`, `preload.ts`.
- [#181](https://github.com/2listic/dealiiX-platform/pull/181) Jobs store reset logic when the persisted job ID map is corrupted or requires migration; new job ID map structure now also stores the backend type used per job.
- [#180](https://github.com/2listic/dealiiX-platform/pull/180) New `localCoralRuns.ts` module handles spawning a local Coral process and monitoring its stdout/stderr output.
- [#180](https://github.com/2listic/dealiiX-platform/pull/180) New `executionProbe.ts` module probes the local environment at settings-save time to detect available Coral backends and validate paths.

### SSH communication

- [#183](https://github.com/2listic/dealiiX-platform/pull/183) SSH command failures now surface a meaningful error message instead of a cryptic JSON parse error. Execution probe, sbatch submission, sacct queries, and node-status polling all reject on non-zero exit codes with the captured output in the error. The settings probe returns a structured error result, avoiding the noisy Electron IPC prefix in user-facing toasts. Fixed a crash when sbatch output contains no job ID, replaced a fragile case-sensitive sacct error check, and fixed ls error output being parsed as junk node-status entries when the status directory does not yet exist.
- [#181](https://github.com/2listic/dealiiX-platform/pull/181) Remote (Slurm) and local Coral execution modes now read all paths and endpoints from the settings store instead of using hardcoded values.
- [#181](https://github.com/2listic/dealiiX-platform/pull/181) `cancelled` job status added.
- [#158](https://github.com/2listic/dealiiX-platform/issues/158) Conditionally upload of the graph JSON and/or template parameters file. Sbatch templates replaced the hardcoded execution command with a new placeholder that is resolved to include or omit a new flag to handle parameters file.

### Documentation

- [#181](https://github.com/2listic/dealiiX-platform/pull/181) Execution mode documentation split into four dedicated files: `docs/run-coral-docker.md`, `docs/run-coral-local.md`, `docs/run-executable-local.md`, `docs/run-executable-remote.md`.
- [#181](https://github.com/2listic/dealiiX-platform/pull/181) deal.II step-70 source files (`step-70.cc`, `CMakeLists.txt`) added under `local_runs/` as a reference for local executable mode testing.

### Submodules

- [#184](https://github.com/2listic/dealiiX-platform/pull/184) Coral-Visualizer updated with new paraview based backend and its new features about filtering, pipeline, status and cell manipulation.
- [#173](https://github.com/2listic/dealiiX-platform/pull/173) Coral-Visualizer updated in order to be able to test new feature volume cells MaterialID tagging.
- [#177](https://github.com/2listic/dealiiX-platform/pull/177) Coral submodule backend updated in order to test new `read_grid` node with containerized Coral backend.

### Protocol

- [#177](https://github.com/2listic/dealiiX-platform/pull/177) Updated registry JSON file with available nodes to include new `read_grid` node.

## [1.3.0] - 2026-03-23

### Building

- [#161](https://github.com/2listic/dealiiX-platform/issues/161) Fixed `TypeError: object is not iterable` in Electron main process by downgrading Electron from v37 to v36.
- [#155](https://github.com/2listic/dealiiX-platform/pull/155) Added `--no-sandbox` flag to `dev` and `start` scripts to fix Electron sandbox crash on Linux systems where `chrome-sandbox` is not owned by root after `npm install`.

### Code-Quality

- [#159](https://github.com/2listic/dealiiX-platform/issues/159) Fixed Svelte 5 warnings in `EditProjectForm`, `ProjectCard`, `Modal`, `EditNodeNameModal`, and `UnifiedNode` components. Added `svelte-check` as a dev dependency.

### Documentation

- [#153](https://github.com/2listic/dealiiX-platform/pull/153) Added documentation to inspect and programmatically empty keys from the Electron-store store. Added `network-mpi.json` file to test MPI support via plugin.
- [#151](https://github.com/2listic/dealiiX-platform/pull/151) Updated registry and network exaples to include Step 4 Poisson solver example.

### Canvas-graph

- [#151](https://github.com/2listic/dealiiX-platform/pull/151) Bug fix over validation of new connections between nodes.
- [#143](https://github.com/2listic/dealiiX-platform/pull/143) Network node `value` (sub-graph) is stripped from canvas data and restored during export. `createNewNetworkNode` now takes snapshot arrays as parameters. Stronger typing for network nodes with dedicated `RegisteredNetworkNodes` / `NetworkNodeOfTypeNetwork` types. Added `getNodesSnapshot()` / `getEdgesSnapshot()` helpers. Added `isNumericType()` utility and `NUMERIC_TYPES` constant.

### UI/UX

- [#153](https://github.com/2listic/dealiiX-platform/pull/153) New modal to configure MPI execution.
- [#152](https://github.com/2listic/dealiiX-platform/pull/152) Fixed sidebar overflow when too many nodes or buttons exceed the window height (wraps to two columns). Grouped related sidebar buttons into dropdown components. New input text in the sidebar to filter registry nodes by "type". Moved network nodes before registry nodes in the sidebar. Elementary constructor nodes ordered first among the other registry nodes.
- [#147](https://github.com/2listic/dealiiX-platform/pull/147) Simplified elementary constructor input field rendering logic. Added fallback text input for all elementary constructor types.
- [#142](https://github.com/2listic/dealiiX-platform/pull/142) Added button in the jobs table that opens a modal with the execution status for every node in the corresponding job.
- [#138](https://github.com/2listic/dealiiX-platform/pull/138) Added button in the jobs table to read content of corresponding .out file. New library ansiUp is used to transform color ASCII codes into HTML tags.

### Electron-Backend

- [#153](https://github.com/2listic/dealiiX-platform/pull/153) Execution nodes' status is now saved in a dedicated `nodes-exec-status` directory on the remote server.
- [#142](https://github.com/2listic/dealiiX-platform/pull/142) Jobs state is now persistent across sessions. Added new persistent store to track internal job Ids with scheduler job Ids.
- [#139](https://github.com/2listic/dealiiX-platform/pull/139) App persistent storage moved from localStorage in the renderer to electron-store in the main process.

### Protocol

- [#146](https://github.com/2listic/dealiiX-platform/issues/146) Validated registry JSON during import: filter out non-compliant nodes. Excluded `abstract` and `network` node types from the sidebar available nodes list.
- [#143](https://github.com/2listic/dealiiX-platform/pull/143) Added `qualified_id` to all nodes during export/save/download, encoding nesting hierarchy (e.g., `"12_3"`). Removed on import. Added `parseGraphWithQualifiedIds()`, `addQualifiedIds()` and `removeQualifiedIds()`. Fixed removal of duplicate fields in standard nodes during export/save/download.
- [#141](https://github.com/2listic/dealiiX-platform/pull/141) Network nodes have the corresponding sub-graph saved in 'value' field as regular JSON instead of escaped string.

### Project-Structure

- [#157](https://github.com/2listic/dealiiX-platform/pull/157) Dependency versions updated in package-lock.json.
- [#139](https://github.com/2listic/dealiiX-platform/pull/139) Added library Electron-store to persist data and settings across. sessions.

### SSH communication

- [#153](https://github.com/2listic/dealiiX-platform/pull/153) Added MPI support for Slurm job submission using two default sbatch templates (MPI and non-MPI). The active template is selected by a new switch button in the Settings modal, persisted in the settings store. Parameters are passed to the template from the UI.
- [#142](https://github.com/2listic/dealiiX-platform/pull/142) Added SSH communication to get the execution status of all the nodes in a specific job.
- [#138](https://github.com/2listic/dealiiX-platform/pull/91) Added SSH communication to retrieve content of file .out for a specific job.

### Submodules

- [#166](https://github.com/2listic/dealiiX-platform/pull/166) Coral submodule updated to include Step 40 MPI support. Coral-Visualizer submodule updated to support files located in sub-folders.
- [#151](https://github.com/2listic/dealiiX-platform/pull/151) Coral submodule updated to include Step 4 Poisson Solver. Coral-Visualizer submodule updated to support .vtu files and show solution field.

### Testing

- [#146](https://github.com/2listic/dealiiX-platform/pull/146) Added unit tests for `filterValidNodes` function.
- [#143](https://github.com/2listic/dealiiX-platform/pull/143) Added unit tests for `addQualifiedIds` and `removeQualifiedIds`.

## [1.2.0] - 2026-01-28

### Canvas-graph

- [#134](https://github.com/2listic/dealiiX-platform/pull/134) Added button to create a network node from the current graph. Added support for new network nodes during the loading and the exporting of a graph. Added feature to validate all the connection types of every input-output linked by an edge in a graph.

### UI/UX

- [#134](https://github.com/2listic/dealiiX-platform/pull/134) Added section in the sidebar to display and drag the network nodes in the canvas.
- [#118](https://github.com/2listic/dealiiX-platform/pull/120) Added button to download the current graph locally.
- [#113](https://github.com/2listic/dealiiX-platform/pull/120) Display logged-in user's username.

### Protocol

- [#134](https://github.com/2listic/dealiiX-platform/pull/134) Added support for the new "network node" type.

### CI/CD

- [#135](https://github.com/2listic/dealiiX-platform/pull/135) Added unit testing step in the GitHub Actions workflows.

### Testing

- [#135](https://github.com/2listic/dealiiX-platform/pull/135) Added support for unit test with Vitest. Added unit tests for the function validateGraphData responsible for validating a graph before importing it into the editor.

## [1.1.0] - 2026-01-13

### Documentation

- [#122](https://github.com/2listic/dealiiX-platform/pull/82) Updated registry and network exaples to the new protocol indtroduced by PR #120.

### Canvas-graph

- [#99](https://github.com/2listic/dealiiX-platform/pull/99) Fixed connection validation after deleting an edge. Added caching for is_valid.

### UI/UX

- [#120](https://github.com/2listic/dealiiX-platform/pull/120) Added functionality for editing the displayed node's name.
- [#116](https://github.com/2listic/dealiiX-platform/pull/116) Input argument names are now displayed for clarity, along with the output types. Handlers are now larger and easier to interact with.
- [#114](https://github.com/2listic/dealiiX-platform/pull/114) Added reusable confirmation modal to user logout and project deletion.
- [#111](https://github.com/2listic/dealiiX-platform/pull/111) Added edit functionality for project name and description.
- [#103](https://github.com/2listic/dealiiX-platform/pull/103) Added button and modal to share a project with other users.
- [#101](https://github.com/2listic/dealiiX-platform/pull/101) Modals have now three different sizes to choose. Other fixes and improvements on the modal window component.
- [#101](https://github.com/2listic/dealiiX-platform/pull/101) Added buttons and modal windows for CRUD functionality to remote server on graph Projects.
- [#88](https://github.com/2listic/dealiiX-platform/pull/88) Added new button component. Modal component now exposes its own visibility state. Simplification and documentation made for the Modal component.
- [#80](https://github.com/2listic/dealiiX-platform/pull/80) Added panel with list of submitted jobs with current status and time.
- [#76](https://github.com/2listic/dealiiX-platform/pull/76) Input text changed to input file to store the path to private SSH key.
- [#75](https://github.com/2listic/dealiiX-platform/pull/75) Added toaster component to display error/success message to the user. Added also a logic to update Svelte Flow panel with additional messages or logs.

### Electron-Backend

- [#72](https://github.com/2listic/dealiiX-platform/pull/72) Color mode made persistent across sessions

### Remote-Server

- [#103](https://github.com/2listic/dealiiX-platform/pull/103) Added HTTP requests for sharing projects with other users giving read or write permissions.
- [#101](https://github.com/2listic/dealiiX-platform/pull/101) Added logic to make HTTP requests to the new Remote Server, specifically authorization functionality and CRUD operations to the Projects endpoints.

### Protocol

- [#120](https://github.com/2listic/dealiiX-platform/pull/120) Removed "type_hash" from registry JSON and replaced with "type". Simplified nework JSON removing duplicated information already present in the registry like "arguments", "inputs" and "outputs". Added optional "name" key in the network JSON in order to customize the name of the nodes in the graph.
- [#116](https://github.com/2listic/dealiiX-platform/pull/116) Added support for the "output" connection type and for multiple outputs returned from a single node. Added support for node types float, str and for the generic any type. Added support for the Python backend through the new enum values primitive, function, and method.

### SSH communication

- [#91](https://github.com/2listic/dealiiX-platform/pull/91) Updated SSH command to run Coral with new CLI
- [#88](https://github.com/2listic/dealiiX-platform/pull/88) New functionality to open a Electron window pointing to a specific url
- [#83](https://github.com/2listic/dealiiX-platform/pull/83) Added logic to retrieve status, start and finish time of the last submitted jobs
- [#82](https://github.com/2listic/dealiiX-platform/pull/82) Added polling to display if submitted Slurm job finishes with failed or completed status

### Submodules

- [#95](https://github.com/2listic/dealiiX-platform/pull/95) Coral Visualizer submodule updated to show carotid vtk file + fix add Coral submodule.

### Docker

- [#90](https://github.com/2listic/dealiiX-platform/pull/90) Added docker-compose file to build and run the Coral+SSH+Slurm and the Coral Visualizer containers

## [1.0.9] - 2025-09-19

### Documentation

- [#82](https://github.com/2listic/dealiiX-platform/pull/82) Added instructions to debug Svelte-renderer code in the Electron-Chromium dev tools.
- [#38](https://github.com/2listic/dealiiX-platform/pull/39) Added Git Hub section to the readme file. Update the pull request template.
- [#42](https://github.com/2listic/dealiiX-platform/pull/42) Added debugging instructions for Electron and Svelte.
- [#17](https://github.com/2listic/dealiiX-platform/pull/17) Created readme with install, run and packaging instructions.

### Canvas-graph

- [#67](https://github.com/2listic/dealiiX-platform/pull/67) Added missing nodes for the complete MWE. Added validation for nodes derived from abstract classes. Drag and drop state simplified.
- [#59](https://github.com/2listic/dealiiX-platform/pull/59) Added button to import graph from previously exported JSON file or from a JSON file adhering to the protocol.
- [#52](https://github.com/2listic/dealiiX-platform/pull/52) Nodes are removable by clicking on a dedicated button
- [#29](https://github.com/2listic/dealiiX-platform/pull/29) Added new nodes: std string, gridGenerator generate_from_name_and_arguments function, gridOut constructor, write_vtk method and bool. Nodes are rendered now more dynamically with a declarative approach based on the type of the node and the corresponding information provided in the uploaded JSON file.
- [#27](https://github.com/2listic/dealiiX-platform/pull/27) Added first new real Deal.II nodes: Unsigned, Triangulation<2,2> and Triangulation<2>::refine_global. Also included validation for new connections, validation for Unsigned internal values, drag&drop functionality and includes a bug fix on node id generation.
- [#22](https://github.com/2listic/dealiiX-platform/pull/22) Added type validation for new connections. Prevent multiple connections entering the same input handle. Added a simple cache system to reduce computation for connections already checked.
- Initial nodes and edges with string concatenation.

### UI/UX

- [#71](https://github.com/2listic/dealiiX-platform/pull/71) Added a new button Settings with a text input to store path to private SSH key.
- [#65](https://github.com/2listic/dealiiX-platform/pull/65) Custom checkbox input for dark/light mode switch instead of dropdown menu.
- [#58](https://github.com/2listic/dealiiX-platform/pull/58) Nodes' lateral bar made collapsible on mouse hover and on click on dedicated button.
- [#57](https://github.com/2listic/dealiiX-platform/pull/57) Added a new login/logout button. Retrieved authentication token from remote server is stored for future requests.
- [#51](https://github.com/2listic/dealiiX-platform/pull/51) Added lateral bars for action buttons (i.e. import, export JSON graph) and for node drag and drop. Added dark mode theme manually selectable from UI.
- [#29](https://github.com/2listic/dealiiX-platform/pull/29) A default set of nodes are displayed in the top horizontal bar when the application starts. A new button allows to upload a JSON file to update the set of nodes available.
  A bug fix is included to fix the behaviour of the incremental arrows in the unsigned node.
- [#24](https://github.com/2listic/dealiiX-platform/pull/24) Added a toolbar with drag and drop functionality to add new nodes. Added functionality to generate unique and incremental ids for new nodes.
- Buttons to run concatenated command via SSH on server
- [#9](https://github.com/2listic/dealiiX-platform/pull/9) Button to export and upload graph to server

### Electron-Backend

- [#142](https://github.com/2listic/dealiiX-platform/pull/142) Jobs state is now persistent across sessions. Added new persistent store to track internal job Ids with scheduler job Ids.
- [#139](https://github.com/2listic/dealiiX-platform/pull/139) App persistent storage moved from localStorage in the renderer to electron-store in the main process.
- [#72](https://github.com/2listic/dealiiX-platform/pull/72) Color mode made persistent across sessions
- Electron setup with IPC communication.
- SSH command execution via password and private key.
- SSH file writing via private key.

### Remote-Server

- [#103](https://github.com/2listic/dealiiX-platform/pull/103) Added HTTP requests for sharing projects with other users giving read or write permissions.
- [#101](https://github.com/2listic/dealiiX-platform/pull/101) Added logic to make HTTP requests to the new Remote Server, specifically authorization functionality and CRUD operations to the Projects endpoints.

### Protocol

- [#47](https://github.com/2listic/dealiiX-platform/pull/47) Migration from "self" to "-1" as output for stateful nodes. Index of edge's source_output starting from 0. Nodes and edges indexes starting from 0.

### Project-Structure

- [#78](https://github.com/2listic/dealiiX-platform/pull/78) Added Coral repo as a sub-dependency
- [#77](https://github.com/2listic/dealiiX-platform/pull/77) Dependency versions updated in package-lock.json
- [#67](https://github.com/2listic/dealiiX-platform/pull/67) Nodes are unified in one unique component.
- [#41](https://github.com/2listic/dealiiX-platform/pull/41) Added Prettier plugin for Svelte
- [#35](https://github.com/2listic/dealiiX-platform/pull/35) Updated icon and title of the .deb distributable
- [#34](https://github.com/2listic/dealiiX-platform/pull/34) Added Prettier and automatic formatting on commit
- [#16](https://github.com/2listic/dealiiX-platform/pull/16) gitignore .vscode and .continue folders
- [#21](https://github.com/2listic/dealiiX-platform/pull/21) Added husky to automatically lint on commit

### SSH communication

- [#142](https://github.com/2listic/dealiiX-platform/pull/142) Added SSH communication to get the execution status of all the nodes in a specific job.
- [#138](https://github.com/2listic/dealiiX-platform/pull/91) Added SSH communication to retrieve content of file .out for a specific job.
- [#91](https://github.com/2listic/dealiiX-platform/pull/91) Updated SSH command to run Coral with new CLI
- [#88](https://github.com/2listic/dealiiX-platform/pull/88) New functionality to open a Electron window pointing to a specific url
- [#83](https://github.com/2listic/dealiiX-platform/pull/83) Added logic to retrieve status, start and finish time of the last submitted jobs
- [#82](https://github.com/2listic/dealiiX-platform/pull/82) Added polling to display if submitted Slurm job finishes with failed or completed status
- [#78](https://github.com/2listic/dealiiX-platform/pull/78) Added container with Coral, Deal.II, Slurm and SSH server. Now a new job is queued with Slurm, when a new JSON graph is exported to the cluster
- [#71](https://github.com/2listic/dealiiX-platform/pull/71) Path to SSH private key is dynamically retrieved from localStorage

### Building

- [#12](https://github.com/2listic/dealiiX-platform/pull/12) Added electron-forge.
- [#4](https://github.com/2listic/dealiiX-platform/pull/4) Added .deb distributable for Linux.
- [#14](https://github.com/2listic/dealiiX-platform/pull/14) Added .dmg distributable for macOS.

### CI/CD

- [#78](https://github.com/2listic/dealiiX-platform/pull/78) Fixed issue with imports during packaging.
- [#38](https://github.com/2listic/dealiiX-platform/pull/37) Distributables are now created for tagged versions only.
