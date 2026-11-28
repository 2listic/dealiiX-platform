# JavaScript protocol mock

Run the contract suite after installing the npm dependencies.

```sh
node --test test_files/protocol-mock/exchange.test.cjs
```

The tests invoke `backend.cjs --configuration PROFILE exchange` and validate
its JSON messages against the [protocol schemas](../../schemas/README.md).
The suite requires a successful exchange for every operation in the schema
and checks error cases including stale revisions and incompatible identities.

The fixture uses a profile with `backend.id` set to `mock` and a parameter tree
containing a `Greeting` leaf. `Editable: true` in that tree enables the optional
`configure` operation. The mock stores run snapshots beside the fixture profile
and advances the run deterministically when queried. It exercises typed
bindings, checked and produced files, nested CORAL registries, pause and resume,
cancellation, replay and chunked artifact responses without external solvers.

The original `backend.cjs -p REGISTRY register` mode copies the registry to
`node_types.json` for the legacy CORAL probe exercised by the editor tests.
