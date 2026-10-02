# Run Pipelines (local or remote)

A pipeline chains several runs into one job. Each run is a **stage**: a whole Coral graph or a standalone executable. An arrow from one stage to another means "run the second after the first has completed". Arrows only set the order: no files or values are passed between stages.

Pipelines run at the location selected in the top-right badge. Set up that location first, as for a single run, and click **Save & Sync** in Settings:

- local: [run-coral-local.md](run-coral-local.md), [run-executable-local.md](run-executable-local.md)
- remote: [run-coral-docker.md](run-coral-docker.md), [remote-setup.md](remote-setup.md), [run-executable-remote.md](run-executable-remote.md)

## Build a pipeline

Choose **pipeline** in the mode dropdown of the top-right badge. The sidebar's **Add stage** menu offers:

| Item           | Adds                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Coral (file)   | a Coral stage from a graph `.json` file                                                                  |
| Coral (canvas) | a Coral stage from the graph currently on the Coral canvas                                               |
| Executable     | an executable stage, starting with the executable path and parameters file name of the selected location |

Drag from a stage's right handle to another stage's left handle to make the second one wait for the first. A stage can wait for several stages, and the canvas refuses an arrow that would create a cycle.

Each stage card shows the stage id (`p0`, `p1`, …), an editable name and the run settings for that stage:

- **Use MPI** (Coral) or **Binary is MPI-enabled** (executable). With it on, a remote card asks for **Nodes** and **Tasks/node**, and a local card asks for **Processes**.
- **Time limit**, remote only.
- For an executable stage, the **Binary path** and **Load params…**, which loads a `.json` or `.prm` parameters file. Each executable stage needs its own parameters.

Coral stages always use the Coral binary and plugin configured in Settings for the location the pipeline runs on.

Use **Import / Export** → **Download pipeline** to save the pipeline as a file, and **Import pipeline** to load one.

## Run it

Click **Run**. The app checks the pipeline first: every Coral stage needs a graph, every executable stage needs a binary path and parameters, and remote stages need a valid time limit. Enter an optional run name and confirm.

Output goes to one folder per stage under the location's working directory:

```
<working directory>/pipeline-<run name or timestamp>/stage-<id>/
```

Notifications report each stage as it finishes, for example `mesh (stage p3, job 434): COMPLETED`. Stages run as soon as all the stages they wait for have completed, so independent branches run in parallel. A failed stage cancels every stage that waits for it, directly or indirectly; those stages never start, and their notification says that a parent stage did not complete.

## Local and remote differences

|                       | Local                                                                 | Remote                                                   |
| --------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| Who holds stages back | the app                                                               | Slurm (`--dependency=afterok`)                           |
| Closing the app       | stops the pipeline: stages that have not started never run            | the pipeline keeps running; the app only stops reporting |
| Waiting stages        | appear in the jobs table only once they start                         | appear in the jobs table as pending                      |
| Parallel stages       | all run at once on this machine, with no limit on the total processes | scheduled by Slurm                                       |

An executable stage's parameters come from the binary it was set up with. Running the pipeline at the other location checks that the binary path exists there, but not that the binary there accepts the same parameters.
