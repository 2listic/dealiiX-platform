# Parameter files in runs

A string node naming a `.prm` or `.json` file becomes a parameter file when you click **Use as parameter file** on it. The graph saves this as a `parameter_file` marker on the node. Only marked nodes are treated as parameter files; the file extension only offers the button.

## Each run gets its own copy

The file in the configured working directory is the source you edit in the parameter editor. At submit, each marked file is copied into the run folder, keeping its relative path, with the values connected to its exposed inputs written in. Coral receives the copy's absolute path, so the run reads the parameters as they were at submit and the source stays unchanged.

```text
/work/my-subfolder/poisson_2d.prm            source, edited in the parameter editor
        │  copied at submit, connected values written in
        ▼
/work/run-42/my-subfolder/poisson_2d.prm     what Coral reads
```

An unmarked string naming an existing file in the working directory is passed by that file's absolute path, without a copy.

## Creating a missing file on the first run

When **Use as parameter file** cannot find the file, it asks: "Not found at <full path>. Create its defaults on the first run, or upload a local file to save there?"

**Upload a local file…** opens a file picker. The picked file is saved at that full path, then opens in the editor, and the node is marked like an existing file. A file in the other format (JSON content for a `.prm` node, or the reverse) is rejected with an error, and the node stays unmarked.

**Create on first run** marks the node without opening the editor:

```json
{
  "type": "std::string",
  "value": "my-subfolder/poisson_2d.prm",
  "parameter_file": { "exposures": [], "create_if_missing": true }
}
```

Cancel leaves the node unmarked and shows the error.

While the file is missing, a run passes its absolute path in the working directory, `/work/my-subfolder/poisson_2d.prm`, so the backend writes its defaults there. ImmersX's "Initialize parameters" node creates the file and its folder, then runs the graph with the defaults; it also writes `poisson_2d_used.prm` next to the file. A backend that only uses deal.II's `ParameterAcceptor` writes the defaults and stops the run. Runs submitted before the first one has created the file all write the defaults to the same path.

Once the file exists, it can be opened in the editor, and each run copies it like any other parameter file.

A missing file stops the submission, with an error naming its path, when the node has exposed parameters (there is no file to write their values into) or was marked without `create_if_missing`.
