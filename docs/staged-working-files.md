# Staged working files

CORAL graph inputs can declare that a string is a persistent working-file
reference. The registry puts the metadata on the target argument:

```json
{
  "connection_type": "input",
  "name": "parameters",
  "type": "std::string",
  "file_scope": "working",
  "staging": "copy",
  "create_if_missing": true
}
```

The declaration is explicit. A string is not treated as a staged file merely
because its value looks like a filename or because a file with that name
exists.

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

The frontend accepts and preserves these optional argument fields in the
registry. A Coral registry producer must emit the metadata for a target input
before the platform can apply the staged-file behaviour; no node-name or
`ParameterAcceptor` special case is used here.
