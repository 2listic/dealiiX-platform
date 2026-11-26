"""Resolve, check and publish the files declared by a stage."""

import json
import re
import sys
from pathlib import PurePosixPath

from protocol import Error, encode

REFERENCE = re.compile(r"\{(input|output):([^{}]+)\}")
RESERVED = {
    "job.sh",
    "run.log",
    "network.json",
    "status",
    ".exit-code",
    ".exit-code.tmp",
}
CHECK_FILE = """
if [ -e "$1" ] || [ -L "$1" ]; then
    if [ -f "$1" ] && [ -r "$1" ] && { [ "$2" = input ] || [ ! -L "$1" ]; }; then
        exit 0
    fi
    exit 2
fi
exit 1
"""
# Link without replacing a pre-existing file, even when two workers publish concurrently.
PUBLISH_FILES = """
import json, os, sys
from pathlib import Path

files = json.load(sys.stdin)
created = []
try:
    for source, destination, root in files:
        source, destination, root = Path(source), Path(destination), Path(root)
        if not destination.parent.resolve().is_relative_to(root.resolve()):
            raise ValueError(f'Output leaves workdir: {destination}')
        destination.parent.mkdir(parents=True, exist_ok=True)
        os.link(source, destination, follow_symlinks=False)
        created.append((source, destination))
except (OSError, ValueError) as error:
    for source, destination in reversed(created):
        try:
            if source.samefile(destination):
                destination.unlink()
        except FileNotFoundError:
            pass
    sys.exit(str(error))
"""


def present(machine, path, kind):
    result = machine.call(["sh", "-c", CHECK_FILE, "sh", path, kind], required=False)
    if result.returncode == 0:
        return True
    if result.returncode == 1:
        return False
    raise Error("invalid_file", f"{kind.capitalize()} is not a readable file: {path}")


def stage_directory(stage, run_id):
    return str(PurePosixPath(stage.target.directory) / run_id / stage.qid)


def input_paths(stage, run_id):
    return {
        name: binding.final_path(run_id, stage.target.directory)
        for name, binding in stage.inputs.items()
    }


def check_inputs(stage, machine, run_id=None):
    available = []
    for name, path in (
        input_paths(stage, run_id).items()
        if run_id
        else (
            (name, binding.final_path(None, stage.target.directory))
            for name, binding in stage.inputs.items()
            if binding.producer_qid is None
        )
    ):
        binding = stage.inputs[name]
        if present(machine.for_file(binding), path, "input"):
            available.append(binding.qid)
        elif not binding.optional:
            raise Error(
                "missing_input", f"{stage.qid}: required input does not exist: {path}"
            )
    return available


def check_output_names(stage, materialized):
    reserved = RESERVED | materialized.keys()
    for path in stage.outputs:
        if path.split("/", 1)[0] in reserved:
            raise Error(
                "invalid_file",
                f"{stage.qid}: output conflicts with a workflow file: {path}",
            )


def resolve_references(stage, files, argv, run_id):
    if not stage.inputs and not stage.outputs:
        # Unknown file placeholders are rejected even when no file is connected.
        paths = {"input": {}, "output": {}}
    else:
        directory = PurePosixPath(stage_directory(stage, run_id))
        paths = {
            "input": input_paths(stage, run_id),
            "output": {name: str(directory / name) for name in stage.outputs},
        }

    def expand(value):
        def replace(match):
            direction, name = match.groups()
            if name not in paths[direction]:
                raise Error(
                    "unbound_file", f"{stage.qid}: {match[0]} needs a connected file"
                )
            return paths[direction][name]

        return REFERENCE.sub(replace, value)

    def expand_json(value):
        if isinstance(value, dict):
            return {key: expand_json(item) for key, item in value.items()}
        if isinstance(value, list):
            return [expand_json(item) for item in value]
        return expand(value) if isinstance(value, str) else value

    resolved = {}
    for name, contents in files.items():
        if not REFERENCE.search(contents):
            resolved[name] = contents
        elif name.endswith(".json"):
            resolved[name] = encode(expand_json(json.loads(contents)))
        else:
            resolved[name] = expand(contents)
    return resolved, [expand(value) for value in argv]


def cached_outputs(stage, machine, run_id):
    required = [binding for binding in stage.outputs.values() if not binding.optional]
    if (
        stage.choices.get("run_policy", {}).get("value") != "if_missing"
        or not required
        or any(binding.location != "workdir" for binding in required)
    ):
        return None
    if any(
        not present(
            machine, binding.final_path(run_id, stage.target.directory), "output"
        )
        for binding in required
    ):
        return None
    return {
        name: binding.final_path(run_id, stage.target.directory)
        for name, binding in stage.outputs.items()
        if binding.location == "workdir"
        and present(
            machine, binding.final_path(run_id, stage.target.directory), "output"
        )
    }


def publish_outputs(stage, machine, run_id):
    result = {}
    pending = []
    directory = PurePosixPath(stage_directory(stage, run_id))
    for name, binding in stage.outputs.items():
        source = str(directory / name)
        if not present(machine, source, "output"):
            if binding.optional:
                continue
            raise Error(
                "missing_output",
                f"{stage.qid}: required output was not created: {source}",
            )
        destination = binding.final_path(run_id, stage.target.directory)
        if binding.location == "workdir":
            pending.append((source, destination, stage.target.directory))
        result[name] = destination
    if pending:
        python = "python3" if machine.ssh else sys.executable
        try:
            machine.call([python, "-c", PUBLISH_FILES], data=encode(pending).encode())
        except Error as error:
            raise Error("output_publish_failed", f"{stage.qid}: {error}") from error
    return result
