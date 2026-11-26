import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SCHEMAS = ROOT / "schemas"
EDGE = {"source": 0, "target": 1, "source_output": 0, "target_input": 0}
HANDLE = "%5B%22Solver%22%2C%22Tolerance%22%5D"


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path, data):
    Path(path).write_text(json.dumps(data, indent=2), encoding="utf-8")


DOCUMENTS = {path.name.removesuffix(".schema.json"): read_json(path)
             for path in SCHEMAS.glob("*.schema.json")}
SCHEMA_REGISTRY = Registry().with_resources(
    (document["$id"], Resource.from_contents(document)) for document in DOCUMENTS.values())


def errors(name, document):
    validator = Draft202012Validator(DOCUMENTS[name], registry=SCHEMA_REGISTRY)
    return [f"{error.json_path}: {error.message}" for error in validator.iter_errors(document)]


def leaf(value):
    return {"value": value, "default_value": value, "documentation": "",
            "pattern": "[Anything]", "pattern_description": "[Anything]"}


# Stands in for a CORAL binary. Its run fails unless the mock mirrors each status
# file into MOCK_TOUCH_DIR while the run is still going.
FAKE_CORAL = '''
import json, os, sys, time
from pathlib import Path

command = sys.argv[3]
if command == "register":
    entry = {"node_type": "elementary_constructor", "arguments": [], "inputs": [], "outputs": [-1], "value": ""}
    network = {"node_type": "network", "arguments": [], "inputs": [], "outputs": [], "value": {}}
    registry = {"std::string": {"type": "std::string", **entry},
                "child::only": {"type": "child::only", **entry},
                "coral::Network": {"type": "coral::Network", **network}}
    Path(sys.argv[sys.argv.index("--registry-path") + 1]).write_text(json.dumps(registry))
elif command == "run":
    status = Path(sys.argv[sys.argv.index("--touch-dir") + 1])
    graph = json.loads(Path(sys.argv[4]).read_text())
    if "EXPECTED_CORAL_MPI" in os.environ:
        assert graph["plugin"]["MPI"] == json.loads(os.environ["EXPECTED_CORAL_MPI"])
    for node in graph["workflow"]["nodes"].values():
        (status / (node["qualified_id"] + ".running")).touch()
        mirrored = Path(os.environ["MOCK_TOUCH_DIR"]) / (node["qualified_id"] + ".running")
        deadline = time.time() + 5
        while not mirrored.exists():
            if time.time() > deadline:
                sys.exit("status was not mirrored while CORAL was running")
            time.sleep(0.05)
        (status / (node["qualified_id"] + ".succeeded")).touch()
'''


class SchemaTest(unittest.TestCase):
    def test_schemas_are_valid_draft_2020_12(self):
        for document in DOCUMENTS.values():
            Draft202012Validator.check_schema(document)

    def test_examples_fit_their_schemas(self):
        cases = [
            ("parameters", HERE / "parameters.json"),
            ("registry", HERE / "registry.json"),
            ("network-execution", HERE / "network.json"),
            ("network-execution", HERE / "network-coral.json"),
            ("network-execution", HERE / "network-local-demo.json"),
            ("network-execution", HERE / "network-configurable-executable.json"),
            ("registry", SCHEMAS / "examples" / "registry-executables.json"),
            ("registry", SCHEMAS / "examples" / "registry-coral-network.json"),
            ("network", SCHEMAS / "examples" / "network-executables.json"),
        ]
        cases += [("network", path) for path in (ROOT / "examples" / "graphs").glob("*.json")]
        cases += [("parameters", path) for path in (ROOT / "examples" / "parameters").glob("*.json")]
        for name, path in cases:
            with self.subTest(example=str(path.relative_to(ROOT))):
                self.assertEqual(errors(name, read_json(path)), [])

    def test_example_network_names_the_example_registry(self):
        registry = read_json(SCHEMAS / "examples" / "registry-executables.json")
        network = read_json(SCHEMAS / "examples" / "network-executables.json")
        definitions = {key: value for key, value in registry.items() if not key.startswith("__")}
        text = json.dumps(definitions, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        digest = "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()
        self.assertEqual(registry["__backend"]["registry_digest"], digest)
        self.assertEqual(network["backend"]["registry_digest"], digest)

    def test_schemas_reject_malformed_documents(self):
        nodes = lambda document: document["workflow"]["nodes"]
        edges = lambda document: document["workflow"]["edges"]
        child = lambda document: nodes(document)["1"]["value"]["workflow"]["nodes"]["0"]
        cases = {
            "qualified_id with a dot": ("network", lambda d: nodes(d)["0"].update(qualified_id="1.0")),
            "numeric literal": ("network", lambda d: nodes(d)["0"].update(value=3)),
            "unknown node_type": ("network", lambda d: nodes(d)["0"].update(node_type="bogus")),
            "misspelt node field": ("network", lambda d: nodes(d)["0"].update(qualifed_id="0")),
            "network node_type without a workflow": ("network", lambda d: nodes(d)["0"].update(node_type="network")),
            "coral::Network without node_type": ("network", lambda d: nodes(d)["1"].pop("node_type")),
            "position as text": ("network", lambda d: nodes(d)["0"].update(position="0,0")),
            "non-numeric edge key": ("network", lambda d: edges(d).update(a=EDGE)),
            "edge port by index and handle": (
                "network", lambda d: edges(d).update({"0": {**EDGE, "source_handle": "parameter-output-" + HANDLE}})),
            "handle of the wrong direction": (
                "network", lambda d: edges(d).update(
                    {"0": {"source": 0, "target": 1, "source_handle": "parameter-input-" + HANDLE, "target_input": 0}})),
            "MPI flag as text": ("network", lambda d: d.update(plugin={"MPI": {"enabled": "yes"}})),
            "misspelt top-level field": ("network", lambda d: d.update(backnd={"id": "coral"})),
            "malformed registry digest": ("network", lambda d: d["backend"].update(registry_digest="abc")),
            "execution without qualified_id": ("network-execution", lambda d: nodes(d)["0"].pop("qualified_id")),
            "execution with a nested node without qualified_id": ("network-execution", lambda d: child(d).pop("qualified_id")),
            "execution with an edge by handle": (
                "network-execution", lambda d: edges(d).update(
                    {"0": {"source": 0, "target": 1, "source_output": 0, "target_handle": "parameter-input-" + HANDLE}})),
            "execution with parameter-file metadata": (
                "network-execution", lambda d: nodes(d)["0"].update(parameter_file={"exposures": []})),
        }
        network = read_json(HERE / "network.json")
        for label, (name, change) in cases.items():
            with self.subTest(case=label):
                document = copy.deepcopy(network)
                change(document)
                self.assertNotEqual(errors(name, document), [])

        registry = read_json(HERE / "registry.json")
        registry_cases = {
            "unknown metadata key": lambda d: d.update(__other={}),
            "numeric default literal": lambda d: d.update({"int": {
                "type": "int", "node_type": "elementary_constructor",
                "arguments": [], "inputs": [], "outputs": [-1], "value": 0}}),
            "network definition with a literal value": lambda d: d["coral::Network"].update(value="x"),
            "unknown x-dealiix field": lambda d: d["mock::add"]["x-dealiix"].update(command={}),
            "file output by argument and path": lambda d: d["mock::add"]["x-dealiix"].update(
                files={"outputs": [{"argument": "a", "path": "a", "media_type": "text/csv"}]}),
            "header without digest": lambda d: d.update(
                __backend={"id": "x", "version": "1", "operations": []}),
        }
        for label, change in registry_cases.items():
            with self.subTest(case=label):
                document = copy.deepcopy(registry)
                change(document)
                self.assertNotEqual(errors("registry", document), [])

        alias = {"Old name": {"alias": "New name", "deprecation_status": "false"}}
        self.assertNotEqual(errors("parameters", alias), [])


class ContractTest(unittest.TestCase):
    def invoke(self, directory, *args, configuration=HERE / "parameters.json", env=None):
        return subprocess.run(
            [sys.executable, HERE / "mock-backend", "-p", configuration, *args],
            cwd=directory, text=True, capture_output=True, env=env,
        )

    def error_code(self, result):
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        return json.loads(result.stderr)["error"]["code"]

    def test_local_coral_commands(self):
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            probe = self.invoke(work, "register")
            self.assertEqual(probe.returncode, 0, probe.stderr)
            registry = read_json(work / "node_types.json")
            self.assertEqual(errors("registry", registry), [])
            self.assertIn("mock::hello", registry)
            self.assertEqual(registry["__backend"]["operations"], ["register", "validate", "run"])
            run = self.invoke(work, "run", HERE / "network.json", "--touch-dir", "status",
                              "--register", "run-registry.json", "--graph", "run.dot")
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertEqual(run.stdout.splitlines(), ["[0] Hello World", "[1_0] 4"])
            self.assertTrue((work / "status/1_0.succeeded").is_file())
            self.assertTrue((work / "run.dot").is_file())
            self.assertEqual(read_json(work / "run-registry.json"), registry)

    def test_node_configuration_overrides_the_backend_parameters(self):
        network = read_json(HERE / "network.json")
        network["workflow"]["nodes"]["0"]["configuration"] = {"Greeting": leaf("Ciao")}
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            write_json(work / "network.json", network)
            run = self.invoke(work, "run", work / "network.json")
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertEqual(run.stdout.splitlines()[0], "[0] Ciao")

    def test_invalid_network_is_rejected_before_execution(self):
        network = read_json(HERE / "network.json")
        network["workflow"]["edges"]["0"] = {**EDGE, "target": 99}
        unmaterialized = read_json(HERE / "network.json")
        unmaterialized["workflow"]["edges"]["0"] = {
            "source": 0, "target": 1, "source_output": 0, "target_handle": "parameter-input-" + HANDLE}
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            for document, code in ((network, "invalid_edge"), (unmaterialized, "invalid_network")):
                write_json(work / "invalid.json", document)
                for operation in ("validate", "run"):
                    with self.subTest(code=code, operation=operation):
                        self.assertEqual(self.error_code(self.invoke(work, operation, work / "invalid.json")), code)
            self.assertEqual(list(work.glob("*.running")), [])

    def test_network_built_against_another_registry_is_stale(self):
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            self.assertEqual(self.invoke(work, "register").returncode, 0)
            current = read_json(work / "node_types.json")["__backend"]["registry_digest"]
            network = read_json(HERE / "network.json")
            for digest, expected in ((current, None), ("sha256:" + "0" * 64, "stale_registry")):
                network["backend"] = {"id": "dealiix.mock", "registry_digest": digest}
                write_json(work / "network.json", network)
                result = self.invoke(work, "validate", work / "network.json")
                with self.subTest(digest=digest):
                    if expected is None:
                        self.assertEqual(result.returncode, 0, result.stderr)
                    else:
                        self.assertEqual(self.error_code(result), expected)
            network["backend"] = {"id": "coral"}
            write_json(work / "network.json", network)
            self.assertEqual(self.error_code(self.invoke(work, "validate", work / "network.json")),
                             "incompatible_backend")

    def test_migration_is_reported_as_unsupported(self):
        with tempfile.TemporaryDirectory() as directory:
            result = self.invoke(Path(directory), "migrate", HERE / "network.json")
            self.assertEqual(self.error_code(result), "unsupported_operation")

    def test_configured_local_executable_writes_an_artifact_and_reports_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            configuration = read_json(HERE / "parameters.json")
            configuration["Executables"] = {"test": {
                "Binary": leaf(sys.executable),
                "Arguments": leaf(json.dumps([
                    "-c", "from pathlib import Path; import sys; Path('result.txt').write_text(sys.argv[1]); sys.exit(int(sys.argv[2]))",
                ])),
                "InputTypes": leaf(json.dumps(["std::string", "int"])),
            }}
            path = work / "parameters.json"
            write_json(path, configuration)
            probe = self.invoke(work, "register", configuration=path)
            self.assertEqual(probe.returncode, 0, probe.stderr)
            node_type = "mock::exec::test"
            entry = read_json(work / "node_types.json")[node_type]
            self.assertEqual(entry["x-dealiix"]["execution"]["kind"], "executable")
            self.assertEqual(entry["inputs"], [0, 1])
            nodes = {
                "0": {"type": node_type, "qualified_id": "0"},
                "1": {"type": "std::string", "qualified_id": "1", "value": "two words; one argument"},
                "2": {"type": "int", "qualified_id": "2", "value": "0"},
            }
            wire = {"source_output": 0, "target": 0}
            edges = {
                "0": {**wire, "source": 1, "target_input": 0},
                "1": {**wire, "source": 2, "target_input": 1},
            }
            network = {"workflow": {"nodes": nodes, "edges": edges}}
            graph = work / "network.json"
            write_json(graph, network)
            run = self.invoke(work, "run", graph, "--touch-dir", "success", configuration=path)
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertEqual((work / "result.txt").read_text(), "two words; one argument")
            self.assertTrue((work / "success/0.succeeded").is_file())

            nodes["2"]["value"] = "3"
            write_json(graph, network)
            run = self.invoke(work, "run", graph, "--touch-dir", "failure", configuration=path)
            self.assertNotEqual(run.returncode, 0)
            self.assertEqual(json.loads(run.stderr)["error"]["code"], "executable_failed")
            self.assertTrue((work / "failure/0.failed").is_file())

            del edges["1"]
            write_json(graph, network)
            invalid = self.invoke(work, "validate", graph, configuration=path)
            self.assertEqual(json.loads(invalid.stderr)["error"]["code"], "missing_argument")

    def test_executable_node_expands_parameters_into_single_arguments(self):
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            network = read_json(HERE / "network-configurable-executable.json")
            node = network["workflow"]["nodes"]["0"]
            node["configuration"]["executable"] = leaf(str(HERE / "example-local-executable"))
            node["configuration"]["arg1"] = leaf("two words; literal")
            path = work / "graph.json"
            write_json(path, network)

            validation = self.invoke(work, "validate", path)
            self.assertEqual(validation.returncode, 0, validation.stderr)
            self.assertFalse((work / "local-executable.txt").exists())
            run = self.invoke(work, "run", path, "--touch-dir", "status")
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertEqual((work / "local-executable.txt").read_text().splitlines(),
                             ["--arg1", "two words; literal", "arg2", "ACTION", "arg3"])
            self.assertTrue((work / "status/0.succeeded").is_file())

            node["configuration"]["command"]["value"] = "config.executable config.missing"
            write_json(path, network)
            invalid = self.invoke(work, "validate", path)
            self.assertNotEqual(invalid.returncode, 0)
            self.assertEqual(json.loads(invalid.stderr)["error"]["code"], "invalid_configuration")
            self.assertIn("config.missing", invalid.stderr)

    def test_delegated_child_reports_status_while_it_runs(self):
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            coral = work / "coral"
            coral.write_text(f"#!{sys.executable}\n{FAKE_CORAL}", encoding="utf-8")
            coral.chmod(0o755)
            configuration = read_json(HERE / "parameters.json")
            configuration["CORAL"] = {
                "Binary": leaf(str(coral)), "Plugin": leaf(str(coral)), "MPIEnabled": leaf("true")
            }
            write_json(work / "parameters.json", configuration)
            probe = self.invoke(work, "register", configuration=work / "parameters.json")
            self.assertEqual(probe.returncode, 0, probe.stderr)
            registry = read_json(work / "node_types.json")
            self.assertNotIn("child::only", registry)
            self.assertIn("child::only", registry["network::coral"]["value"]["registry"])
            self.assertEqual(errors("registry", registry), [])
            status = work / "status"
            env = {**os.environ, "MOCK_TOUCH_DIR": str(status),
                   "EXPECTED_CORAL_MPI": json.dumps({"enabled": True})}
            run = self.invoke(work, "run", HERE / "network-coral.json", "--touch-dir", "status",
                              configuration=work / "parameters.json", env=env)
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertEqual(run.stdout.splitlines(), ["[0] Hello World"])
            for name in ("0.succeeded", "1.succeeded", "1_0.running", "1_0.succeeded"):
                self.assertTrue((status / name).is_file(), name)

            override = read_json(HERE / "network-coral.json")
            mpi = {"enabled": False, "max_num_threads": 2}
            override["workflow"]["nodes"]["1"]["value"]["plugin"] = {"MPI": mpi}
            path = work / "override.json"
            write_json(path, override)
            env.update(MOCK_TOUCH_DIR=str(work / "override"), EXPECTED_CORAL_MPI=json.dumps(mpi))
            run = self.invoke(work, "run", path, "--touch-dir", "override",
                              configuration=work / "parameters.json", env=env)
            self.assertEqual(run.returncode, 0, run.stderr)


if __name__ == "__main__":
    unittest.main()
