#!/usr/bin/env python3
"""Write a backend profile and saved network for the MOX circulation examples."""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from parameter_files import entry, parse_prm  # noqa: E402
from protocol import IDENTITY, leaf, write  # noqa: E402


def parameters(values):
    return {
        key: parameters(value) if isinstance(value, dict) else leaf(str(value), "[Anything]", "")
        for key, value in values.items()
    }


def target(args, binary, argv=None, parameter_file=""):
    result = {
        "binary": binary,
        "working_directory": args.workspace,
        "parameter_file": parameter_file,
    }
    if args.host:
        result.update(ssh={"host": args.host}, scheduler="slurm")
    if args.mpi_launcher:
        result["mpi_launcher"] = args.mpi_launcher
    if argv is not None:
        result["argv"] = {str(index): value for index, value in enumerate(argv)}
    return result


def heart_target(args, source_directory):
    result = target(args, args.python, [
        str(source_directory / "lifex_heart.py"), "{parameters_file}",
        "{output:inputs/electromechanics.csv}",
    ], parameter_file="heart.json")
    result["parameter_template"] = str(source_directory / "lifex_heart.parameters.json")
    result["display_name"] = "life-X heart simulator (mock)"
    if args.host:
        result["scheduler"] = "none"
    return result


class Workflow:
    def __init__(self, remote):
        self.file_kind = "RemoteFile" if remote else "LocalFile"
        self.nodes = {}
        self.edges = {}

    def add(self, kind, name, configuration):
        key = len(self.nodes)
        self.nodes[str(key)] = {
            "type": f"orchestrator::{kind}",
            "node_type": "void_function",
            "name": name,
            "configuration": configuration,
        }
        return key

    def connect(self, source, target, source_port, target_port):
        self.edges[str(len(self.edges))] = {
            "source": source, "target": target,
            "source_output": source_port, "target_input": target_port,
        }

    def file(self, path, producer=None, consumer=None):
        key = self.add(self.file_kind, path, parameters({
            "path": path,
            "input_file": "true" if consumer is not None else "false",
            "output_file": "true" if producer is not None else "false",
            "location": "rundir" if producer is not None else "workdir",
        }))
        if producer is not None:
            self.connect(producer, key, 1, 0)
        if consumer is not None:
            self.connect(key, consumer, 0, 1)


def metric_parameters(source, model, smoke=False):
    tree = parse_prm(source.read_text())
    section = ("MetricFlowSystem<1, 3>",)
    mesh = "adan56.vtk" if model == "ADAN56" else "adavn_full.vtk"
    replacements = {
        ("Vtk file path for mesh input",): f"{{input:inputs/{mesh}}}",
        ("Inflow CSV file",): "{input:inflow.csv}",
        ("Output directory",): "output",
        ("Output terminal CSV file",): "terminals.csv",
    }
    if smoke:
        replacements.update({
            ("Number of global refinement",): "0",
            ("Tolerance ramp enabled",): "false",
            ("IDA parameters", "Final time"): "0.002",
            ("IDA parameters", "Time interval between each output"): "0.001",
        })
    if model == "ADAVN":
        replacements[("Terminal connections CSV file",)] = "{input:inputs/connections.csv}"
    for path, value in replacements.items():
        entry(tree, [*section, *path], model)["value"] = value
    return tree


def ircad_parameters(source):
    tree = parse_prm(source.read_text())
    replacements = {
        ("Elastodynamics", "Domain", "Grid generator"): "{input:inputs/ircad11.msh}",
        ("Elastodynamics", "Output directory"): "solid",
        ("MetricFlowSystem<1, 3>", "Inflow CSV file"): "{input:inlet_ha.csv}",
        ("MetricFlowSystem<1, 3>", "Vtk file path for mesh input"): "",
        ("MetricFlowSystem<1, 3>", "Output directory"): "flow",
        ("MetricFlowX coupling", "Archived network", "Directory"):
            "{input_dir:inputs/ircad-network/manifest}",
        ("MetricFlowX coupling", "Archived network", "Venous pressure CSV file"):
            "{input:ivc_pressure.csv}",
        ("MetricFlowX coupling", "Flow history directory"): "flow-history",
    }
    for path, value in replacements.items():
        entry(tree, path, "IRCAD11")["value"] = value
    return tree


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True, help="Local directory for the profile and network")
    parser.add_argument("--workspace", required=True, help="Absolute workspace on the execution target")
    parser.add_argument("--host", help="SSH host or alias for the Slurm submission server")
    parser.add_argument("--partition", default="")
    parser.add_argument("--python", default="/usr/bin/python3")
    parser.add_argument("--blood-flow", required=True, help="Absolute MetricFlowX executable on the target")
    parser.add_argument("--parameters", type=Path, required=True, help="Prepared normal-case MetricFlowX PRM")
    parser.add_argument("--ircad11", help="Absolute ImmersX + MetricFlowX app on the target")
    parser.add_argument("--ircad11-parameters", type=Path, help="Reviewed IRCAD11 small normal-case PRM")
    parser.add_argument("--mpi-launcher", help="MPI launcher on the target")
    parser.add_argument("--ranks", type=int, help="MetricFlowX ranks, 1 for serial")
    parser.add_argument("--full-adan56", action="store_true", help="Keep the prepared ADAN56 end time and numerics")
    parser.add_argument("--lifex-example-directory", type=Path,
                        help="Absolute path on the target to lifex_heart.py and its parameter template")
    args = parser.parse_args()
    if args.lifex_example_directory and not args.lifex_example_directory.is_absolute():
        parser.error("--lifex-example-directory must be absolute on the target")
    if bool(args.ircad11) != bool(args.ircad11_parameters):
        parser.error("--ircad11 and --ircad11-parameters must be given together")
    if args.ranks is not None and args.ranks < 1:
        parser.error("--ranks must be positive")
    if args.full_adan56 and args.ircad11:
        parser.error("--full-adan56 applies to the ADAN56 workflow")
    args.output = args.output.resolve()
    args.output.mkdir(parents=True, exist_ok=True)
    workflow = Workflow(args.host)
    slurm = {"slurm": {"partition": args.partition}} if args.host else {}
    mox = workflow.add("FilterMOX", "Filter MOX QAV", parameters(slurm))
    model = "ADAVN" if args.ircad11 else "ADAN56"
    ranks = args.ranks if args.ranks is not None else (4 if model == "ADAVN" else 1)
    choices = {
        **slurm,
        "mpi_enabled": "true" if ranks > 1 else "false",
        "mpi_processes": str(ranks),
    }
    if args.host and model == "ADAVN":
        choices["slurm"]["time_limit"] = "06:00:00"
    circulation = workflow.add(model, f"MetricFlowX {model}", {
        **parameters(choices),
        "parameters": metric_parameters(args.parameters, model, smoke=model == "ADAN56" and not args.full_adan56),
    })
    heart = None
    if args.lifex_example_directory:
        heart = workflow.add("LifeXHeartSimulator", "life-X heart simulator (mock)", {})
    workflow.file("inputs/electromechanics.csv", producer=heart, consumer=mox)
    workflow.file("inputs/filter_mox.py", consumer=mox)
    workflow.file("inflow.csv", producer=mox, consumer=circulation)
    mesh = "adavn_full.vtk" if args.ircad11 else "adan56.vtk"
    workflow.file(f"inputs/{mesh}", consumer=circulation)
    profile = {
        "runs_directory": args.output / "runs",
        "FilterMOX": target(args, args.python, [
            "{input:inputs/filter_mox.py}", "{input:inputs/electromechanics.csv}",
            "{output:inflow.csv}",
        ]),
        model: target(args, args.blood_flow, parameter_file="parameters.prm"),
    }
    if args.lifex_example_directory:
        profile["LifeXHeartSimulator"] = heart_target(args, args.lifex_example_directory)
    if args.ircad11:
        filter_stage = workflow.add("FilterADAVN", "Extract hepatic and IVC histories", parameters(slurm))
        liver_choices = {
            "mpi_enabled": "true", "mpi_processes": "16",
            **({"slurm": {"partition": args.partition, "time_limit": "12:00:00"}} if args.host else {}),
        }
        liver = workflow.add("IRCAD11", "ImmersX + MetricFlowX IRCAD11 small", {
            **parameters(liver_choices), "parameters": ircad_parameters(args.ircad11_parameters),
        })
        workflow.file("inputs/connections.csv", consumer=circulation)
        workflow.file("output/terminals.csv", producer=circulation, consumer=filter_stage)
        workflow.file("inputs/filter_adavn.py", consumer=filter_stage)
        workflow.file("inlet_ha.csv", producer=filter_stage, consumer=liver)
        workflow.file("ivc_pressure.csv", producer=filter_stage, consumer=liver)
        workflow.file("inputs/ircad11.msh", consumer=liver)
        workflow.file("inputs/ircad-network/manifest", consumer=liver)
        for index in range(25):
            workflow.file(f"inputs/ircad-network/part-0-{index}.txt", consumer=liver)
        workflow.file("flow/terminals.csv", producer=liver)
        profile["FilterADAVN"] = target(args, args.python, [
            "{input:inputs/filter_adavn.py}", "{input:output/terminals.csv}",
            "{output:inlet_ha.csv}", "{output:ivc_pressure.csv}", "8",
        ])
        profile["IRCAD11"] = target(args, args.ircad11, parameter_file="parameters.prm")
    else:
        workflow.file("output/terminals.csv", producer=circulation)
    write(args.output / "backend.config.json", {
        "backend": IDENTITY, "configuration": parameters(profile),
    })
    write(args.output / "network.json", {
        "version": 1, "backend": {"id": "orchestrator"},
        "workflow": {"nodes": workflow.nodes, "edges": workflow.edges},
    })


if __name__ == "__main__":
    main()
