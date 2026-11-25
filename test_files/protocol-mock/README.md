# Register-only protocol fixture

This fixture demonstrates the registry exchange described in the
[protocol v1 reference](../../schemas/README.md). It runs with Node.js and
implements `-p REGISTRY register`, which copies the specified JSON file to
`node_types.json` in the configured working directory. Other operations,
including `run`, exit with status 2.

## Load the example graph

1. Select **local** and **coral** with the execution selectors in Platform.
2. In **Settings → Execution**, choose an empty scratch directory as the
   working directory. Set **Coral binary path** to the absolute path of
   [backend.cjs](backend.cjs) and **Coral plugin path** to the absolute path of
   [registry.json](registry.json).
3. Click **Validate & Sync**, then close Settings.
4. Choose **Import / Export → Import Graph** and open
   [network.json](network.json). The canvas should show a string connected to
   a `mock::sink` node. Downloading the graph after sync includes the
   `backend` identity published by the registry.

## Run the integration test

From the repository root after `npm ci`:

```sh
npm test -- src/lib/testing/protocolMock.test.ts
```

The test invokes the local CORAL probe, imports the graph using the returned
registry, checks the nodes, edge and exported identity, and verifies the
mock's rejection of `run`. GitHub Actions runs it as part of `npm test`.
