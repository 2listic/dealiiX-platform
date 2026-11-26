"""Exercise the CLI using real local executables and isolated run directories."""

import json
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

from execution import stream_copy
from protocol import leaf, read, write

CLI = Path(__file__).with_name("orchestrator")


def stage(name, **fields):
    return {"type": f"orchestrator::{name}", "node_type": "void_function", **fields}


def linkage(source, target):
    return {"source": source, "target": target, "source_output": 0, "target_input": 0}


def file_node(
    path,
    *,
    input_file=False,
    output_file=False,
    optional=False,
    location="workdir",
    kind="GenericFile",
    target="auto",
):
    return stage(
        kind,
        configuration={
            key: leaf(value, "[Anything]", "")
            for key, value in {
                "path": path,
                "input_file": str(input_file).lower(),
                "output_file": str(output_file).lower(),
                "optional": str(optional).lower(),
                "location": location,
                **({"target": target} if kind != "GenericFile" else {}),
            }.items()
        },
    )


def file_edge(source, target, *, produced):
    return {
        **linkage(source, target),
        "source_output": 1 if produced else 0,
        "target_input": 0 if produced else 1,
    }


class OrchestratorTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="orchestrator-tests-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.runs = self.root / "records"
        self.jobs = self.root / "execution"
        self.config = self.root / "backend.config.json"
        self.network = self.root / "network.json"
        self.write_target("Success", 'cp "$1" copied.json\n', "parameters.json")
        self.write_target("Failure", "exit 3\n")
        self.write_target("Slow", "sleep 30\n")

    def write_target(self, name, script, filename="", argv=None):
        program = self.root / name
        program.write_text("#!/bin/sh\n" + script)
        program.chmod(0o700)
        data = (
            read(self.config)
            if self.config.exists()
            else {
                "runs_directory": leaf(str(self.runs), "[DirectoryName]", ""),
            }
        )
        data[name] = {
            "binary": leaf(str(program), "[FileName]", ""),
            "working_directory": leaf(str(self.jobs), "[DirectoryName]", ""),
            "parameter_file": leaf(filename, "[Anything]", ""),
        }
        if argv is not None:
            data[name]["argv"] = {
                index: leaf(argument, "[Anything]", "")
                for index, argument in argv.items()
            }
        write(self.config, data)

    def write_graph(self, nodes, edges):
        write(
            self.network,
            {
                "backend": {"id": "orchestrator"},
                "workflow": {"nodes": nodes, "edges": edges},
            },
        )

    def invoke(self, *args, success=True):
        result = subprocess.run(
            [
                sys.executable,
                str(CLI),
                "--configuration",
                str(self.config),
                *map(str, args),
            ],
            cwd=self.root,
            capture_output=True,
            check=False,
            text=True,
            timeout=15,
        )
        if success:
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout) if result.stdout else None
        self.assertNotEqual(result.returncode, 0, result.stdout)
        return json.loads(result.stderr)["error"]

    def test_registry_and_materialized_program(self):
        self.invoke("register")
        registry = read(self.root / "node_types.json")
        self.assertEqual(registry["__backend"]["id"], "orchestrator")
        self.assertEqual(
            registry["__backend"]["capabilities"],
            {"actions": ["configure"], "configuration_exposable": False},
        )
        self.assertEqual(
            registry["orchestrator::Success"]["capabilities"],
            {"actions": ["configure"], "configuration_exposable": False},
        )
        tree = {"Degree": leaf("3", "[Integer]", "")}
        self.write_graph(
            {"0": stage("Success", configuration={"parameters": tree})}, {}
        )
        self.assertEqual(self.invoke("validate", self.network), {"valid": True})
        touch = self.root / "touch"
        result = self.invoke("run", self.network, "--touch-dir", touch)
        self.assertTrue((touch / "0.succeeded").is_file())
        directory = Path(result["nodes"]["0"]["directory"])
        self.assertEqual(read(directory / "copied.json"), tree)
        self.assertEqual(
            self.invoke("outputs", result["run_id"])["outputs"], {"0": ["copied.json"]}
        )

    def test_configured_arguments_use_target_paths_and_preserve_boundaries(self):
        self.jobs = self.root.resolve() / "execution with spaces"
        self.write_target(
            "Flags",
            "set -eu\n"
            'test "$#" -eq 5\n'
            'test "$1" = --parameters\n'
            'test "$2" = "$PWD/parameters.json"\n'
            'test "$3" = --working-directory\n'
            'test "$4" = "$PWD"\n'
            'test "$5" = "literal with spaces; still one argument"\n'
            'cp "$2" copied.json\n',
            "parameters.json",
            argv={
                "3": "{run_directory}",
                "0": "--parameters",
                "4": "literal with spaces; still one argument",
                "2": "--working-directory",
                "1": "{parameters_file}",
            },
        )
        self.write_target("NoArgs", 'test "$#" -eq 0\n', "parameters.json", argv={})
        self.write_graph({"0": stage("Flags"), "1": stage("NoArgs")}, {})
        result = self.invoke("run", self.network)
        directory = Path(result["nodes"]["0"]["directory"])
        self.assertEqual(read(directory / "copied.json"), {})
        self.assertEqual(len(result["nodes"]["1"]["argv"]), 1)

    def test_invalid_argument_configuration_is_rejected(self):
        for argv, message in [
            ({"1": "--flag"}, "indexed consecutively from 0"),
            ({"0": "{parameters_file}"}, "parameter_file is empty"),
        ]:
            with self.subTest(argv=argv):
                self.write_target("Invalid", "exit 0\n", argv=argv)
                error = self.invoke("register", success=False)
                self.assertEqual(error["code"], "invalid_configuration")
                self.assertIn(message, error["message"])

    def test_failed_predecessor_and_independent_branch(self):
        self.write_graph(
            {"0": stage("Failure"), "1": stage("Slow"), "2": stage("Success")},
            {"0": linkage(0, 1)},
        )
        error = self.invoke("run", self.network, success=False)
        self.assertEqual(error["code"], "run_failed")
        state = self.invoke("status", error["run_id"])
        self.assertEqual(
            [state["nodes"][k]["state"] for k in ("0", "1", "2")],
            ["failed", "cancelled", "succeeded"],
        )
        self.assertEqual(state["nodes"]["0"]["exit_code"], 3)

    def test_cyclic_network_is_rejected_before_launch(self):
        self.write_graph(
            {"0": stage("Slow"), "1": stage("Slow")},
            {"0": linkage(0, 1), "1": linkage(1, 0)},
        )
        error = self.invoke("submit", self.network, success=False)
        self.assertEqual(error["code"], "cyclic_network")
        self.assertFalse(self.runs.exists())

    def test_required_external_input_and_optional_output(self):
        self.write_target(
            "Check", 'test "$(cat "$1")" = mesh', argv={"0": "{input:mesh.msh}"}
        )
        nodes = {
            "0": stage("Check"),
            "1": file_node("mesh.msh", input_file=True),
            "2": file_node(
                "extra.vtk", output_file=True, optional=True, location="rundir"
            ),
            "3": file_node("optional.data", input_file=True, optional=True),
        }
        self.write_graph(
            nodes,
            {
                "0": file_edge(1, 0, produced=False),
                "1": file_edge(0, 2, produced=True),
                "2": file_edge(3, 0, produced=False),
            },
        )
        error = self.invoke("validate", self.network, success=False)
        self.assertEqual(error["code"], "missing_input")
        self.jobs.mkdir()
        (self.jobs / "mesh.msh").write_text("mesh")
        self.assertEqual(self.invoke("validate", self.network), {"valid": True})
        self.assertEqual(self.invoke("run", self.network)["state"], "succeeded")

    def test_rundir_handoff_and_validation_on_every_run(self):
        self.write_target(
            "Produce", 'printf mesh > "$1"', argv={"0": "{output:files/mesh.msh}"}
        )
        consumer_dir = self.root / "separate consumer"
        self.write_target(
            "Consume", 'test "$(cat "$1")" = mesh', argv={"0": "{input:files/mesh.msh}"}
        )
        config = read(self.config)
        config["Consume"]["working_directory"]["value"] = str(consumer_dir)
        write(self.config, config)
        nodes = {
            "0": stage(
                "Produce",
                configuration={"run_policy": leaf("if_missing", "[Anything]", "")},
            ),
            "1": file_node(
                "files/mesh.msh", input_file=True, output_file=True, location="rundir"
            ),
            "2": stage("Consume"),
        }
        self.write_graph(
            nodes,
            {"0": file_edge(0, 1, produced=True), "1": file_edge(1, 2, produced=False)},
        )
        self.assertEqual(self.invoke("validate", self.network), {"valid": True})
        first = self.invoke("run", self.network)
        second = self.invoke("run", self.network)
        path = first["nodes"]["0"]["declared_outputs"]["files/mesh.msh"]
        self.assertEqual(first["nodes"]["2"]["argv"][-1], path)
        self.assertEqual(Path(path).read_text(), "mesh")
        self.assertNotEqual(
            path, second["nodes"]["0"]["declared_outputs"]["files/mesh.msh"]
        )

    def test_missing_output_fails_an_exit_zero_stage_and_blocks_consumer(self):
        self.write_target("NoOutput", "exit 0")
        nodes = {
            "0": stage("NoOutput"),
            "1": file_node(
                "mesh.msh", input_file=True, output_file=True, location="rundir"
            ),
            "2": stage("Slow"),
            "3": stage("Success"),
        }
        self.write_graph(
            nodes,
            {"0": file_edge(0, 1, produced=True), "1": file_edge(1, 2, produced=False)},
        )
        failure = self.invoke("run", self.network, success=False)
        self.assertIn("required output was not created", failure["message"])
        self.assertIn("mesh.msh", failure["message"])
        nodes = self.invoke("status", failure["run_id"])["nodes"]
        self.assertEqual(nodes["0"]["exit_code"], 0)
        self.assertEqual(nodes["0"]["error"]["code"], "missing_output")
        self.assertEqual(nodes["1"]["state"], "failed")
        self.assertEqual(nodes["2"]["state"], "cancelled")
        self.assertEqual(nodes["3"]["state"], "succeeded")

    def test_permanent_output_is_published_once_and_reused(self):
        self.write_target(
            "Produce", 'printf permanent > "$1"', argv={"0": "{output:mesh.msh}"}
        )
        nodes = {
            "0": stage(
                "Produce",
                configuration={"run_policy": leaf("if_missing", "[Anything]", "")},
            ),
            "1": file_node("mesh.msh", output_file=True),
        }
        edges = {"0": file_edge(0, 1, produced=True)}
        self.write_graph(nodes, edges)
        first = self.invoke("run", self.network)
        second = self.invoke("run", self.network)
        final = self.jobs / "mesh.msh"
        self.assertEqual(
            first["nodes"]["0"]["declared_outputs"], {"mesh.msh": str(final)}
        )
        self.assertEqual(
            self.invoke("outputs", second["run_id"])["outputs"], {"0": [str(final)]}
        )
        self.assertTrue(second["nodes"]["0"]["reused"])

        self.write_target(
            "Produce", 'printf replacement > "$1"', argv={"0": "{output:mesh.msh}"}
        )
        self.write_graph({**nodes, "0": stage("Produce")}, edges)
        failure = self.invoke("run", self.network, success=False)
        state = self.invoke("status", failure["run_id"])
        self.assertEqual(state["nodes"]["0"]["error"]["code"], "output_publish_failed")
        self.assertEqual(final.read_text(), "permanent")

    def test_validates_file_dependencies_and_argv_bindings(self):
        self.write_graph(
            {
                "0": stage("Success"),
                "1": file_node(
                    "mesh.msh", input_file=True, output_file=True, location="rundir"
                ),
            },
            {"0": file_edge(0, 1, produced=True), "1": file_edge(1, 0, produced=False)},
        )
        error = self.invoke("validate", self.network, success=False)
        self.assertEqual(error["code"], "cyclic_network")
        self.write_target("NoBinding", "exit 0", argv={"0": "{input:mesh.msh}"})
        self.write_graph({"0": stage("NoBinding")}, {})
        error = self.invoke("validate", self.network, success=False)
        self.assertEqual(error["code"], "unbound_file")

    def test_local_transfer_can_use_a_file_only_configuration(self):
        config = read(self.config)
        write(self.config, {"runs_directory": config["runs_directory"]})
        file_folder = self.runs / "files"
        file_folder.mkdir(parents=True)
        contents = bytes([0, 255]) + b"binary data\n"
        (file_folder / "seed file.dat").write_bytes(contents)
        self.invoke("register")
        registry = read(self.root / "node_types.json")
        for node_type in ("LocalFile", "RemoteFile", "Transfer"):
            self.assertIn(f"orchestrator::{node_type}", registry)
        self.write_graph(
            {
                "0": file_node("seed file.dat", input_file=True, kind="LocalFile"),
                "1": stage("Transfer"),
                "2": file_node(
                    "out/copy.dat",
                    output_file=True,
                    location="rundir",
                    kind="LocalFile",
                ),
            },
            {"0": linkage(0, 1), "1": linkage(1, 2)},
        )
        result = self.invoke("run", self.network)
        copied = Path(result["nodes"]["1"]["declared_outputs"]["out/copy.dat"])
        self.assertEqual(copied.read_bytes(), contents)
        self.assertEqual(result["nodes"]["1"]["commands"][0][0], "cp")

    def test_stream_copy_reports_failure_on_either_side(self):
        directory = self.root / "stage"
        directory.mkdir()
        copied = directory / "copied"
        reader = [
            sys.executable,
            "-c",
            "import sys; sys.stdout.write('partial'); sys.exit(7)",
        ]
        writer = [
            sys.executable,
            "-c",
            "import sys; from pathlib import Path; Path(sys.argv[1]).write_bytes(sys.stdin.buffer.read())",
            str(copied),
        ]
        self.assertEqual(stream_copy([reader, writer], directory), 7)

        reader = [sys.executable, "-c", "import time; time.sleep(60)"]
        writer = [sys.executable, "-c", "import sys; sys.exit(8)"]
        self.assertEqual(stream_copy([reader, writer], directory), 8)

    def test_transfer_rejects_missing_destination_and_legacy_file_at_its_boundary(self):
        nodes = {
            "0": file_node("source", input_file=True, kind="LocalFile"),
            "1": stage("Transfer"),
        }
        self.write_graph(nodes, {"0": linkage(0, 1)})
        error = self.invoke("validate", self.network, success=False)
        self.assertEqual(error["code"], "invalid_file")
        self.assertIn("requires one source", error["message"])
        nodes["0"] = file_node("source", input_file=True)
        nodes["2"] = file_node("out", output_file=True, kind="LocalFile")
        self.write_graph(nodes, {"0": linkage(0, 1), "1": linkage(1, 2)})
        error = self.invoke("validate", self.network, success=False)
        self.assertIn("use LocalFile or RemoteFile", error["message"])

    def test_cancel_a_detached_run(self):
        self.write_graph({"0": stage("Slow")}, {})
        result = self.invoke("submit", self.network)
        run_id = result["run_id"]
        self.addCleanup(self.invoke, "cancel", run_id)
        deadline = time.monotonic() + 10
        while self.invoke("status", run_id)["nodes"]["0"]["state"] != "running":
            self.assertLess(time.monotonic(), deadline)
            time.sleep(0.05)
        self.invoke("cancel", run_id)
        while True:
            result = self.invoke("status", run_id)
            if result["state"] == "cancelled":
                break
            self.assertLess(time.monotonic(), deadline)
            time.sleep(0.05)
        self.assertEqual(result["nodes"]["0"]["state"], "cancelled")


if __name__ == "__main__":
    unittest.main()
