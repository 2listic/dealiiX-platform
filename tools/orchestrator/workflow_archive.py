"""Access configured workflow collections on the orchestrator or an SSH target."""

import json
import sys
import subprocess

from execution import Machine
from protocol import Error, WORKFLOW_OPERATIONS, check, encode

# Same filesystem semantics on the orchestrator and on the configured SSH host.
ACCESS = r"""
import fcntl
import hashlib
import json
import os
import re
import stat
import sys
import tempfile
from pathlib import Path

NAME = re.compile(r"[A-Za-z0-9_][A-Za-z0-9_. -]*\.json")
LIMIT = 4 * 1024 * 1024

class ArchiveError(Exception):
    pass

def eligible(name):
    return len(name) <= 128 and NAME.fullmatch(name)

def content(path):
    flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK
    with os.fdopen(os.open(path, flags), "rb") as stream:
        mode = os.fstat(stream.fileno()).st_mode
        if not stat.S_ISREG(mode):
            raise ArchiveError("invalid_workflow_file", "Expected a plain workflow file")
        data = stream.read(LIMIT + 1)
    if len(data) > LIMIT:
        raise ArchiveError("workflow_too_large", "Workflow exceeds 4 MiB")
    return data

def decode_network(data):
    def invalid_constant(value):
        raise ValueError(f"Invalid JSON constant {value}")
    try:
        document = json.loads(data, parse_constant=invalid_constant)
    except (ValueError, UnicodeError):
        raise ArchiveError("invalid_network", "Stored workflow is not valid JSON")
    if not isinstance(document, dict) or not isinstance(document.get("workflow"), dict):
        raise ArchiveError("invalid_network", "Stored JSON is not a workflow")
    return document

def entry(path, data):
    return {"name": path.name, "revision": "sha256:" + hashlib.sha256(data).hexdigest()}

def access(root, request):
    operation = request["operation"]
    if operation == "list_workflows":
        entries = []
        for path in sorted(root.iterdir()):
            if not eligible(path.name):
                continue
            try:
                info = path.lstat()
                if stat.S_ISREG(info.st_mode) and info.st_size <= LIMIT:
                    data = content(path)
                    decode_network(data)
                    entries.append(entry(path, data))
            except (FileNotFoundError, PermissionError, ArchiveError):
                continue
        return {"entries": entries}

    name = request["workflow_name"]
    if not eligible(name):
        raise ArchiveError("invalid_workflow_name", "Expected a workflow JSON basename")
    path = root / name
    if operation == "read_workflow":
        try:
            data = content(path)
        except FileNotFoundError:
            raise ArchiveError("workflow_not_found", "Workflow does not exist")
        return {**entry(path, data), "network": decode_network(data)}

    data = request["content"].encode("utf-8")
    if len(data) > LIMIT:
        raise ArchiveError("workflow_too_large", "Workflow exceeds 4 MiB")
    lock = os.open(root, os.O_RDONLY | os.O_DIRECTORY)
    try:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            previous = content(path)
        except FileNotFoundError:
            previous = None
        expected = request["expected_revision"]
        current = None if previous is None else entry(path, previous)["revision"]
        if expected != current:
            raise ArchiveError("workflow_conflict", "Workflow changed or already exists")
        with tempfile.NamedTemporaryFile(dir=root, prefix=".workflow-", delete=False) as stream:
            pending = Path(stream.name)
            try:
                if previous is not None:
                    os.fchmod(stream.fileno(), stat.S_IMODE(path.stat(follow_symlinks=False).st_mode) & 0o666)
                else:
                    umask = os.umask(0)
                    os.umask(umask)
                    os.fchmod(stream.fileno(), 0o666 & ~umask)
                stream.write(data)
                stream.close()
                if expected is None:
                    try:
                        os.link(pending, path)
                    except FileExistsError:
                        raise ArchiveError("workflow_conflict", "Workflow already exists")
                else:
                    os.replace(pending, path)
            finally:
                pending.unlink(missing_ok=True)
    finally:
        os.close(lock)
    return entry(path, data)

root = Path(sys.argv[1])
try:
    answer = {"result": access(root, json.load(sys.stdin))}
except ArchiveError as error:
    answer = {"error": {"code": error.args[0], "message": error.args[1]}}
except OSError as error:
    answer = {"error": {"code": "workflow_storage_error",
                        "message": error.strerror or "Workflow storage unavailable"}}
print(json.dumps(answer, ensure_ascii=False, allow_nan=False))
"""


def access_workflows(config, request):
    operation = request["operation"]
    assert operation in WORKFLOW_OPERATIONS
    location = config.workflow_locations.get(request["location_id"])
    if location is None:
        raise Error("unknown_workflow_location", "Select a configured workflow location")
    fields = {"operation": operation}
    if operation != "list_workflows":
        fields["workflow_name"] = request["workflow_name"]
    if operation == "write_workflow":
        if not location.writable:
            raise Error("workflow_read_only", "This workflow location is read-only")
        fields["expected_revision"] = request["expected_revision"]
        fields["content"] = encode(request["network"])

    if location.target and location.target.ssh:
        result = Machine(location.target).call(
            ["python3", "-c", ACCESS, location.directory], data=encode(fields).encode()
        ).stdout
    else:
        # A target-free collection lives on the orchestrator's host.
        try:
            result = subprocess.run(
                [sys.executable, "-c", ACCESS, location.directory],
                input=encode(fields).encode(), capture_output=True, check=True, timeout=45,
            ).stdout
        except (OSError, subprocess.SubprocessError) as error:
            raise Error("workflow_storage_error", "Workflow storage is unavailable") from error
    reply = json.loads(result)
    if "error" in reply:
        raise Error(reply["error"]["code"], reply["error"]["message"])
    result = reply["result"]
    if operation == "read_workflow":
        check("network", result["network"], "invalid_network")
    return result
