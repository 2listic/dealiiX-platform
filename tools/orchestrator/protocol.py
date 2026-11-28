"""Validate the workflow protocol and resolve the network into execution stages."""

import hashlib
import json
import posixpath
import re
import tempfile
from copy import deepcopy
from dataclasses import dataclass, replace
from dataclasses import field as dataclass_field
from graphlib import CycleError, TopologicalSorter
from pathlib import Path, PurePosixPath

from jsonschema import Draft202012Validator
from jsonschema.exceptions import best_match
from referencing import Registry, Resource
from rfc8785 import dumps as canonical_json

SCHEMAS = Path(__file__).resolve().parents[2] / "schemas"
SCHEMA_DOCUMENTS = {
    path.name.removesuffix(".schema.json"): json.loads(path.read_text())
    for path in SCHEMAS.glob("*.schema.json")
}
SCHEMA_REGISTRY = Registry().with_resources(
    (document["$id"], Resource.from_contents(document))
    for document in SCHEMA_DOCUMENTS.values()
)
IDENTITY = {"id": "orchestrator"}
VERSION = "1.1"
OPERATIONS = [
    "describe", "validate", "submit", "status", "logs", "outputs",
    "cancel", "pause", "resume", "replay", "migrate", "artifact",
]
WORKFLOW_OPERATIONS = ["list_workflows", "read_workflow", "write_workflow"]
DIRECTORY_VARIABLES = ("workdir", "rundir", "workflowdir")
ID = re.compile(r"[A-Za-z][A-Za-z0-9_-]*")
NODE_ID = re.compile(r"[A-Za-z][A-Za-z0-9_-]*(?:::[A-Za-z][A-Za-z0-9_-]*)*")
REGISTRY_LABELS = (
    "display_name", "palette_section", "palette_subsection", "class_name",
    "overload_group", "variant_name",
)
QID = re.compile(r"[A-Za-z0-9_-]+")
POSITIVE = "[Integer range 1...2147483647 (inclusive)]"
CONTROL = "orchestrator::dependency"
FILE_TYPE = "orchestrator::GenericFile"
LOCAL_FILE = "orchestrator::LocalFile"
REMOTE_FILE = "orchestrator::RemoteFile"
FILE_TYPES = {FILE_TYPE, LOCAL_FILE, REMOTE_FILE}
TRANSFER_TYPE = "orchestrator::Transfer"
SELECTION_TYPE = "orchestrator::Selection"
LITERAL_DEFAULTS = {"bool": "false", "int": "0", "double": "0", "std::string": ""}
VALUE_TYPES = {*LITERAL_DEFAULTS, SELECTION_TYPE}
FILE_PORT = "orchestrator::file"


class Error(Exception):
    def __init__(self, code, message, *, qualified_id=None):
        super().__init__(message)
        self.code = code
        self.qualified_id = qualified_id


def diagnostic(error, default_code):
    result = {"code": getattr(error, "code", default_code), "message": str(error)}
    if getattr(error, "qualified_id", None) is not None:
        result["qualified_id"] = error.qualified_id
    return result


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, document):
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=path.parent,
        prefix=f".{path.name}-",
        delete=False,
    ) as file:
        temporary = Path(file.name)
        try:
            file.write(encode(document))
            file.close()
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)


def encode(document):
    return json.dumps(document, indent=2, allow_nan=False) + "\n"


def check(schema, document, code):
    name, _, fragment = schema.partition("#")
    schema_document = SCHEMA_DOCUMENTS[name]
    if fragment:
        schema_document = {"$ref": f"{schema_document['$id']}#{fragment}"}
    validator = Draft202012Validator(schema_document, registry=SCHEMA_REGISTRY)
    error = best_match(validator.iter_errors(document))
    if error:
        raise Error(code, f"{error.json_path}: {error.message}")


def leaf(value, pattern, documentation):
    return {
        "value": value,
        "default_value": value,
        "pattern": pattern,
        "pattern_description": pattern,
        "documentation": documentation,
    }


def values(tree):
    return {
        key: item["value"] if isinstance(item.get("value"), str) else values(item)
        for key, item in tree.items()
        if key != "__extra"
    }


def clean_parameters(tree):
    return {
        key: clean_parameters(value) if isinstance(value, dict) else value
        for key, value in tree.items()
        if key != "__extra"
    }


def absolute(path, label):
    if (not isinstance(path, str) or not path or any(ch in path for ch in "\x00\r\n")
        or not PurePosixPath(path).is_absolute()):
        raise Error("invalid_configuration", f"{label} must be an absolute path")
    return path


def positive(value, label, maximum=2147483647):
    if not re.fullmatch(r"[0-9]{1,10}", value) or not 1 <= int(value) <= maximum:
        raise Error(
            "invalid_configuration", f"{label} must be an integer from 1 to {maximum}"
        )
    return int(value)


@dataclass(frozen=True)
class Target:
    name: str
    binary: str
    directory: str
    plugin: str
    plugin_id: str
    launcher: str
    scheduler: str
    ssh: dict
    parameter_file: str
    parameter_template: str
    argv: list[str] | None = None
    environment: dict[str, str] = dataclass_field(default_factory=dict)
    mpi_mode: str = "backend"
    display_name: str = ""
    registry_labels: dict[str, str] = dataclass_field(default_factory=dict)
    workflow_directory: str = ""

    @property
    def kind(self):
        return "coral" if self.plugin else "executable"

    @property
    def node_type(self):
        return "network" if self.plugin else "void_function"


@dataclass(frozen=True)
class WorkflowLocation:
    label: str
    directory: str
    writable: bool
    target: Target | None


@dataclass
class Configuration:
    tree: dict
    runs_directory: Path
    targets: dict
    workflow_locations: dict[str, WorkflowLocation]


def configuration(tree):
    if (
        isinstance(tree, dict)
        and isinstance(tree.get("backend"), dict)
        and isinstance(tree["backend"].get("id"), str)
    ):
        check("backend-settings", tree, "invalid_configuration")
        backend = tree["backend"]
        if (
            backend["id"] != IDENTITY["id"]
            or "plugin" in backend
            or backend.get("version", VERSION) != VERSION
            or backend.get("plugins")
        ):
            raise Error("incompatible_backend", "Settings target a different backend")
        tree = tree["configuration"]
    check("parameters", tree, "invalid_configuration")
    settings = values(tree)
    root = Path(absolute(settings.pop("runs_directory", ""), "runs_directory"))
    location_settings = settings.pop("workflow_locations", {})
    if not isinstance(location_settings, dict) or len(location_settings) > 64:
        raise Error("invalid_configuration", "Invalid workflow_locations group")
    targets = {}
    preferred_locations = {}
    for name, target in settings.items():
        if not ID.fullmatch(name) or not isinstance(target, dict):
            raise Error("invalid_configuration", f"Invalid target section {name!r}")
        unknown = target.keys() - {
            "binary",
            "working_directory",
            "workflow_location",
            "node_id",
            *REGISTRY_LABELS,
            "plugin",
            "plugin_id",
            "scheduler",
            "ssh",
            "mpi_launcher",
            "mpi_mode",
            "parameter_file",
            "parameter_template",
            "argv",
            "environment",
        }
        if unknown:
            raise Error(
                "invalid_configuration", f"{name}: unknown settings {sorted(unknown)}"
            )
        if any(
            not isinstance(value, str)
            for key, value in target.items()
            if key not in {"ssh", "argv", "environment"}
        ):
            raise Error("invalid_configuration", f"{name}: expected parameter leaves")
        ssh = target.get("ssh", {})
        if not isinstance(ssh, dict) or ssh.keys() - {
            "host",
            "user",
            "port",
            "identity_file",
            "known_hosts_file",
        }:
            raise Error("invalid_configuration", f"{name}: invalid ssh section")
        if "ssh" in target:
            host, user = ssh.get("host", ""), ssh.get("user", "")
            if (
                not all(isinstance(value, str) for value in ssh.values())
                or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.:-]*", host)
                or user
                and not re.fullmatch(r"[A-Za-z0-9_][A-Za-z0-9_.-]*", user)
            ):
                raise Error(
                    "invalid_configuration", f"{name}: invalid SSH host or user"
                )
            positive(ssh.get("port", "22"), f"{name}.ssh.port", 65535)
            for field in ("identity_file", "known_hosts_file"):
                if ssh.get(field):
                    absolute(ssh[field], f"{name}.ssh.{field}")
        scheduler = target.get("scheduler", "none")
        if scheduler not in {"none", "slurm"}:
            raise Error(
                "invalid_configuration", f"{name}: scheduler must be none or slurm"
            )
        environment = target.get("environment", {})
        if not isinstance(environment, dict) or any(
            not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key)
            or not isinstance(value, str) or "\0" in value
            for key, value in environment.items()
        ):
            raise Error("invalid_configuration", f"{name}: invalid environment section")
        plugin = target.get("plugin", "")
        plugin_id = target.get("plugin_id", "")
        if plugin:
            absolute(plugin, f"{name}.plugin")
            if plugin_id and not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*", plugin_id):
                raise Error(
                    "invalid_configuration", f"{name}: invalid logical plugin_id"
                )
        elif plugin_id:
            raise Error("invalid_configuration", f"{name}: plugin_id requires a plugin")
        mpi_mode = target.get("mpi_mode", "backend")
        if mpi_mode != "backend" and (mpi_mode != "application" or not plugin):
            raise Error(
                "invalid_configuration",
                f"{name}: mpi_mode must be backend, or application for a CORAL plugin",
            )
        template = target.get("parameter_template", "")
        parameter_file = target.get("parameter_file", "parameters.json")
        if template:
            absolute(template, f"{name}.parameter_template")
        if plugin and (template or "parameter_file" in target or "argv" in target):
            raise Error(
                "invalid_configuration",
                f"{name}: executable parameters and argv are for standalone programs",
            )
        if parameter_file and (
            not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*", parameter_file)
            or not parameter_file.endswith((".json", ".prm"))
        ):
            raise Error(
                "invalid_configuration",
                f"{name}: expected a plain .json or .prm parameter filename",
            )
        argv = None
        if "argv" in target:
            arguments = target["argv"]
            if not isinstance(arguments, dict) or arguments.keys() != {
                str(index) for index in range(len(arguments))
            }:
                raise Error(
                    "invalid_configuration",
                    f"{name}.argv must be a section indexed consecutively from 0",
                )
            argv = [arguments[str(index)] for index in range(len(arguments))]
            if any(not isinstance(arg, str) or "\x00" in arg for arg in argv):
                raise Error(
                    "invalid_configuration",
                    f"{name}.argv must contain text leaves without NUL",
                )
            if "{parameters_file}" in argv and not parameter_file:
                raise Error(
                    "invalid_configuration",
                    f"{name}.argv uses {{parameters_file}} but parameter_file is empty",
                )
        launcher = target.get(
            "mpi_launcher", "srun" if scheduler == "slurm" else "mpirun"
        )
        if not launcher or (
            "/" in launcher and not PurePosixPath(launcher).is_absolute()
        ):
            raise Error(
                "invalid_configuration",
                f"{name}: mpi_launcher must be a command or an absolute path",
            )
        key = (
            {"local": "CoralLocal", "remote": "CoralRemote"}.get(name, name)
            if plugin
            else name
        )
        node_id = target.get("node_id", key)
        if not NODE_ID.fullmatch(node_id):
            raise Error("invalid_configuration", f"{name}: invalid node_id")
        key = f"orchestrator::{node_id}"
        if key in FILE_TYPES or key in {TRANSFER_TYPE, SELECTION_TYPE} or key in targets:
            raise Error("invalid_configuration", f"{name}: duplicate node type {key}")
        preferred_locations[key] = target.get("workflow_location", "")
        targets[key] = Target(
            name,
            absolute(target.get("binary"), f"{name}.binary"),
            absolute(target.get("working_directory"), f"{name}.working_directory"),
            plugin,
            plugin_id,
            launcher,
            scheduler,
            ssh,
            parameter_file,
            template,
            argv,
            environment,
            mpi_mode,
            target.get("display_name", "").strip(),
            {field: target[field].strip() for field in REGISTRY_LABELS if field != "display_name" and target.get(field, "").strip()},
        )
    names = {target.name: target for target in targets.values()}
    locations = {}
    for name, location in location_settings.items():
        if (not ID.fullmatch(name) or len(name) > 64 or not isinstance(location, dict)
            or location.keys() - {"directory", "label", "target", "writable"}
            or any(not isinstance(value, str) for value in location.values())):
            raise Error("invalid_configuration", f"Invalid workflow location {name!r}")
        target_name = location.get("target", "")
        writable = location.get("writable", "false")
        label = location.get("label", name).strip()
        if (target_name and target_name not in names or writable not in {"true", "false"}
            or not label or len(label) > 120):
            raise Error("invalid_configuration", f"Invalid settings for workflow location {name!r}")
        locations[name] = WorkflowLocation(
            label, absolute(location.get("directory"), f"{name}.directory"),
            writable == "true", names.get(target_name),
        )

    for key, target in targets.items():
        matching = {
            name: location for name, location in locations.items()
            if (location.target.ssh if location.target else {}) == target.ssh
        }
        preferred = preferred_locations[key]
        if preferred and preferred not in matching:
            raise Error("invalid_configuration", f"{target.name}: workflow_location must be on the execution host")
        if preferred or len(matching) == 1:
            selected = matching[preferred] if preferred else next(iter(matching.values()))
            targets[key] = replace(target, workflow_directory=selected.directory)
    return Configuration(tree, root, targets, locations)


def run_policy():
    return leaf(
        "always",
        "[Selection always|if_missing ]",
        "Reuse permanent outputs if their checksums and the effective inputs match a successful run.",
    )


def defaults(target, parameters):
    mpi_help = (
        "Let the application called by the CORAL workflow launch MPI."
        if target.mpi_mode == "application"
        else "Launch the program through MPI."
    )
    result = {
        "run_policy": run_policy(),
        "exclusive": leaf("false", "[Bool]", "Run this stage without any other active stage in the workflow."),
        "mpi_enabled": leaf("false", "[Bool]", mpi_help),
        "mpi_processes": leaf("1", POSITIVE, "Total MPI ranks when MPI is enabled."),
    }
    if target.scheduler == "slurm":
        result["slurm"] = {
            "nodes": leaf("1", POSITIVE, "Number of allocated nodes."),
            "partition": leaf(
                "", "[Anything]", "Empty selects the cluster default partition."
            ),
            "time_limit": leaf("00:10:00", "[Anything]", "Slurm wall-clock limit."),
        }
    if target.kind == "executable" and target.parameter_file:
        result["parameters"] = parameters
    return result


def describe(config, discovery):
    registry = {
        "__backend": {
            **IDENTITY,
            "version": VERSION,
            "operations": OPERATIONS + (
                [operation for operation in WORKFLOW_OPERATIONS
                 if operation != "write_workflow" or any(location.writable for location in config.workflow_locations.values())]
                if config.workflow_locations else []
            ),
            "path_variables": list(DIRECTORY_VARIABLES),
            "workflow_locations": [
                {"id": name, "label": location.label, "writable": location.writable}
                for name, location in config.workflow_locations.items()
            ],
            "configuration_digest": digest(values(config.tree)),
        }
    }
    for type_name, value in LITERAL_DEFAULTS.items():
        registry[type_name] = {
            "type": type_name,
            "node_type": "elementary_constructor",
            "arguments": [],
            "inputs": [],
            "outputs": [-1],
            "value": value,
        }
    registry["bool"]["display_name"] = "Option"
    file_definition = {
        "type": FILE_TYPE,
        "palette_section": "Orchestrator",
        "node_type": "void_function",
        "arguments": [
            {"name": "Produced by", "type": FILE_PORT, "connection_type": "input"},
            {"name": "Read by", "type": FILE_PORT, "connection_type": "output"},
        ],
        "inputs": [0],
        "outputs": [1],
    }
    registry[FILE_TYPE] = {
        **file_definition,
        "display_name": "GenericFile",
        "configuration": {
            "path": leaf("", "[Anything]", "Path relative to the selected directory."),
            "input_file": leaf("true", "[Bool]", "The file is read by a stage."),
            "output_file": leaf("false", "[Bool]", "The file is written by a stage."),
            "optional": leaf("false", "[Bool]", "Allow the file to be absent."),
            "location": leaf(
                "workdir",
                "[Selection workdir|rundir|workflowdir ]",
                "File lifetime and root directory.",
            ),
        },
        "capabilities": {"actions": ["configure"], "configuration_exposable": True, "hidden": True},
    }
    for file_type, remote in ((LOCAL_FILE, False), (REMOTE_FILE, True)):
        display = file_type.split("::")[-1]
        definition = {**file_definition, "type": file_type}
        names = sorted(
            target.name
            for target in config.targets.values()
            if bool(target.ssh) == remote
        )
        registry[file_type] = {
            **registry[FILE_TYPE],
            **definition,
            "display_name": display,
            "configuration": {
                **registry[FILE_TYPE]["configuration"],
                "target": leaf(
                    "auto",
                    "[Selection " + "|".join(["auto", *names]) + " ]",
                    "Working directory and connection used for this file.",
                ),
            },
            "capabilities": {"actions": ["configure"], "configuration_exposable": True},
        }
    transfer = {
        **file_definition,
        "type": TRANSFER_TYPE,
        "arguments": [
            {"name": "Source file", "type": FILE_PORT, "connection_type": "input"},
            {
                "name": "Destination file",
                "type": FILE_PORT,
                "connection_type": "output",
            },
        ],
    }
    registry[TRANSFER_TYPE] = {
        **transfer,
        "display_name": "Transfer",
        "configuration": {"run_policy": run_policy()},
        "capabilities": {"actions": ["configure"], "configuration_exposable": False},
    }
    registry[SELECTION_TYPE] = {
        "type": SELECTION_TYPE,
        "palette_section": "Orchestrator",
        "display_name": "Selection",
        "node_type": "void_function",
        "arguments": [{
            "name": "Selected value", "type": "std::string", "connection_type": "output",
            "configuration_path": ["choice"],
        }],
        "inputs": [],
        "outputs": [0],
        "configuration": {
            "options": leaf("first | second", "[Anything]", "Separate choices with |."),
            "choice": {
                **leaf("first", "[Anything]", "Value sent to connected configuration inputs."),
                "selection_options": "options",
            },
        },
        "capabilities": {"actions": ["configure"], "configuration_exposable": False},
    }
    for key, target in config.targets.items():
        discovered = discovery[key]
        arguments = [
            {"name": "After", "type": CONTROL, "connection_type": "input", "multiple": True},
            {"name": "Completed", "type": CONTROL, "connection_type": "output"},
            {"name": "Input files", "type": FILE_PORT, "connection_type": "input", "multiple": True},
            {"name": "Output files", "type": FILE_PORT, "connection_type": "output"},
        ]
        definition = {
            "type": key,
            "display_name": target.display_name or key.removeprefix("orchestrator::"),
            "node_type": target.node_type,
            "arguments": arguments,
            "inputs": [0, 2],
            "outputs": [1, 3],
        }
        actions = ["configure"]
        if target.plugin:
            actions.append("open_child_workflow")
        registry[key] = {
            **definition,
            "configuration": defaults(target, {} if target.plugin else discovered),
            "capabilities": {"actions": actions, "configuration_exposable": True},
        }
        registry[key].update(target.registry_labels)
        if "class_name" not in target.registry_labels:
            registry[key].setdefault("palette_section", "Orchestrator")
        if target.plugin:
            registry[key]["value"] = {"registry": discovered}
    registry["__backend"]["registry_digest"] = digest(
        {key: value for key, value in registry.items() if not key.startswith("__")}
    )
    check("registry", registry, "invalid_registry")
    return registry


def digest(document):
    return "sha256:" + hashlib.sha256(canonical_json(document)).hexdigest()


def migrate(document, config, registry):
    """Convert a legacy pipeline, or wrap a native graph for its configured engine."""
    header = {**IDENTITY, "registry_digest": registry["__backend"]["registry_digest"]}
    if "workflow" in document:
        check("network", document, "invalid_network")
        backend = document.get("backend", {}).get("id")
        if backend == IDENTITY["id"] or (not backend and all(
            node["type"] in registry for node in document["workflow"]["nodes"].values()
        )):
            return {"network": document, "changes": []}
        document = {"pipeline": {"nodes": [{
            "type": "coralStage", "id": "graph", "name": "Imported workflow", "graph": document,
        }], "edges": []}}
    try:
        pipeline = document["pipeline"]
        if not isinstance(pipeline["nodes"], list) or not isinstance(pipeline["edges"], list):
            raise ValueError("Expected legacy pipeline node and edge arrays")
        ids = {}
        nodes = {}
        for legacy in pipeline["nodes"]:
            old_id, kind = legacy["id"], legacy["type"]
            if old_id in ids or kind not in {"coralStage", "executableStage"}:
                raise ValueError("Expected unique legacy nodes of a supported kind")
            choices = legacy.get("config", {})
            coral = kind == "coralStage"
            plugin = legacy.get("graph", {}).get("backend", {}).get("plugin") if coral else None
            candidates = [
                (key, target) for key, target in config.targets.items()
                if (coral and target.plugin and (not plugin or target.plugin_id == plugin))
                or (not coral and not target.plugin and target.binary == choices.get("executablePath")
                    and target.parameter_file == choices.get("parametersFileName", target.parameter_file))
            ]
            if len(candidates) != 1:
                raise Error("import_target_required", f"Configure one matching target for {legacy.get('name', old_id)}")
            key, target = candidates[0]
            mpi = choices.get("useMpi", False)
            node_count = int(choices.get("nodes", 1)) if target.scheduler == "slurm" and mpi else 1
            instance = {
                "mpi_enabled": leaf(str(mpi).lower(), "[Bool]", ""),
                "mpi_processes": leaf(str(node_count * int(choices.get("tasksPerNode", 1)) if mpi else 1), POSITIVE, ""),
            }
            if target.scheduler == "slurm":
                instance["slurm"] = {"nodes": leaf(str(node_count), POSITIVE, "")}
                if choices.get("timeLimit"):
                    instance["slurm"]["time_limit"] = leaf(choices["timeLimit"], "[Anything]", "")
            if not coral and target.parameter_file and legacy.get("parameters") is not None:
                instance["parameters"] = legacy["parameters"]
            index = ids[old_id] = len(nodes)
            nodes[str(index)] = {"type": key, "name": legacy.get("name", key), "configuration": instance}
            if "position" in legacy:
                nodes[str(index)]["position"] = legacy["position"]
            if coral:
                nodes[str(index)].update({
                    field: registry[key][field] for field in ("node_type", "arguments", "inputs", "outputs")
                }, value=legacy["graph"])
        edges = {
            str(index): {"source": ids[edge["source"]], "target": ids[edge["target"]], "source_output": 0, "target_input": 0}
            for index, edge in enumerate(pipeline["edges"])
        }
    except (KeyError, TypeError, ValueError, AttributeError) as error:
        raise Error("invalid_network", f"Invalid legacy workflow: {error}") from error
    network = {"version": VERSION, "backend": header, "workflow": {"nodes": nodes, "edges": edges}}
    check("network", network, "invalid_network")
    return {"network": network, "changes": [f"Converted {len(nodes)} stages and {len(edges)} ordering edges"]}


def merge_choices(template, supplied, label):
    check("parameters", supplied, "invalid_network")
    if supplied.keys() - template.keys() - {"__extra"}:
        raise Error(
            "invalid_configuration", f"{label}: unknown node configuration entries"
        )
    result = deepcopy(template)
    for key, entry in supplied.items():
        if key == "__extra":
            continue
        if key == "parameters" and not isinstance(entry.get("value"), str):
            result[key] = clean_parameters(entry)
        elif isinstance(result[key].get("value"), str) and isinstance(
            entry.get("value"), str
        ):
            result[key]["value"] = entry["value"]
        elif key == "slurm" and not isinstance(entry.get("value"), str):
            result[key] = merge_choices(result[key], entry, f"{label}.slurm")
        else:
            raise Error(
                "invalid_configuration", f"{label}.{key}: unexpected parameter shape"
            )
    return result


def resources(target, tree, label):
    choices = values(tree)
    enabled = choices["mpi_enabled"]
    if choices["exclusive"] not in {"true", "false"}:
        raise Error("invalid_configuration", f"{label}.exclusive must be true or false")
    if enabled not in {"true", "false"}:
        raise Error(
            "invalid_configuration", f"{label}.mpi_enabled must be true or false"
        )
    ranks = positive(choices["mpi_processes"], f"{label}.mpi_processes")
    slurm = choices.get("slurm", {})
    nodes = positive(slurm.get("nodes", "1"), f"{label}.slurm.nodes")
    partition = slurm.get("partition", "")
    limit = slurm.get("time_limit", "")
    if target.scheduler == "slurm":
        if nodes > (ranks if enabled == "true" else 1):
            raise Error(
                "invalid_configuration",
                f"{label}: Slurm nodes exceed the number of tasks",
            )
        if not re.fullmatch(r"[A-Za-z0-9_.,-]*", partition) or not re.fullmatch(
            r"(?:[0-9]+-)?[0-9]+(?::[0-5]?[0-9]){0,2}", limit
        ):
            raise Error(
                "invalid_configuration",
                f"{label}: invalid Slurm partition or time limit",
            )
    return enabled == "true", ranks, nodes, partition, limit


def identify(network, prefix, seen):
    nodes = network["workflow"]["nodes"]
    for key, node in nodes.items():
        qid = node.setdefault("qualified_id", f"{prefix}{key}")
        if not QID.fullmatch(qid) or qid in seen:
            raise Error("invalid_network", f"Invalid or duplicate qualified_id {qid!r}")
        seen.add(qid)
        if node.get("node_type") == "network":
            identify(node["value"], f"{qid}_", seen)
        elif node.get("value") is None:
            node.pop("value", None)


def dependencies(workflow):
    nodes = workflow["nodes"]
    result = {key: set() for key in nodes}
    for key, edge in workflow["edges"].items():
        parent, child = str(edge["source"]), str(edge["target"])
        if parent not in nodes or child not in nodes:
            raise Error("invalid_edge", f"Edge {key}: endpoint does not exist")
        result[child].add(parent)
    try:
        TopologicalSorter(result).prepare()
    except CycleError as error:
        raise Error("cyclic_network", "The graph contains a cycle") from error
    return result


def native_graph(network, registry):
    """Check native registry membership and port positions before invoking CORAL."""
    workflow = network["workflow"]
    dependencies(workflow)
    nodes = workflow["nodes"]
    for node in nodes.values():
        if node.get("node_type") == "network":
            if node["type"] != "coral::Network" and node["type"] not in registry:
                raise Error(
                    "unknown_node",
                    f"{node['qualified_id']}: unknown CORAL subnetwork type {node['type']}",
                )
            native_graph(node["value"], registry)
            continue
        definition = registry.get(node["type"])
        if not isinstance(definition, dict):
            raise Error(
                "unknown_node",
                f"{node['qualified_id']}: {node['type']} is absent from the CORAL registry",
            )
        if node.get("node_type", definition["node_type"]) != definition["node_type"]:
            raise Error(
                "invalid_network",
                f"{node['qualified_id']}: node_type disagrees with the CORAL registry",
            )
    for key, edge in workflow["edges"].items():
        for endpoint, index, field in (
            ("source", "source_output", "outputs"),
            ("target", "target_input", "inputs"),
        ):
            node = nodes[str(edge[endpoint])]
            if (
                index not in edge
            ):  # Saved parameter handles are resolved by materialization.
                continue
            ports = (
                node.get(field)
                if node.get("node_type") == "network"
                else registry[node["type"]][field]
            )
            if ports is not None and edge[index] >= len(ports):
                raise Error(
                    "invalid_edge", f"CORAL edge {key}: {index} is out of range"
                )


@dataclass
class Stage:
    key: str
    qid: str
    target: Target
    node: dict
    choices: dict
    resources: tuple
    inputs: dict = dataclass_field(default_factory=dict)
    outputs: dict = dataclass_field(default_factory=dict)

    @property
    def transfer(self):
        return self.node["type"] == TRANSFER_TYPE

    @property
    def exclusive(self):
        return self.choices.get("exclusive", {}).get("value") == "true"


@dataclass
class FileBinding:
    qid: str
    path: str
    location: str
    optional: bool
    producer_qid: str | None = None
    producer_workdir: str | None = None
    workflow_directory: str | None = None
    target: Target | None = None

    def final_path(self, run_id, consumer_workdir):
        root = PurePosixPath(
            self.producer_workdir
            or (self.target.directory if self.target else consumer_workdir)
        )
        if self.location == "workflowdir":
            root = PurePosixPath(self.workflow_directory)
        if self.location == "rundir":
            root = root / run_id / self.producer_qid
        return str(root / self.path)


def local_file_target(config):
    return Target(
        name="local-files",
        binary="",
        directory=str(config.runs_directory / "files"),
        plugin="",
        plugin_id="",
        launcher="",
        scheduler="none",
        ssh={},
        parameter_file="",
        parameter_template="",
    )


def file_target(config, file_type, qid, requested, producer, consumers):
    native_readers = [stage.target for stage in consumers if not stage.transfer]
    if file_type == FILE_TYPE:
        if producer is not None and not producer.transfer:
            return producer.target
        if producer is not None or any(stage.transfer for stage in consumers):
            raise Error(
                "invalid_file",
                f"{qid}: use LocalFile or RemoteFile at a Transfer boundary",
                qualified_id=qid,
            )
        return None

    remote = file_type == REMOTE_FILE
    available = {
        target.name: target
        for target in config.targets.values()
        if bool(target.ssh) == remote
    }
    if producer is not None and not producer.transfer:
        target = producer.target
        if bool(target.ssh) != remote or requested not in {"auto", target.name}:
            raise Error(
                "invalid_file",
                f"{qid}: file target must match the producer's working directory",
                qualified_id=qid,
            )
        return target
    if requested != "auto":
        if requested not in available:
            raise Error(
                "invalid_file",
                f"{qid}: unknown or incompatible file target {requested!r}",
                qualified_id=qid,
            )
        return available[requested]

    nearby = [target for target in native_readers if bool(target.ssh) == remote]
    candidates = nearby or list(available.values())
    locations = {
        (tuple(sorted(target.ssh.items())), target.directory) for target in candidates
    }
    if len(locations) == 1:
        return candidates[0]
    if not remote and not nearby:
        return local_file_target(config)
    raise Error(
        "invalid_file",
        f"{qid}: choose a target to identify the file's working directory",
        qualified_id=qid,
    )


def file_declaration(node, definition, supplied, readers, writers):
    qid = node["qualified_id"]
    if (
        node.get("node_type", "void_function") != "void_function"
        or "value" in node
        or "parameter_file" in node
    ):
        raise Error(
            "invalid_network", f"{qid}: set file fields in configuration",
            qualified_id=qid,
        )
    options = values(merge_choices(definition["configuration"], supplied, qid))
    path = options["path"]
    location = options["location"]
    for keyword in DIRECTORY_VARIABLES:
        prefix = "{" + keyword + "}/"
        if path.startswith(prefix):
            location, path = keyword, path.removeprefix(prefix)
            break
    if (
        not path
        or any(ch in path for ch in "\x00\n\r{}\\")
        or PurePosixPath(path).is_absolute()
        or any(part in {"", ".", ".."} for part in path.split("/"))
    ):
        raise Error(
            "invalid_file", f"{qid}: specify a relative file path without traversal",
            qualified_id=qid,
        )
    flags = [options[name] for name in ("input_file", "output_file", "optional")]
    if any(value not in {"true", "false"} for value in flags):
        raise Error(
            "invalid_file", f"{qid}: file roles and optional must be true or false",
            qualified_id=qid,
        )
    input_file, output_file, optional = (value == "true" for value in flags)
    if location not in DIRECTORY_VARIABLES:
        raise Error(
            "invalid_file", f"{qid}: location must be workdir, rundir or workflowdir",
            qualified_id=qid,
        )
    if not input_file and not output_file:
        raise Error(
            "invalid_file", f"{qid}: select at least one file role", qualified_id=qid
        )
    if len(writers) != int(output_file):
        raise Error(
            "invalid_file",
            f"{qid}: an output needs exactly one producer and an input-only file needs none",
            qualified_id=qid,
        )
    if bool(readers) != input_file:
        raise Error(
            "invalid_file", f"{qid}: connect input files to their consumers",
            qualified_id=qid,
        )
    if not output_file and location == "rundir":
        raise Error(
            "invalid_file", f"{qid}: a rundir file needs a producer", qualified_id=qid
        )

    return FileBinding(qid, path, location, optional), options.get("target", "auto")


def bind_files(workflow, stages, registry, config, configuration_bindings):
    nodes = workflow["nodes"]
    files = {key: node for key, node in nodes.items() if node["type"] in FILE_TYPES}
    parents = {key: set() for key in stages}
    readers = {key: set() for key in files}
    writers = {key: set() for key in files}
    for key, edge in workflow["edges"].items():
        source, target = str(edge["source"]), str(edge["target"])
        ports = edge.get("source_output"), edge.get("target_input")
        producer = stages.get(source)
        consumer = stages.get(target)
        if (
            producer
            and consumer
            and not producer.transfer
            and not consumer.transfer
            and ports == (0, 0)
        ):
            parents[target].add(source)
        elif producer and target in files and ports == (int(not producer.transfer), 0):
            writers[target].add(source)
        elif source in files and consumer and ports == (0, int(not consumer.transfer)):
            readers[source].add(target)
        else:
            raise Error(
                "invalid_edge", f"Edge {key}: use the declared dependency or file ports"
            )

    destinations = set()
    for key, node in files.items():
        supplied = configuration_bindings.get(key, node.get("configuration", {}))
        binding, requested = file_declaration(
            node, registry[node["type"]], supplied, readers[key], writers[key]
        )
        producer_key = next(iter(writers[key]), None)
        producer = stages[producer_key] if producer_key is not None else None
        consumers = [stages[reader_key] for reader_key in sorted(readers[key])]
        target = file_target(
            config, node["type"], binding.qid, requested, producer, consumers
        )
        binding.target = target
        if binding.location == "workflowdir":
            stage_targets = [producer.target] if producer and not producer.transfer else [
                stage.target for stage in consumers if not stage.transfer
            ]
            directories = {item.workflow_directory for item in ([target] if target else stage_targets)}
            if len(directories) != 1 or not next(iter(directories), ""):
                raise Error("missing_workflow_directory", f"{binding.qid}: select a target with a workflow location",
                            qualified_id=binding.qid)
            binding.workflow_directory = directories.pop()
        path, qid = binding.path, binding.qid
        if producer is not None:
            if producer.transfer:
                producer.target = replace(target, scheduler="none")
            binding.producer_qid = producer.qid
            binding.producer_workdir = producer.target.directory
            destination = (
                tuple(sorted(producer.target.ssh.items())),
                posixpath.normpath(
                    binding.final_path("<run>", producer.target.directory)
                ),
            )
            if destination in destinations or path in producer.outputs:
                raise Error(
                    "invalid_file", f"{qid}: multiple declarations write {path}",
                    qualified_id=qid,
                )
            destinations.add(destination)
            producer.outputs[path] = binding
        for reader in consumers:
            if path in reader.inputs:
                raise Error(
                    "invalid_file",
                    f"{qid}: duplicate input path {path} for {reader.qid}",
                    qualified_id=qid,
                )
            if (
                not reader.transfer
                and target is not None
                and reader.target.ssh != target.ssh
            ):
                raise Error(
                    "invalid_file",
                    f"{qid}: connect a Transfer to copy the file between execution hosts",
                    qualified_id=qid,
                )
            if producer is not None:
                parents[reader.key].add(producer_key)
            reader.inputs[path] = binding
    for stage in stages.values():
        if stage.transfer and (len(stage.inputs) != 1 or len(stage.outputs) != 1):
            raise Error(
                "invalid_file",
                f"{stage.qid}: Transfer requires one source file and one destination file",
                qualified_id=stage.qid,
            )
    return parents


def check_run_policy(choices, qid):
    if choices["run_policy"]["value"] not in {"always", "if_missing"}:
        raise Error(
            "invalid_configuration", f"{qid}: run_policy must be always or if_missing"
        )


def plan(network, config, registry, discover_child):
    from parameter_files import bind_configuration, validate_selections

    network = deepcopy(network)
    check("network", network, "invalid_network")
    backend = network.get("backend", IDENTITY)
    if backend["id"] != IDENTITY["id"] or backend.get("plugin"):
        raise Error(
            "incompatible_backend", "The root graph requires an orchestrator registry"
        )
    if "registry_digest" in backend and backend["registry_digest"] != registry["__backend"]["registry_digest"]:
        raise Error("stale_registry", "The network was saved with a different registry")
    if "plugin" in network:
        raise Error(
            "invalid_network", "Plugin initialization belongs to a CORAL child workflow"
        )
    occupied = set()
    identify(network, "", occupied)
    workflow = network["workflow"]
    configuration_bindings, execution_edges = bind_configuration(workflow, registry)
    execution_workflow = {**workflow, "edges": execution_edges}
    dependencies(execution_workflow)
    stages = {}
    native_registries = {}
    for key, node in workflow["nodes"].items():
        qid = node["qualified_id"]
        if node["type"] in FILE_TYPES or node["type"] in VALUE_TYPES:
            continue
        if node["type"] == TRANSFER_TYPE:
            if (
                node.get("node_type", "void_function") != "void_function"
                or "value" in node
                or "parameter_file" in node
            ):
                raise Error(
                    "invalid_network", f"{qid}: set Transfer options in configuration"
                )
            choices = merge_choices(
                registry[TRANSFER_TYPE]["configuration"],
                node.get("configuration", {}),
                qid,
            )
            check_run_policy(choices, qid)
            stages[key] = Stage(
                key,
                qid,
                local_file_target(config),
                node,
                choices,
                (False, 1, 1, "", ""),
            )
            continue
        target = config.targets.get(node["type"])
        if target is None:
            raise Error("unknown_node", f"{qid}: unknown node {node['type']!r}")
        if node.get("node_type", target.node_type) != target.node_type:
            raise Error(
                "invalid_network", f"{qid}: expected node_type {target.node_type}"
            )
        if "parameter_file" in node or (not target.plugin and "value" in node):
            raise Error(
                "invalid_network",
                f"{qid}: executable parameters belong in configuration.parameters",
            )
        for field in ("arguments", "inputs", "outputs"):
            expected = registry[node["type"]][field]
            legacy = expected[:2] if field == "arguments" else expected[:1]
            actual = node.get(field, expected)
            if field == "arguments":
                # Cardinality lives in the registry. Older canvases omit it from saved arguments.
                expected, legacy, actual = [
                    [{key: value for key, value in arg.items() if key != "multiple"} for arg in args]
                    for args in (expected, legacy, actual)
                ]
            if actual not in (expected, legacy):
                raise Error(
                    "invalid_network",
                    f"{qid}: {field} disagrees with the target registry",
                )
        choices = merge_choices(
            registry[node["type"]]["configuration"],
            configuration_bindings.get(key, node.get("configuration", {})),
            qid,
        )
        validate_selections(registry[node["type"]]["configuration"], choices, qid)
        settings = resources(target, choices, qid)
        check_run_policy(choices, qid)
        if target.plugin:
            if node.get("node_type") != "network":
                raise Error(
                    "invalid_network", f"{qid}: a CORAL node requires node_type network"
                )
            child = node["value"]
            backend = child.get("backend", {"id": "coral"})
            if backend["id"] != "coral" or (
                target.plugin_id
                and backend.get("plugin", target.plugin_id) != target.plugin_id
            ):
                raise Error(
                    "incompatible_backend",
                    f"{qid}: child requires a different CORAL plugin",
                )
            child_registry = registry[node["type"]]["value"]["registry"]
            if child.get("plugin"):
                child_registry = discover_child(target, child["plugin"])
            native_graph(child, child_registry)
            native_registries[key] = child_registry
        stages[key] = Stage(key, qid, target, node, choices, settings)
    parents = bind_files(
        execution_workflow, stages, registry, config, configuration_bindings
    )
    return network, stages, parents, native_registries, occupied


def parameter_text(parameters, name):
    parameters = clean_parameters(parameters)
    if name.endswith(".json"):
        return encode(parameters)

    def lines(tree, indent):
        for key, item in tree.items():
            if any(char in key for char in "\r\n#="):
                raise Error("invalid_parameters", f"Invalid PRM entry name {key!r}")
            if isinstance(item.get("value"), str):
                value = item["value"]
                if any(char in value for char in "\r\n#"):
                    raise Error("invalid_parameters", f"Invalid PRM value for {key!r}")
                yield f"{indent}set {key} = {value}"
            else:
                yield f"{indent}subsection {key}"
                yield from lines(item, indent + "  ")
                yield f"{indent}end"

    return "\n".join(lines(parameters, "")) + "\n"
