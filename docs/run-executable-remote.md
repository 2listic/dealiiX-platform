# Run a Custom Executable Remotely (SSH)

This approach uses the **remote + executable** execution mode to run any deal.II-based program that follows the DealiiX executable contract on a remote machine over SSH — without Coral as an intermediary.

The contract is simple: when called with a JSON file path that **does not exist**, the binary writes a JSON template with all parameters and exits. When the file **exists**, it reads it and runs the simulation.

## Prerequisites

- SSH access to the remote machine
- The deal.II executable already built and accessible on the remote machine
- A public/private SSH key pair configured for passwordless access

## Configure the app

Open **Settings** and set the following:

**Execution Mode**

| Setting                 | Value                                                  |
| ----------------------- | ------------------------------------------------------ |
| Location                | `remote`                                               |
| Backend kind            | `executable`                                           |
| Host                    | hostname or IP of the remote machine                   |
| Port                    | SSH port (typically `22`)                              |
| Username                | SSH username                                           |
| Path to private SSH key | local path to your private key                         |
| Working directory       | writable directory on the remote machine               |
| Executable path         | full path to the executable on the remote machine      |
| Parameters file name    | `parameters.json` (generated on first probe if absent) |

Click **Save & Sync Execution** — the app probes the remote binary via SSH, reads back the JSON parameter template, and populates the Parameters panel as an editable tree. Edit the values as needed, then click **Execute** to run the simulation remotely.

## How it works

1. **Probe**: the app SSHs into the remote machine and runs the executable with the parameters file path. If the file does not exist, the executable writes the JSON template and exits; the app reads it back and shows the parameter tree.
2. **Execute**: the app writes the edited parameters JSON to the working directory over SSH and runs the executable. Output files produced by the simulation are written to the same working directory on the remote machine.
