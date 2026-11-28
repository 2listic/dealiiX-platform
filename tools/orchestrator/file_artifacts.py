"""Resolve, check and publish the files declared by a stage."""

import hashlib
import json
import re
import sys
from pathlib import PurePosixPath

from protocol import Error, encode, read, values

REFERENCE = re.compile(r"\{(?:(input|input_dir|output):([^{}]+)|(workdir|rundir|workflowdir))\}")
SLURM_INPUT_FAILURE = ".input-failure"
RESERVED = {
    "job.sh",
    "run.log",
    "network.json",
    "status",
    ".exit-code",
    ".exit-code.tmp",
    SLURM_INPUT_FAILURE,
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
HASH_FILE = """
import hashlib, sys
digest = hashlib.sha256()
with open(sys.argv[1], 'rb') as stream:
    for chunk in iter(lambda: stream.read(1024 * 1024), b''):
        digest.update(chunk)
print(digest.hexdigest())
"""
# Link without replacing a pre-existing file, even when two workers publish concurrently.
PUBLISH_FILES = """
import errno, json, os, shutil, sys, tempfile
from pathlib import Path

def publish(source, destination):
    try:
        source_stat = source.stat()
        os.link(source, destination, follow_symlinks=False)
        return source_stat.st_dev, source_stat.st_ino
    except OSError as error:
        if error.errno != errno.EXDEV:
            raise

    # Work and workflow directories can live on different filesystems.
    with tempfile.NamedTemporaryFile(dir=destination.parent, prefix=".output-", delete=False) as stream:
        pending = Path(stream.name)
        try:
            with source.open("rb") as original:
                shutil.copyfileobj(original, stream)
                os.fchmod(stream.fileno(), os.fstat(original.fileno()).st_mode & 0o666)
            info = os.fstat(stream.fileno())
            stream.close()
            os.link(pending, destination, follow_symlinks=False)
            return info.st_dev, info.st_ino
        finally:
            pending.unlink(missing_ok=True)

files = json.load(sys.stdin)
created = []
try:
    for source, destination, root in files:
        source, destination, root = Path(source), Path(destination), Path(root)
        if not destination.parent.resolve().is_relative_to(root.resolve()):
            raise ValueError(f'Output leaves its configured directory: {destination}')
        destination.parent.mkdir(parents=True, exist_ok=True)
        identity = publish(source, destination)
        created.append((destination, identity))
except (OSError, ValueError) as error:
    for destination, identity in reversed(created):
        try:
            info = destination.lstat()
            if (info.st_dev, info.st_ino) == identity:
                destination.unlink()
        except FileNotFoundError:
            pass
    sys.exit(str(error))
"""


def present(machine, path, kind, qid):
    try:
        result = machine.call(["sh", "-c", CHECK_FILE, "sh", path, kind], required=False)
    except Error as error:
        raise Error(error.code, str(error), qualified_id=qid) from error
    if result.returncode == 0:
        return True
    if result.returncode == 1:
        return False
    raise Error(
        "invalid_file", f"{kind.capitalize()} is not a readable file: {path}",
        qualified_id=qid,
    )


def stage_directory(stage, run_id):
    return str(PurePosixPath(stage.target.directory) / run_id / stage.qid)


def input_paths(stage, run_id):
    return {
        name: binding.final_path(run_id, stage.target.directory)
        for name, binding in stage.inputs.items()
    }


def file_digest(machine, path):
    python = "python3" if machine.ssh else sys.executable
    return machine.call([python, "-c", HASH_FILE, path]).stdout.decode().strip()


def input_digests(stage, machine, run_id, available):
    inputs = {}
    for name, path in input_paths(stage, run_id).items():
        binding = stage.inputs[name]
        inputs[name] = (
            file_digest(machine.for_file(binding), path) if binding.qid in available else None
        )
    return inputs


def stage_fingerprint(stage, machine, inputs, files, argv):
    choices = values(stage.choices)
    choices.pop("run_policy", None)
    choices.pop("exclusive", None)
    data = {
        "inputs": inputs,
        "files": files,
        "choices": choices,
        "argv": argv,
        "programs": {
            path: file_digest(machine, path)
            for path in (stage.target.binary, stage.target.plugin)
            if path
        },
        "target": [stage.target.directory, stage.target.ssh, stage.target.scheduler],
        "outputs": {
            name: [binding.location, binding.optional, binding.producer_workdir]
            for name, binding in stage.outputs.items()
        },
    }
    if stage.target.workflow_directory:
        data["workflow_directory"] = stage.target.workflow_directory
    serialized = json.dumps(data, sort_keys=True, separators=(",", ":"))
    return "sha256:" + hashlib.sha256(serialized.encode()).hexdigest()


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
        if present(machine.for_file(binding), path, "input", binding.qid):
            available.append(binding.qid)
        elif not binding.optional:
            raise Error(
                "missing_input", f"{stage.qid}: required input does not exist: {path}",
                qualified_id=binding.qid,
            )
    return available


def check_output_names(stage, materialized):
    reserved = RESERVED | materialized.keys()
    for path in stage.outputs:
        if path.split("/", 1)[0] in reserved:
            raise Error(
                "invalid_file",
                f"{stage.qid}: output conflicts with a workflow file: {path}",
                qualified_id=stage.outputs[path].qid,
            )


def resolve_references(stage, files, argv, run_id):
    directory = PurePosixPath(stage_directory(stage, run_id))
    inputs = input_paths(stage, run_id)
    paths = {
        "input": inputs,
        "input_dir": {name: str(PurePosixPath(path).parent) for name, path in inputs.items()},
        "output": {name: str(directory / name) for name in stage.outputs},
    }

    directories = {
        "workdir": stage.target.directory,
        "rundir": str(directory),
        "workflowdir": stage.target.workflow_directory,
    }

    def expand(value):
        def replace(match):
            direction, name, variable = match.groups()
            if variable:
                if not directories[variable]:
                    raise Error("missing_workflow_directory",
                                f"{stage.qid}: {{workflowdir}} requires a workflow location",
                                qualified_id=stage.qid)
                return directories[variable]
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


def cached_outputs(stage, machine, run, fingerprint):
    required = [binding for binding in stage.outputs.values() if not binding.optional]
    if (
        stage.choices.get("run_policy", {}).get("value") != "if_missing"
        or not required
        or any(binding.location == "rundir" for binding in stage.outputs.values())
    ):
        return None
    paths = None
    for path in run.parent.glob(f"run-*/{stage.qid}/state.json"):
        if path.parent.parent == run:
            continue
        record = read(path)
        if record["state"] != "succeeded" or record.get("fingerprint") != fingerprint:
            continue
        if paths is None:
            paths = {
                name: binding.final_path(run.name, stage.target.directory)
                for name, binding in stage.outputs.items()
                if binding.location != "rundir"
            }
            paths = {
                name: destination
                for name, destination in paths.items()
                if present(machine, destination, "output", stage.outputs[name].qid)
            }
            if any(binding.path not in paths for binding in required):
                return None
            hashes = {
                name: file_digest(machine, destination)
                for name, destination in paths.items()
            }
        if (
            record.get("declared_outputs") == paths
            and record.get("output_hashes") == hashes
        ):
            return paths, hashes
    return None


def publish_outputs(stage, machine, run_id):
    result = {}
    hashes = {}
    pending = []
    directory = PurePosixPath(stage_directory(stage, run_id))
    for name, binding in stage.outputs.items():
        source = str(directory / name)
        if not present(machine, source, "output", binding.qid):
            if binding.optional:
                continue
            raise Error(
                "missing_output",
                f"{stage.qid}: required output was not created: {source}",
                qualified_id=binding.qid,
            )
        destination = binding.final_path(run_id, stage.target.directory)
        if binding.location != "rundir":
            pending.append((source, destination, binding.workflow_directory or stage.target.directory))
        result[name] = destination
        hashes[name] = file_digest(machine, source)
    if pending:
        python = "python3" if machine.ssh else sys.executable
        try:
            machine.call([python, "-c", PUBLISH_FILES], data=encode(pending).encode())
        except Error as error:
            raise Error("output_publish_failed", f"{stage.qid}: {error}") from error
    return result, hashes
