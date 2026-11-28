"""Exercise the CLI using real local executables and isolated run directories."""

import json
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from urllib.parse import quote

from execution import (
    Machine, SlurmHold, materialize, slurm_input_failure, stage_argv, stream_copy,
    submit_slurm, sync_slurm_hold,
)
from file_artifacts import resolve_references
from protocol import FileBinding, Stage, configuration, describe, leaf, read, write

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

    def exchange(self, operation, **fields):
        result = subprocess.run(
            [sys.executable, str(CLI), "--configuration", str(self.config), "exchange"],
            input=json.dumps({"version": "1.1", "operation": operation, **fields}),
            cwd=self.root, capture_output=True, text=True, check=False, timeout=15,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_tagged_backend_settings_preserve_revision_and_reject_other_backends(self):
        settings = read(self.config)
        legacy = self.exchange("describe")["result"]["__backend"]["configuration_digest"]
        write(self.config, {"backend": {"id": "orchestrator"}, "configuration": settings})
        tagged = self.exchange("describe")["result"]["__backend"]["configuration_digest"]
        self.assertEqual(tagged, legacy)

        for identity in (
            {"id": "coral"},
            {"id": "orchestrator", "plugin": "other"},
            {"id": "orchestrator", "version": "wrong"},
        ):
            with self.subTest(identity=identity):
                write(self.config, {"backend": identity, "configuration": settings})
                self.assertEqual(self.exchange("describe")["error"]["code"], "incompatible_backend")

    def test_coral_application_owns_mpi_launch(self):
        tree = read(self.config)
        tree["Coupling"] = {
            name: leaf(value, "[Anything]", "")
            for name, value in {
                "binary": "/opt/coral/bin/coral",
                "working_directory": str(self.jobs),
                "plugin": "/opt/coral/lib/coupling.so",
                "mpi_mode": "application",
                "mpi_launcher": "/bin/echo",
            }.items()
        }
        target = configuration(tree).targets["orchestrator::Coupling"]
        child = {"workflow": {"nodes": {}, "edges": {}}}
        node = {"type": "orchestrator::Coupling", "value": child}
        coupling = Stage("0", "0", target, node, {}, (True, 4, 1, "", ""))
        argv = stage_argv(coupling, str(self.jobs))
        self.assertIn("DEALIIX_MPI_ENABLED=true", argv)
        self.assertIn("DEALIIX_MPI_PROCESSES=4", argv)
        self.assertIn("DEALIIX_MPI_LAUNCHER=/bin/echo", argv)
        self.assertEqual(argv[4:9], [target.binary, "-p", target.plugin, "run", "network.json"])
        artifacts = materialize(coupling, {}, set())
        self.assertFalse(json.loads(artifacts["network.json"])["plugin"]["MPI"]["enabled"])

        coupling.resources = (False, 4, 1, "", "")
        argv = stage_argv(coupling, str(self.jobs))
        self.assertIn("DEALIIX_MPI_ENABLED=false", argv)
        self.assertIn("DEALIIX_MPI_PROCESSES=1", argv)

    def test_workflow_archive_and_runtime_directory_keywords(self):
        archive = self.root / "workflow archive"
        archive.mkdir()
        tree = read(self.config)
        tree["workflow_locations"] = {
            "shared": {"directory": leaf(str(archive), "[Anything]", ""),
                       "writable": leaf("true", "[Bool]", "")},
        }
        target = tree["Success"]
        target["argv"] = {
            str(index): leaf(value, "[Anything]", "")
            for index, value in enumerate(["{workdir}", "{rundir}", "{workflowdir}"])
        }
        write(self.config, tree)
        header = self.exchange("describe")["result"]["__backend"]
        self.assertEqual(header["workflow_locations"], [{"id": "shared", "label": "shared", "writable": True}])
        self.assertEqual(header["path_variables"], ["workdir", "rundir", "workflowdir"])
        params = {"location_id": "shared", "configuration_digest": header["configuration_digest"]}
        write(archive / "backend-settings.json", {"configuration": {}})
        self.assertEqual(self.exchange("list_workflows", **params)["result"]["entries"], [])
        params["workflow_name"] = "example.json"
        self.write_graph({"0": stage("Success")}, {})
        document = read(self.network)
        saved = self.exchange("write_workflow", **params, network=document, expected_revision=None)["result"]
        self.assertEqual(self.exchange("read_workflow", **params)["result"], {**saved, "network": document})
        self.assertEqual(self.exchange("write_workflow", **params, network=document, expected_revision=None)["error"]["code"],
                         "workflow_conflict")

        config = configuration(tree)
        resolved_target = config.targets["orchestrator::Success"]
        self.assertEqual(resolved_target.workflow_directory, str(archive))
        stage_plan = Stage("0", "0", resolved_target, document["workflow"]["nodes"]["0"], {}, (False, 1, 1, "", ""))
        run = "run-test"
        artifacts, argv = resolve_references(
            stage_plan, {"input.prm": "set root = {workflowdir}"}, stage_argv(stage_plan, "unused"), run
        )
        self.assertEqual(artifacts["input.prm"], f"set root = {archive}")
        self.assertEqual(argv[-3:], [str(self.jobs), str(self.jobs / run / "0"), str(archive)])

    def test_execution_service_validates_full_messages_and_revisions(self):
        self.write_graph({"0": stage("Success")}, {})
        registry = self.exchange("describe")["result"]
        header = registry["__backend"]
        schema = read(CLI.parents[2] / "schemas" / "execution-service.schema.json")
        self.assertEqual(set(header["operations"]), set(schema["$defs"]["operation"]["enum"]) - {"configure", "list_workflows", "read_workflow", "write_workflow"})
        revisions = {key: header[key] for key in ("registry_digest", "configuration_digest")}
        self.assertEqual(self.exchange("configure", configuration=read(self.config),
                                       configuration_digest=header["configuration_digest"])["error"]["code"],
                         "unsupported_operation")
        network = read(self.network)
        request = {"network": network, **revisions}
        self.assertEqual(self.exchange("validate", **request)["result"], {"valid": True})
        self.assertEqual(self.exchange("submit", network=network)["error"]["code"], "invalid_request")
        self.assertEqual(self.exchange("describe", version="0")["error"]["code"], "incompatible_protocol")
        self.assertEqual(self.exchange("describe", run_id="a")["error"]["code"], "invalid_request")
        network["workflow"]["nodes"]["0"]["configuration"] = {"a": 1}
        self.assertEqual(self.exchange("validate", **request)["error"]["code"], "invalid_request")
        request["network"] = read(self.network)
        result = self.exchange("submit", **request)["result"]
        run_id = result["run_id"]
        for _ in range(25):
            result = self.exchange("status", run_id=run_id)["result"]
            if result["state"] == "succeeded":
                break
            self.assertIn(result["state"], {"queued", "running"}, result)
            time.sleep(0.1)
        self.assertEqual(result["state"], "succeeded")
        self.assertEqual(result["nodes"]["0"], {"qualified_id": "0", "state": "succeeded"})
        self.assertIsInstance(self.exchange("logs", run_id=run_id)["result"]["logs"]["0"], str)
        self.assertEqual(self.exchange("outputs", run_id=run_id)["result"]["outputs"], {"0": ["copied.json"]})
        artifact = self.exchange("artifact", run_id=run_id, qualified_id="0", name="copied.json", offset=0)["result"]
        self.assertEqual(artifact["media_type"], "application/json")
        self.assertIsNone(artifact["next_offset"])
        self.assertEqual(self.exchange("artifact", run_id=run_id, qualified_id="0", name="../plan.json", offset=0)["error"]["code"], "unknown_output")

        self.write_target("Added", "exit 0")
        self.assertEqual(self.exchange("submit", **request)["error"]["code"], "stale_configuration")
        header = self.exchange("describe")["result"]["__backend"]
        request["configuration_digest"] = header["configuration_digest"]
        self.assertEqual(self.exchange("submit", **request)["error"]["code"], "stale_registry")

    def test_import_legacy_executable_pipeline_uses_the_configured_target(self):
        pipeline = {"pipeline": {"nodes": [
            {"type": "executableStage", "id": "old0", "name": "Old tool", "config": {
                "executablePath": str(self.root / "Success"), "parametersFileName": "parameters.json",
                "useMpi": True, "tasksPerNode": 3,
            }, "parameters": {"value": leaf("42", "[Integer]", "")}},
            {"type": "executableStage", "id": "old1", "config": {"executablePath": str(self.root / "Failure")}},
        ], "edges": [{"source": "old0", "target": "old1"}]}}
        imported = self.exchange("migrate", document=pipeline)["result"]
        workflow = imported["network"]["workflow"]
        self.assertTrue(imported["changes"])
        self.assertEqual(workflow["nodes"]["0"]["configuration"]["mpi_processes"]["value"], "3")
        self.assertEqual(workflow["nodes"]["0"]["configuration"]["parameters"]["value"]["value"], "42")
        self.assertEqual(workflow["edges"]["0"], linkage(0, 1))
        pipeline["pipeline"]["nodes"][0]["config"]["executablePath"] = "/not/configured"
        self.assertEqual(self.exchange("migrate", document=pipeline)["error"]["code"], "import_target_required")

    def test_exclusive_stage_waits_without_inheriting_unrelated_failure(self):
        occupied = self.root / "busy"
        self.write_target("Occupy", 'touch "$1"; sleep 1; rm "$1"; exit 3', argv={"0": str(occupied)})
        self.write_target("Exclusive", 'test ! -e "$1"', argv={"0": str(occupied)})
        self.write_graph({
            "0": stage("Occupy"),
            "1": stage("Exclusive", configuration={"exclusive": leaf("true", "[Bool]", "")}),
        }, {})
        run_id = self.invoke("submit", self.network)["run_id"]
        waited = False
        for _ in range(25):
            state = self.invoke("status", run_id)
            waited |= state["nodes"]["1"].get("waiting_for") == "exclusive stage"
            if state["state"] == "failed":
                break
            time.sleep(0.1)
        self.assertTrue(waited)
        self.assertEqual(state["nodes"]["0"]["state"], "failed")
        self.assertEqual(state["nodes"]["1"]["state"], "succeeded")

    def test_replay_uses_saved_parameters_and_checks_input_bytes(self):
        self.write_target("Copy", 'cat "$1" > copied.txt', argv={"0": "{input:source.txt}"})
        self.jobs.mkdir()
        data = self.jobs / "source.txt"
        data.write_text("original")
        self.write_graph({"0": stage("Copy"), "1": file_node("source.txt", input_file=True)}, {
            "0": file_edge(1, 0, produced=False),
        })
        source = self.invoke("run", self.network)["run_id"]
        config = read(self.config)
        config["Copy"]["argv"]["0"]["value"] = "/different/path"
        write(self.config, config)

        def replay():
            result = self.exchange("replay", run_id=source)["result"]
            self.assertEqual(result["source_run_id"], source)
            for _ in range(25):
                state = self.exchange("status", run_id=result["run_id"])["result"]
                if state["state"] in {"succeeded", "failed"}:
                    return state
                time.sleep(0.1)
            self.fail("Replay did not finish")

        result = replay()
        self.assertEqual(result["state"], "succeeded")
        self.assertEqual((self.jobs / result["run_id"] / "0/copied.txt").read_text(), "original")
        data.write_text("edited")
        self.assertEqual(replay()["nodes"]["0"]["error"]["code"], "replay_input_changed")

    def test_registry_and_materialized_program(self):
        self.invoke("register")
        registry = read(self.root / "node_types.json")
        self.assertEqual(registry["__backend"]["id"], "orchestrator")
        self.assertNotIn("configuration", registry["__backend"])
        self.assertNotIn("configure", registry["__backend"]["operations"])
        for name in ("LocalFile", "RemoteFile", "Transfer", "Selection", "Success"):
            with self.subTest(node=name):
                key = f"orchestrator::{name}"
                definition = registry[key]
                self.assertEqual(definition["type"], key)
                self.assertEqual(definition["display_name"], name)
                self.assertEqual(definition["palette_section"], "Orchestrator")
        self.assertTrue(registry["orchestrator::GenericFile"]["capabilities"]["hidden"])
        self.assertEqual(
            registry["orchestrator::Success"]["capabilities"],
            {"actions": ["configure"], "configuration_exposable": True},
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

    def test_target_environment_is_passed_as_values(self):
        self.write_target("Env", 'test "$DEALIIX_TEST_VALUE" = "$1"', argv={"0": "two words; $literal"})
        config = read(self.config)
        config["Env"]["environment"] = {"DEALIIX_TEST_VALUE": leaf("two words; $literal", "[Anything]", "")}
        write(self.config, config)
        self.write_graph({"0": stage("Env")}, {})
        self.assertEqual(self.invoke("run", self.network)["state"], "succeeded")

    def test_exposed_parameter_values_materialize_without_a_runtime_dependency(self):
        path = ["parameters", "Degree"]
        port = quote(json.dumps(path), safe="")
        nodes = {
            str(index): stage("Success", configuration={"parameters": {"Degree": leaf(value, "[Integer]", "")}},
                              configuration_exposures={"exposures": [{"path": path, "type": "int", "input": index == 1, "output": index == 0}]})
            for index, value in enumerate(("3", "7"))
        }
        self.write_graph(nodes, {"0": {
            "source": 0, "target": 1, "source_handle": f"parameter-output-{port}", "target_handle": f"parameter-input-{port}",
        }})
        result = self.invoke("run", self.network)
        record = self.runs / result["run_id"]
        self.assertEqual(read(record / "network.json")["workflow"]["nodes"]["1"]["configuration"]["parameters"]["Degree"]["value"], "7")
        self.assertEqual(read(self.jobs / result["run_id"] / "1/copied.json")["Degree"]["value"], "3")
        self.assertEqual(read(record / "plan.json")["parents"]["1"], [])

    def test_selection_binds_an_exposed_configuration_input(self):
        condition = leaf("baseline", "[Selection baseline|alternate ]", "")
        template = self.root / "template.json"
        write(template, {"Case": condition})
        config = read(self.config)
        config["Success"]["parameter_template"] = leaf(str(template), "[Anything]", "")
        write(self.config, config)
        path = ["parameters", "Case"]
        nodes = {
            "0": stage("Selection", configuration={
                "options": leaf("baseline | alternate | extra", "[Anything]", ""),
                "choice": leaf("alternate", "[Anything]", ""),
            }),
            "1": stage("Success", configuration={"parameters": {"Case": condition}},
                       configuration_exposures={"exposures": [
                           {"path": path, "type": "string", "input": True, "output": False},
                       ]}),
        }
        edges = {"0": {
            "source": 0, "source_output": 0, "target": 1,
            "target_handle": "parameter-input-" + quote(json.dumps(path), safe=""),
        }}
        self.write_graph(nodes, edges)
        result = self.invoke("run", self.network)
        self.assertEqual(read(self.jobs / result["run_id"] / "1/copied.json")["Case"]["value"], "alternate")
        self.assertEqual(read(self.runs / result["run_id"] / "plan.json")["parents"], {"1": []})

        self.write_graph(nodes, {})
        result = self.invoke("run", self.network)
        self.assertEqual(read(self.jobs / result["run_id"] / "1/copied.json")["Case"]["value"], "baseline")

        for choice in ("extra", "unknown"):
            with self.subTest(choice=choice):
                nodes["0"]["configuration"]["choice"]["value"] = choice
                self.write_graph(nodes, edges)
                error = self.invoke("validate", self.network, success=False)
                self.assertEqual(error["code"], "invalid_parameters")
                self.assertIn("1.parameters.Case" if choice == "extra" else "0.choice", error["message"])

    def test_immersx_target_publishes_concrete_family_metadata(self):
        tree = read(self.config)
        tree["ImmersXLocal"] = {
            key: leaf(value, "[Anything]", "")
            for key, value in {
                "binary": "/opt/coral/bin/coral", "plugin": "/opt/immersx/plugin.so",
                "plugin_id": "immersx", "working_directory": str(self.jobs),
                "node_id": "immersx::coral", "display_name": "ImmersX CORAL",
                "class_name": "ImmersX", "overload_group": "ImmersX CORAL", "variant_name": "Local",
                "palette_subsection": "Local",
            }.items()
        }
        config = configuration(tree)
        child = {"__backend": {"id": "coral", "plugin": "immersx"}}
        key = "orchestrator::immersx::coral"
        discovery = {name: child if name == key else {} for name in config.targets}
        node = describe(config, discovery)[key]
        self.assertEqual((node["class_name"], node["overload_group"], node["variant_name"]),
                         ("ImmersX", "ImmersX CORAL", "Local"))
        self.assertEqual(node["value"]["registry"], child)
        self.assertTrue(node["capabilities"]["configuration_exposable"])
        self.assertNotIn("palette_section", node)
        self.assertEqual(node["palette_subsection"], "Local")

    def test_selection_binds_file_path_before_resolving_input(self):
        self.write_target("Copy", 'cp "$1" copied.txt', argv={"0": "{input:selected.txt}"})
        self.jobs.mkdir()
        (self.jobs / "selected.txt").write_text("selected input")
        nodes = {
            "0": stage(
                "Selection",
                configuration={
                    "options": leaf("selected.txt|../outside", "[Anything]", ""),
                    "choice": leaf("selected.txt", "[Anything]", ""),
                },
            ),
            "1": file_node("default.txt", input_file=True, kind="LocalFile"),
            "2": stage("Copy"),
        }
        nodes["1"]["configuration_exposures"] = {"exposures": [
            {"path": ["path"], "type": "string", "input": True, "output": False},
        ]}
        edges = {
            "0": {
                "source": 0, "source_output": 0, "target": 1,
                "target_handle": "parameter-input-" + quote(json.dumps(["path"]), safe=""),
            },
            "1": file_edge(1, 2, produced=False),
        }
        self.write_graph(nodes, edges)
        result = self.invoke("run", self.network)
        self.assertEqual(
            (Path(result["nodes"]["2"]["directory"]) / "copied.txt").read_text(),
            "selected input",
        )
        saved = read(self.runs / result["run_id"] / "network.json")
        self.assertEqual(
            saved["workflow"]["nodes"]["1"]["configuration"]["path"]["value"], "default.txt"
        )

        nodes["0"]["configuration"]["choice"]["value"] = "../outside"
        self.write_graph(nodes, edges)
        error = self.invoke("validate", self.network, success=False)
        self.assertEqual(error["code"], "invalid_file")
        self.assertIn("relative file path", error["message"])

    def test_produced_file_can_expose_its_path_to_its_producer(self):
        path = ["parameters", "Path"]
        nodes = {
            "0": stage(
                "Success",
                configuration={"parameters": {"Path": leaf("default.json", "[Anything]", "")}},
                configuration_exposures={"exposures": [
                    {"path": path, "type": "string", "input": True, "output": False},
                ]},
            ),
            "1": file_node("copied.json", output_file=True, location="rundir", kind="LocalFile"),
        }
        nodes["1"]["configuration_exposures"] = {"exposures": [
            {"path": ["path"], "type": "string", "input": False, "output": True},
        ]}
        edges = {
            "0": file_edge(0, 1, produced=True),
            "1": {
                "source": 1, "target": 0,
                "source_handle": "parameter-output-" + quote(json.dumps(["path"]), safe=""),
                "target_handle": "parameter-input-" + quote(json.dumps(path), safe=""),
            },
        }
        self.write_graph(nodes, edges)
        result = self.invoke("run", self.network)
        self.assertEqual(
            read(Path(result["nodes"]["0"]["directory"]) / "copied.json")["Path"]["value"],
            "copied.json",
        )
        self.assertEqual(read(self.runs / result["run_id"] / "plan.json")["parents"], {"0": []})

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
        header = self.exchange("describe")["result"]["__backend"]
        revisions = {key: header[key] for key in ("registry_digest", "configuration_digest")}
        for operation in ("validate", "submit"):
            error = self.exchange(operation, network=read(self.network), **revisions)["error"]
            self.assertEqual((error["code"], error["qualified_id"]), ("missing_input", "1"))
        self.jobs.mkdir()
        (self.jobs / "mesh.msh").write_text("mesh")
        self.assertEqual(self.invoke("validate", self.network), {"valid": True})
        result = self.invoke("run", self.network)
        self.assertEqual(result["state"], "succeeded")
        self.assertEqual(result["nodes"]["1"]["state"], "succeeded")
        self.assertNotIn("2", result["nodes"])
        self.assertNotIn("3", result["nodes"])

    def test_status_reports_checks_and_a_file_that_disappears_after_preflight(self):
        gate = self.root / "release"
        self.write_target(
            "Produce",
            'while [ ! -f "$1" ]; do sleep 0.05; done\nprintf mesh > "$2"',
            argv={"0": str(gate), "1": "{output:mesh.msh}"},
        )
        self.jobs.mkdir()
        external = self.jobs / "external.txt"
        external.write_text("original input")
        self.write_graph(
            {
                "0": stage("Produce"),
                "1": file_node("mesh.msh", input_file=True, output_file=True, location="rundir"),
                "2": stage("Success"),
                "3": file_node("external.txt", input_file=True),
                "4": stage("Selection"),
            },
            {
                "0": file_edge(0, 1, produced=True),
                "1": file_edge(1, 2, produced=False),
                "2": file_edge(3, 2, produced=False),
            },
        )
        header = self.exchange("describe")["result"]["__backend"]
        revisions = {key: header[key] for key in ("registry_digest", "configuration_digest")}
        try:
            result = self.exchange("submit", network=read(self.network), **revisions)["result"]
            run_id = result["run_id"]
            for _ in range(20):
                result = self.exchange("status", run_id=run_id)["result"]
                if result["nodes"]["1"]["state"] == "running":
                    break
                time.sleep(0.05)
            self.assertEqual(
                [result["nodes"][str(i)]["state"] for i in range(5)],
                ["running", "running", "queued", "succeeded", "succeeded"],
            )
            external.unlink()
        finally:
            gate.touch()
        for _ in range(20):
            result = self.exchange("status", run_id=run_id)["result"]
            if result["state"] == "failed":
                break
            time.sleep(0.05)
        self.assertEqual(result["state"], "failed")
        self.assertEqual(result["nodes"]["1"]["state"], "succeeded")
        self.assertEqual(result["nodes"]["3"]["state"], "failed")
        self.assertEqual(result["nodes"]["3"]["error"]["qualified_id"], "3")

    def test_slurm_job_attributes_a_missing_input_found_after_queuing(self):
        class LocalSlurm(Machine):
            def call(self, argv, *args, **kwargs):
                if argv[0] == "sbatch":
                    return subprocess.CompletedProcess(argv, 0, stdout=b"42\n")
                return super().call(argv, *args, **kwargs)

        target = configuration(read(self.config)).targets["orchestrator::Success"]
        stage = Stage(
            "0", "0", target, {"type": "orchestrator::Success"},
            {}, (False, 1, 1, "", ""),
            inputs={
                "optional.txt": FileBinding("1", "optional.txt", "workdir", True),
                "required.txt": FileBinding("2", "required.txt", "workdir", False),
            },
        )
        machine = LocalSlurm(target)
        inputs = {name: str(self.root / name) for name in stage.inputs}
        self.assertEqual(
            submit_slurm(stage, machine, str(self.root), ["exit", "0"], [], inputs),
            "42",
        )
        result = subprocess.run(
            ["sh", "job.sh"], cwd=self.root, capture_output=True, check=False
        )
        self.assertEqual(result.returncode, 1)
        failure = slurm_input_failure(stage, machine, str(self.root), inputs)
        self.assertEqual((failure["code"], failure["qualified_id"]), ("missing_input", "2"))

    def test_rundir_handoff_and_validation_on_every_run(self):
        self.write_target(
            "Produce", 'printf mesh > "$1"', argv={"0": "{output:files/mesh.msh}"}
        )
        consumer_dir = self.root / "separate consumer"
        self.write_target(
            "Consume",
            'test "$(cat "$1")" = mesh && test "$2" = "$(dirname -- "$1")"',
            argv={"0": "{input:files/mesh.msh}", "1": "{input_dir:files/mesh.msh}"},
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
        self.assertEqual(first["nodes"]["2"]["argv"][-2:], [path, str(Path(path).parent)])
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
        file_status = self.exchange("status", run_id=failure["run_id"])["result"]["nodes"]["1"]
        self.assertEqual(file_status["error"]["qualified_id"], "1")
        self.assertEqual(file_status["error"]["code"], "missing_output")
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
        self.assertEqual(second["nodes"]["1"]["state"], "succeeded")

        self.write_target(
            "Produce", 'printf replacement > "$1"', argv={"0": "{output:mesh.msh}"}
        )
        self.write_graph({**nodes, "0": stage("Produce")}, edges)
        failure = self.invoke("run", self.network, success=False)
        state = self.invoke("status", failure["run_id"])
        self.assertEqual(state["nodes"]["0"]["error"]["code"], "output_publish_failed")
        self.assertEqual(final.read_text(), "permanent")

    def test_reuse_requires_matching_inputs_parameters_and_output(self):
        self.write_target(
            "Produce",
            'cat "$1" > "$2"',
            "parameters.json",
            argv={"0": "{input:source.txt}", "1": "{output:result.txt}"},
        )
        self.jobs.mkdir()
        source = self.jobs / "source.txt"
        source.write_text("original")
        result = self.jobs / "result.txt"
        nodes = {
            "0": stage(
                "Produce",
                configuration={
                    "run_policy": leaf("if_missing", "[Anything]", ""),
                    "parameters": {"setting": leaf("1", "[Integer]", "")},
                },
            ),
            "1": file_node("source.txt", input_file=True),
            "2": file_node("result.txt", output_file=True),
        }
        edges = {"0": file_edge(1, 0, produced=False), "1": file_edge(0, 2, produced=True)}
        self.write_graph(nodes, edges)

        def rejected_reuse():
            error = self.invoke("run", self.network, success=False)
            status = self.invoke("status", error["run_id"])
            self.assertEqual(status["nodes"]["0"]["error"]["code"], "output_publish_failed")

        result.write_text("unrecorded")
        rejected_reuse()
        result.unlink()
        first = self.invoke("run", self.network)["nodes"]["0"]
        self.assertIn("source.txt", first["input_hashes"])
        self.assertIn("result.txt", first["output_hashes"])
        self.assertTrue(self.invoke("run", self.network)["nodes"]["0"]["reused"])

        source.write_text("changed")
        rejected_reuse()
        self.assertEqual(result.read_text(), "original")
        source.write_text("original")
        nodes["0"]["configuration"]["parameters"]["setting"]["value"] = "2"
        self.write_graph(nodes, edges)
        rejected_reuse()
        nodes["0"]["configuration"]["parameters"]["setting"]["value"] = "1"
        self.write_graph(nodes, edges)
        result.write_text("tampered")
        rejected_reuse()
        self.assertEqual(result.read_text(), "tampered")

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
        cancelled = self.exchange("cancel", run_id=run_id)["result"]
        self.assertTrue(cancelled["cancellation_requested"])
        while True:
            result = self.invoke("status", run_id)
            if result["state"] == "cancelled":
                break
            self.assertLess(time.monotonic(), deadline)
            time.sleep(0.05)
        self.assertEqual(result["nodes"]["0"]["state"], "cancelled")

    def test_pause_drains_a_running_stage_and_resume_keeps_the_run(self):
        gate = self.root / "finish"
        started = self.root / "started"
        self.write_target(
            "Barrier",
            'printf once >> "$1"; while [ ! -f "$2" ]; do sleep 0.05; done',
            argv={"0": str(started), "1": str(gate)},
        )
        self.write_graph({"0": stage("Barrier"), "1": stage("Success")}, {"0": linkage(0, 1)})
        run_id = self.invoke("submit", self.network)["run_id"]
        self.addCleanup(self.invoke, "cancel", run_id)

        deadline = time.monotonic() + 10
        while not started.is_file():
            self.assertLess(time.monotonic(), deadline)
            time.sleep(0.05)
        pause = self.exchange("pause", run_id=run_id)["result"]["scheduling"]
        self.assertEqual(pause, {"revision": 1, "state": "draining"})
        self.assertEqual(self.invoke("pause", run_id)["scheduling"]["revision"], 1)
        gate.touch()
        while True:
            snapshot = self.invoke("status", run_id)
            if snapshot["scheduling"]["state"] == "paused":
                break
            self.assertLess(time.monotonic(), deadline)
        self.assertEqual(snapshot["nodes"]["0"]["state"], "succeeded")
        self.assertEqual(snapshot["nodes"]["1"]["state"], "queued")
        self.assertFalse((self.jobs / run_id / "1").exists())

        resumed = self.exchange("resume", run_id=run_id)["result"]
        self.assertEqual(resumed["run_id"], run_id)
        while True:
            snapshot = self.invoke("status", run_id)
            if snapshot["state"] == "succeeded":
                break
            self.assertLess(time.monotonic(), deadline)
        self.assertEqual(started.read_text(), "once")
        self.assertEqual(snapshot["nodes"]["1"]["state"], "succeeded")

    def test_slurm_hold_preserves_job_id_and_leaves_existing_hold_alone(self):
        commands = []

        class Slurm:
            def call(self, argv, **kwargs):
                commands.append(argv)
                return subprocess.CompletedProcess(argv, 0)

        machine = Slurm()
        own = SlurmHold()
        sync_slurm_hold(machine, "42", "PENDING", "Dependency", "100", True, own)
        self.assertTrue(own.owned)
        self.assertFalse(own.confirmed)
        sync_slurm_hold(machine, "42", "PENDING", "JobHeldUser", "0", True, own)
        self.assertTrue(own.confirmed)
        sync_slurm_hold(machine, "42", "PENDING", "JobHeldUser", "0", False, own)
        self.assertFalse(own.owned)
        preexisting = SlurmHold()
        sync_slurm_hold(machine, "43", "PENDING", "JobHeldAdmin", "0", True, preexisting)
        self.assertTrue(preexisting.confirmed)
        sync_slurm_hold(machine, "43", "PENDING", "JobHeldAdmin", "0", False, preexisting)
        sync_slurm_hold(machine, "44", "RUNNING", "None", "100", True, SlurmHold())
        self.assertEqual(commands, [["scontrol", "hold", "42"], ["scontrol", "release", "42"]])


if __name__ == "__main__":
    unittest.main()
