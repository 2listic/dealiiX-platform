# Changelog

See [docs/changelog-template.md](docs/changelog-template.md) for formatting your changelog.

## [Unreleased]

### Building

- [#155](https://github.com/2listic/dealiiX-platform/pull/155) Added `--no-sandbox` flag to `dev` and `start` scripts to fix Electron sandbox crash on Linux systems where `chrome-sandbox` is not owned by root after `npm install`.

### Documentation

- [#153](https://github.com/2listic/dealiiX-platform/pull/153) Added documentation to inspect and programmatically empty keys from the Electron-store store.
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

- [#139](https://github.com/2listic/dealiiX-platform/pull/139) Added library Electron-store to persist data and settings across sessions.

### SSH communication

- [#153](https://github.com/2listic/dealiiX-platform/pull/153) Added MPI support for Slurm job submission using two default sbatch templates (MPI and non-MPI). The active template is selected by a new switch button in the Settings modal, persisted in the settings store. Parameters are passed to the template from the UI.
- [#142](https://github.com/2listic/dealiiX-platform/pull/142) Added SSH communication to get the execution status of all the nodes in a specific job.
- [#138](https://github.com/2listic/dealiiX-platform/pull/91) Added SSH communication to retrieve content of file .out for a specific job.

### Submodules

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
