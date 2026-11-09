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

## A missing file

A parameter file must exist before it is used. When **Use as parameter file** cannot find the file, it asks: "Not found at <full path>. A parameter file must exist before it can be used: upload a local file to save there?"

**Upload a local file…** opens a file picker. The picked file is saved at that full path, then opens in the editor, and the node is marked like an existing file. A file in the other format (JSON content for a `.prm` node, or the reverse) is rejected with an error, and the node stays unmarked.

Cancel leaves the node unmarked and shows the error.

A marked file that is missing at submit stops the submission, with an error naming its path.
