# Staged working files

Parameter-file graph inputs are identified by their `.prm` or `.json`
extension. They do not depend on registry metadata: an existing parameter
file is copied into the isolated run directory, while a missing file is either
created in the working directory or rejected according to the optional
`create_if_missing` graph flag.

When a graph string is recognised as a `.prm` or `.json` parameter filename,
its node action opens the parameter editor if the file exists in the configured
working directory. If it does not exist, the same action opens a creation
dialog. Saving that dialog stores only the optional `create_if_missing` flag
on the graph value:

```json
{
  "type": "std::string",
  "value": "configs/parameters.prm",
  "working_file": {
    "create_if_missing": true
  }
}
```

At execution time the platform treats the configured working directory as the
persistent, user-editable source and the run directory as a per-run snapshot:

```text
working/configs/parameters.prm
        │
        │ copy before the run
        ▼
working/run-42/configs/parameters.prm
```

The graph sent to CORAL keeps the logical relative path
`configs/parameters.prm`. Coral runs with the run directory as its current
directory, so the application opens the staged snapshot without knowing about
the platform's working-directory setting. Relative subdirectories are
preserved, and repeated references to the same source are copied once per run.

If the persistent file is missing and `create_if_missing` is `true`, the first
attempt does not create an empty file. The graph value is changed to the
absolute persistent path, for example `/work/configs/parameters.prm`, so the
backend or application can materialize its default there. A later run sees the
file in the working directory, copies it into its own run directory, and sends
the relative logical path again. If `create_if_missing` is `false`, execution
stops with an error naming the missing persistent path.

Local runs copy files through the Electron main process with the local
filesystem. Remote runs create parent directories and use a safely quoted
server-side `cp` command over SSH; file contents are not downloaded to the
desktop and uploaded again.

Only the `create_if_missing` flag is persisted as graph metadata. The staging
decision itself is based on the parameter-file extension and the existence
check, not on backend registry fields.
