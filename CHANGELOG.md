# Changelog

See [docs/changelog-template.md](docs/changelog-template.md) for formatting your changelog.

## [Unreleased]

### Documentation

- [#38](https://github.com/2listic/dealiiX-platform/pull/39) Add Git Hub section to the readme file. Update the pull request template.
- [#42](https://github.com/2listic/dealiiX-platform/pull/42) Add debugging instructions for Electron and Svelte
- [#17](https://github.com/2listic/dealiiX-platform/pull/17) Create readme with install, run and packaging instructions

### Canvas-graph

- [#67](https://github.com/2listic/dealiiX-platform/pull/67) Add missing nodes for the complete MWE. Added validation for nodes derived from abstract classes. Drang and drop state simplified.
- [#59](https://github.com/2listic/dealiiX-platform/pull/59) Add button to import graph from previously exported JSON file or from a JSON file adhering to the protocol.
- [#52](https://github.com/2listic/dealiiX-platform/pull/52) Nodes are removable by clicking on a dedicated button
- [#29](https://github.com/2listic/dealiiX-platform/pull/29) Added new nodes: std string, gridGenerator generate_from_name_and_arguments function, gridOut constructor, write_vtk method and bool. Nodes are rendered now more dinamically with a declarative approach based on the type of the node and the corrsponding information provided in the uploaded JSON file.
- [#27](https://github.com/2listic/dealiiX-platform/pull/27) Added first new real Deal.II nodes: Unsigned, Triangulation<2,2> and Triangulation<2>::refine_global. Also included validation for new connections, validation for Unsigned internal values, drag&drop functionality and a bug fix on node id generation.
- [#22](https://github.com/2listic/dealiiX-platform/pull/22) Add type validation for new connections. Prevent multiple connections entering the same input handle. Added a simple cache system to reduce computation for connections already checked.
- Initial nodes and edges with string concatenation

### Canvas-UI

- [#71](https://github.com/2listic/dealiiX-platform/pull/71) Added a new button Settings with a text input to store path to private SSH key.
- [#65](https://github.com/2listic/dealiiX-platform/pull/65) Custom checkbox input for dark/light mode switch instead of dropdown menu.
- [#58](https://github.com/2listic/dealiiX-platform/pull/58) Nodes' lateral bar made collapsible on mouse hover and on click on dedicated button.
- [#57](https://github.com/2listic/dealiiX-platform/pull/57) Added a new login/logout button. Retrieved authenticaton token from remote server is stored for future requests.
- [#51](https://github.com/2listic/dealiiX-platform/pull/51) Added lateral bars for action buttons (i.e. import, export JSON graph) and for node drag and drop. Added dark mode theme manually selectable from UI.
- [#29](https://github.com/2listic/dealiiX-platform/pull/29) A default set of nodes are displayed in the top horizontal bar when the application starts. A new botton allows to upload a JSON file to update the set of nodes available.
  A bug fix is included to fix the behaviour of the incremental arrows in the unsigned node.
- [#24](https://github.com/2listic/dealiiX-platform/pull/24) Added a toolbar with drag and drop functionality to add new nodes. Added functionality to generate unique and incremental ids for new nodes.
- Buttons to run concatenated command via SSH on server
- [#9](https://github.com/2listic/dealiiX-platform/pull/9) Button to export and upload graph to server

### Electron-Backend

- [#72](https://github.com/2listic/dealiiX-platform/pull/72) Color mode made persistent across sessions
- Electron setup with IPC communication
- SSH command execution via password and private key
- SSH file writing via private key

### Remote-Server

-

### Protocol

- [#47](https://github.com/2listic/dealiiX-platform/pull/47) Migration from "self" to "-1" as output for statefull nodes. Index of edge's source_output starting from 0. Nodes and edges indexes starting from 0.

### Project-Structure

- [#67](https://github.com/2listic/dealiiX-platform/pull/67) Nodes are unified in one unique component.
- [#41](https://github.com/2listic/dealiiX-platform/pull/41) Add Prettier plugin for Svelte
- [#35](https://github.com/2listic/dealiiX-platform/pull/35) Update icon and title of the .deb distributable
- [#34](https://github.com/2listic/dealiiX-platform/pull/34) Add Prettier and automatic formatting on commit
- [#16](https://github.com/2listic/dealiiX-platform/pull/16) gitignore .vscode and .continue folders
- [#21](https://github.com/2listic/dealiiX-platform/pull/21) added husky to automatically lint on commit

### SSH

- [#71](https://github.com/2listic/dealiiX-platform/pull/71) Path to SSH private key is dinamically retrieved from localStorage

### Building

- [#12](https://github.com/2listic/dealiiX-platform/pull/12) Add electron-forge
- [#4](https://github.com/2listic/dealiiX-platform/pull/4) Add .deb distributable for Linux
- [#14](https://github.com/2listic/dealiiX-platform/pull/14) Add .dmg distributable for macOS

### CI/CD

- [#38](https://github.com/2listic/dealiiX-platform/pull/37) Distributables are now created for tagged versions only

### Testing

-
