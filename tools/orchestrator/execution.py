"""Run configured programs locally, over SSH, or through Slurm."""

import json
import os
import re
import shlex
import shutil
import signal
import subprocess
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from file_artifacts import (
    CHECK_FILE,
    SLURM_INPUT_FAILURE,
    cached_outputs,
    check_inputs,
    input_digests,
    input_paths,
    publish_outputs,
    resolve_references,
    stage_directory,
    stage_fingerprint,
)
from parameter_files import stage_parameter_files
from protocol import (
    Error,
    check,
    clean_parameters,
    diagnostic,
    encode,
    native_graph,
    parameter_text,
    read,
    write,
)
from scheduling import admission_lock, scheduling_request

POLL_INTERVAL = 0.5
MARKER = re.compile(r"[A-Za-z0-9_-]+\.(running|succeeded|failed|cancelled)")
# SSH holds stdin open for the life of this supervisor. EOF also cleans up the
# remote process group if the local worker is interrupted or loses its connection.
REMOTE_SUPERVISOR = """
import os, select, signal, subprocess, sys
with open('run.log', 'wb') as log:
    process = subprocess.Popen(sys.argv[1:], stdin=subprocess.DEVNULL,
                              stdout=log, stderr=subprocess.STDOUT,
                              start_new_session=True)
    while process.poll() is None:
        if select.select([sys.stdin], [], [], 0.2)[0] and not os.read(0, 1):
            try:
                os.killpg(process.pid, signal.SIGTERM)
                process.wait(timeout=4)
            except ProcessLookupError:
                pass
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
            break
    sys.exit(process.wait())
"""


def ssh_options(connection):
    options = [
        "-o",
        "ControlPath=none",
        "-o",
        "ClearAllForwardings=yes",
        "-o",
        "BatchMode=yes",
        "-o",
        "StrictHostKeyChecking=yes",
        "-o",
        "ConnectTimeout=10",
        "-o",
        "ServerAliveInterval=5",
        "-o",
        "ServerAliveCountMax=2",
    ]
    if connection.get("known_hosts_file"):
        known_hosts = json.dumps(connection["known_hosts_file"], ensure_ascii=False)
        options.extend(["-o", f"UserKnownHostsFile={known_hosts}"])
    if connection.get("identity_file"):
        options.extend(["-o", "IdentitiesOnly=yes", "-i", connection["identity_file"]])
    return options


class Machine:
    def __init__(self, target):
        self.target = target
        self.ssh = []
        if target.ssh:
            connection = target.ssh
            self.ssh = [
                "ssh",
                "-T",
                *ssh_options(connection),
                "-p",
                connection.get("port", "22"),
            ]
            if connection.get("user"):
                self.ssh.extend(["-l", connection["user"]])
            self.ssh.extend(["--", connection["host"]])

    def for_file(self, binding):
        return Machine(binding.target) if binding.target is not None else self

    def invocation(self, argv, cwd=None):
        if not self.ssh:
            return argv, cwd
        command = shlex.join(argv)
        if cwd is not None:
            command = f"cd {shlex.quote(str(cwd))} && exec {command}"
        return [*self.ssh, command], None

    def call(self, argv, cwd=None, data=None, required=True):
        command, local_cwd = self.invocation(argv, cwd)
        try:
            result = subprocess.run(
                command,
                cwd=local_cwd,
                input=data if data is not None else b"",
                capture_output=True,
                check=False,
                timeout=45,
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            raise Error("target_unavailable", f"{self.target.name}: {error}") from error
        if result.returncode and (required or self.ssh and result.returncode == 255):
            details = (result.stderr or result.stdout).decode(errors="replace").strip()
            raise Error(
                "target_error",
                f"{self.target.name}: {argv[0]} exited {result.returncode}: {details[-3000:]}",
            )
        return result

    def put(self, directory, name, contents):
        if self.ssh:
            self.call(
                ["sh", "-c", 'cat > "$1"', "sh", name], directory, contents.encode()
            )
        else:
            (Path(directory) / name).write_text(contents, encoding="utf-8")

    def get(self, directory, name, required=True):
        if self.ssh:
            result = self.call(["cat", "--", name], directory, required=required)
            return result.stdout if result.returncode == 0 else None
        path = Path(directory) / name
        return path.read_bytes() if (required or path.is_file()) else None

    def files(self, directory, subdir="."):
        if self.ssh:
            result = self.call(
                ["find", subdir, "-type", "f", "-print0"], directory, required=False
            )
            return [os.fsdecode(item) for item in result.stdout.split(b"\0") if item]
        root = Path(directory)
        return [
            str(path.relative_to(root))
            for path in (root / subdir).rglob("*")
            if path.is_file()
        ]


def discover(target, initialization=None):
    machine = Machine(target)
    machine.call(["test", "-x", target.binary])
    if not target.plugin:
        if not target.parameter_template:
            return {}
        try:
            result = json.loads(machine.get("/", target.parameter_template))
        except (ValueError, OSError) as error:
            raise Error("invalid_parameters", f"{target.name}: {error}") from error
        check("parameters", result, "invalid_parameters")
        return clean_parameters(result)
    machine.call(["test", "-r", target.plugin])
    machine.call(["mkdir", "-p", target.directory])
    directory = (
        machine.call(["mktemp", "-d", f"{target.directory}/.register-XXXXXXXX"])
        .stdout.decode()
        .strip()
    )
    try:
        command = [target.binary, "-p", target.plugin, "register"]
        if initialization is not None:
            machine.put(
                directory, "initialization.json", encode({"plugin": initialization})
            )
            command.append("initialization.json")
        machine.call(launch_environment(target, command), directory)
        result = json.loads(machine.get(directory, "node_types.json"))
        check("registry", result, "invalid_registry")
        if target.plugin_id:
            result["__backend"] = {"id": "coral", "plugin": target.plugin_id}
        return result
    finally:
        machine.call(["rm", "-rf", "--", directory], required=False)


def launch_environment(target, command, **overrides):
    environment = {**target.environment, **overrides}
    if not environment:
        return command
    return [
        "env", *(f"{name}={value}" for name, value in sorted(environment.items())),
        *command,
    ]


def stage_argv(stage, directory):
    if stage.transfer:
        return []
    target = stage.target
    mpi, ranks, *_ = stage.resources
    if target.plugin:
        argv = [
            target.binary,
            "-p",
            target.plugin,
            "run",
            "network.json",
            "--touch-dir",
            "status",
        ]
    else:
        argv = [target.binary]
        if target.argv is not None:
            substitutions = {
                "{parameters_file}": str(
                    PurePosixPath(directory) / target.parameter_file
                ),
                "{run_directory}": directory,
            }
            argv.extend(substitutions.get(arg, arg) for arg in target.argv)
        elif target.parameter_file:
            argv.append(target.parameter_file)
    if target.mpi_mode == "application":
        return launch_environment(
            target,
            argv,
            DEALIIX_MPI_LAUNCHER=target.launcher,
            DEALIIX_MPI_PROCESSES=str(ranks if mpi else 1),
            DEALIIX_MPI_ENABLED="true" if mpi else "false",
        )
    if mpi:
        rank_flag = (
            "--ntasks" if PurePosixPath(target.launcher).name == "srun" else "-np"
        )
        argv = [target.launcher, rank_flag, str(ranks), *argv]
    return launch_environment(target, argv)


def materialize(stage, registry, occupied):
    machine = Machine(stage.target)
    commands = []
    if stage.transfer:
        source = next(iter(stage.inputs.values()))
        if bool(source.target.ssh) != bool(stage.target.ssh) and not shutil.which(
            "scp"
        ):
            raise Error("target_unavailable", f"{stage.qid}: scp is not available")
        for target in (stage.target, source.target):
            if target.ssh:
                Machine(target).call(["sh", "-c", "command -v python3"])
        return {}
    if stage.resources[0]:
        commands.append(stage.target.launcher)
    if stage.target.environment or stage.target.mpi_mode == "application":
        commands.append("env")
    if stage.target.scheduler == "slurm":
        commands.extend(["sbatch", "squeue", "scancel", "scontrol"])
    if stage.target.ssh:
        commands.append("python3")
    for command in commands:
        machine.call(launch_environment(stage.target, ["sh", "-c", 'command -v "$1"', "sh", command]))
    if stage.target.plugin:
        child = deepcopy(stage.node["value"])
        plugin = child.setdefault("plugin", {})
        mpi = plugin.setdefault("MPI", {})
        mpi["enabled"] = stage.resources[0] and stage.target.mpi_mode == "backend"
        if mpi["enabled"]:
            mpi.setdefault("max_num_threads", 1)
        artifacts = {}

        def load(source):
            return machine.get(stage.target.directory, source).decode("utf-8")

        stage_parameter_files(child, load, registry, artifacts, occupied)
        check("network-execution", child, "invalid_network")
        native_graph(child, registry)
        artifacts["network.json"] = encode(child)
        return artifacts
    name = stage.target.parameter_file
    return {name: parameter_text(stage.choices["parameters"], name)} if name else {}


def mark(directory, qid, state):
    for path in directory:
        (path / f"{qid}.{state}").touch(exist_ok=True)


def mirror(machine, directory, touch):
    if touch:
        for name in machine.files(directory, "status"):
            filename = PurePosixPath(name).name
            if MARKER.fullmatch(filename):
                for path in touch:
                    (path / filename).touch(exist_ok=True)


def stopped(run):
    return (run / "cancel").is_file()


def run_direct(machine, argv, directory, run, tick):
    remote = machine is not None and bool(machine.ssh)
    invocation, local_cwd = (
        machine.invocation(["python3", "-c", REMOTE_SUPERVISOR, *argv], directory)
        if remote
        else (argv, directory)
    )
    output = run / "transport.log" if remote else Path(directory) / "run.log"
    with output.open("wb") as log:
        process = subprocess.Popen(
            invocation,
            cwd=local_cwd,
            stdout=log,
            stderr=subprocess.STDOUT,
            stdin=subprocess.PIPE if remote else subprocess.DEVNULL,
            start_new_session=True,
        )
        try:
            while process.poll() is None and not stopped(run.parent):
                tick()
                time.sleep(POLL_INTERVAL)
        finally:
            if process.poll() is None:
                try:
                    if remote:
                        process.stdin.close()
                    else:
                        os.killpg(process.pid, signal.SIGTERM)
                    process.wait(timeout=8)
                except ProcessLookupError:
                    pass
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
            if remote and not process.stdin.closed:
                process.stdin.close()
        return process.wait()


def scp_command(connection, path, local, *, download):
    host = connection["host"]
    if ":" in host:
        host = "[" + host + "]"
    user = connection.get("user")
    if download:
        # SFTP expands source globs even when arguments bypass a local shell.
        special = "*?[]" + chr(92)
        path = "".join(chr(92) + char if char in special else char for char in path)
    remote = (f"{user}@" if user else "") + f"{host}:{path}"
    endpoints = [remote, local] if download else [local, remote]
    return [
        "scp",
        "-s",
        *ssh_options(connection),
        "-P",
        connection.get("port", "22"),
        "--",
        *endpoints,
    ]


def transfer_commands(source_path, source, destination_path, destination):
    if source.ssh and destination.ssh:
        if source.target.ssh == destination.target.ssh:
            command, _ = destination.invocation(
                ["cp", "--", source_path, destination_path]
            )
            return [command]
        reader, _ = source.invocation(["cat", "--", source_path])
        writer, _ = destination.invocation(
            ["sh", "-c", 'cat > "$1"', "sh", destination_path]
        )
        return [reader, writer]
    if source.ssh:
        return [
            scp_command(source.target.ssh, source_path, destination_path, download=True)
        ]
    if destination.ssh:
        return [
            scp_command(
                destination.target.ssh, destination_path, source_path, download=False
            )
        ]
    return [["cp", "--", source_path, destination_path]]


def stream_copy(commands, stage_run):
    # The kernel pipe bounds memory and the upload applies backpressure to the download.
    reader_command, writer_command = commands
    with (stage_run / "run.log").open("wb") as log:
        reader = subprocess.Popen(
            reader_command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=log,
            start_new_session=True,
        )
        processes = [reader]
        try:
            try:
                writer = subprocess.Popen(
                    writer_command,
                    stdin=reader.stdout,
                    stdout=log,
                    stderr=log,
                    start_new_session=True,
                )
                processes.append(writer)
            finally:
                # Only the writer owns the read end, so an early exit also stops the reader.
                reader.stdout.close()
            while not stopped(stage_run.parent):
                reader_status, writer_status = (process.poll() for process in processes)
                failure = writer_status or reader_status
                if failure:
                    return failure
                if reader_status == writer_status == 0:
                    return 0
                time.sleep(POLL_INTERVAL)
            return 1
        finally:
            for process in processes:
                if process.poll() is None:
                    try:
                        os.killpg(process.pid, signal.SIGTERM)
                    except ProcessLookupError:
                        pass
            for process in processes:
                try:
                    process.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    process.wait()


def run_transfer(stage, stage_run, run_id, available, record):
    source = next(iter(stage.inputs.values()))
    destination = next(iter(stage.outputs.values()))
    source_path = source.final_path(run_id, stage.target.directory)
    destination_path = str(
        PurePosixPath(stage_directory(stage, run_id)) / destination.path
    )
    record.update(source_file=source_path, destination_file=destination_path)
    if source.qid not in available:
        return 0  # Only an optional input can be absent here. Output validation still applies.
    commands = transfer_commands(
        source_path, Machine(source.target), destination_path, Machine(stage.target)
    )
    record["commands"] = commands
    write(stage_run / "state.json", record)
    if stopped(stage_run.parent):
        return 1
    if len(commands) == 2:
        return stream_copy(commands, stage_run)
    return run_direct(None, commands[0], stage_run, stage_run, lambda: None)


def submit_slurm(stage, machine, directory, argv, dependency_ids, inputs):
    mpi, ranks, nodes, partition, limit = stage.resources
    # Inputs may disappear while a job waits in the Slurm queue.
    checks = []
    for name, path in inputs.items():
        binding = stage.inputs[name]
        check_input = shlex.join(["sh", "-c", CHECK_FILE, "sh", path, "input"])
        checks.append(
            f"{check_input} || {{ rc=$?; "
            + ('[ "$rc" = 1 ] || ' if binding.optional else "")
            + f"{{ printf '%s %s\\n' {shlex.quote(binding.qid)} \"$rc\" > {SLURM_INPUT_FAILURE}; "
            + f"printf '%s\\n' {shlex.quote('Unavailable input: ' + path)} >&2; exit 1; }}; }}"
        )
    preflight = "\n".join(checks)
    script = (
        f"#!/bin/sh\n(\n{preflight}\n{shlex.join(argv)}\n)\nstatus=$?\n"
        'printf "%s\\n" "$status" > .exit-code.tmp\n'
        'mv .exit-code.tmp .exit-code\nexit "$status"\n'
    )
    machine.put(directory, "job.sh", script)
    command = [
        "sbatch",
        "--parsable",
        f"--job-name=dealiix-{stage.key}",
        f"--nodes={nodes}",
        f"--ntasks={ranks if mpi else 1}",
        f"--time={limit}",
        "--output=run.log",
        "--error=run.log",
    ]
    if partition:
        command.append(f"--partition={partition}")
    if dependency_ids:
        command.extend(
            [
                "--kill-on-invalid-dep=yes",
                "--dependency=afterok:" + ":".join(dependency_ids),
            ]
        )
    response = machine.call([*command, "job.sh"], directory).stdout.decode().strip()
    job_id = response.split(";", 1)[0]
    if not re.fullmatch(r"[0-9]+", job_id):
        raise Error("slurm_error", f"Unexpected sbatch response {response!r}")
    return job_id


def slurm_input_failure(stage, machine, directory, inputs):
    failure = machine.get(directory, SLURM_INPUT_FAILURE, required=False)
    if not failure:
        return None
    fields = failure.decode(errors="replace").split()
    if len(fields) != 2 or fields[1] not in {"1", "2"}:
        return None
    qid, code = fields
    for name, binding in stage.inputs.items():
        if binding.qid == qid:
            return {
                "code": "missing_input" if code == "1" else "invalid_file",
                "message": f"{stage.qid}: unavailable input: {inputs[name]}",
                "qualified_id": qid,
            }
    return None


@dataclass
class SlurmHold:
    confirmed: bool = False
    owned: bool = False


def sync_slurm_hold(machine, job_id, job_state, reason, priority, pause, hold):
    held = priority == "0" or reason in {"JobHeldUser", "JobHeldAdmin"}
    hold.confirmed = job_state == "PENDING" and held
    if pause:
        action = "hold" if job_state == "PENDING" and not held else None
    else:
        action = "release" if hold.owned else None
    if action is None:
        return
    try:
        result = machine.call(["scontrol", action, job_id], required=False)
    except Error:
        # Keep the job ID and retry on the next observation.
        return
    if action == "hold" and result.returncode == 0:
        hold.owned = True
    if action == "release" and (result.returncode == 0 or not held):
        hold.owned = False
        hold.confirmed = False


def wait_slurm(machine, directory, job_id, run, tick, update, hold):
    failures = 0
    while not stopped(run.parent):
        tick()
        status = machine.get(directory, ".exit-code", required=False)
        if status is not None:
            return int(status)
        queued = machine.call(
            ["squeue", "-h", "-j", job_id, "-o", "%T|%r|%Q"], required=False
        )
        if queued.returncode == 0 and queued.stdout.strip():
            failures = 0
            state, reason, priority = queued.stdout.decode().strip().split("|", 2)
            update("queued" if state in {"PENDING", "CONFIGURING"} else "running")
            request = scheduling_request(run.parent)
            sync_slurm_hold(
                machine, job_id, state, reason, priority,
                bool(request and request["pause"]), hold,
            )
        else:
            hold.confirmed = False
            result = machine.call(
                [
                    "sacct",
                    "-n",
                    "-P",
                    "-X",
                    "-j",
                    job_id,
                    "-o",
                    "JobIDRaw,State,ExitCode",
                ],
                required=False,
            )
            for line in result.stdout.decode().splitlines():
                fields = line.split("|")
                if len(fields) < 3 or not fields[1]:
                    continue
                found_id, state, exit_code = fields[:3]
                if found_id != job_id:
                    continue
                state = state.split()[0].rstrip("+")
                if state == "COMPLETED":
                    return 0
                if state == "CANCELLED":
                    return None
                if state in {
                    "FAILED",
                    "TIMEOUT",
                    "NODE_FAIL",
                    "OUT_OF_MEMORY",
                    "BOOT_FAIL",
                    "DEADLINE",
                    "PREEMPTED",
                    "REVOKED",
                    "SPECIAL_EXIT",
                }:
                    return int(exit_code.split(":")[0]) or 1
            failures += 1
            if failures >= 30:
                raise Error(
                    "slurm_error", f"Unable to determine state of Slurm job {job_id}"
                )
        time.sleep(1)
    machine.call(["scancel", job_id], required=False)
    return 1


def execute_stage(stage, artifacts, run, touch, tickets, predecessors, expected, hold):
    target = stage.target
    machine = Machine(target)
    stage_run = run / stage.qid
    stage_run.mkdir(exist_ok=True)
    directory = stage_directory(stage, run.name)
    record = {
        "qualified_id": stage.qid,
        "state": "running",
        "target": target.name,
        "directory": directory,
        "remote": bool(target.ssh),
    }
    write(stage_run / "state.json", record)
    mark(touch, stage.qid, "running")
    code = None
    job_id = None
    cancelled = False
    try:
        available = check_inputs(stage, machine, run.name)
        for qid in available:
            mark(touch, qid, "succeeded")
        input_hashes = input_digests(stage, machine, run.name, available)
        fingerprint = stage_fingerprint(
            stage, machine, input_hashes, artifacts, stage_argv(stage, "{run_directory}")
        )
        record.update(fingerprint=fingerprint, input_hashes=input_hashes)
        if expected is not None and fingerprint != expected:
            raise Error("replay_input_changed", f"{stage.qid}: fingerprint differs from the recorded run")
        artifacts, argv = resolve_references(
            stage, artifacts, stage_argv(stage, directory), run.name
        )
        record["argv"] = argv
        machine.call(["mkdir", "-p", f"{target.directory}/{run.name}"])
        machine.call(["mkdir", "--", directory])
        cached = cached_outputs(stage, machine, run, fingerprint)
        if cached is not None:
            outputs, hashes = cached
            record.update(declared_outputs=outputs, output_hashes=hashes, reused=True)
            code = 0
            return "succeeded"
        for name in stage.outputs:
            machine.call(["mkdir", "-p", str((PurePosixPath(directory) / name).parent)])
        if target.plugin and not stage.transfer:
            machine.call(["mkdir", "--", "status"], directory)
        for name, text in artifacts.items():
            (stage_run / name).write_text(text, encoding="utf-8")
            machine.put(directory, name, text)
        tick = lambda: (
            mirror(machine, directory, touch)
            if target.plugin and not stage.transfer
            else None
        )
        if stopped(run):
            return "cancelled"
        if stage.transfer:
            code = run_transfer(stage, stage_run, run.name, available, record)
        elif target.scheduler == "slurm":
            paths = input_paths(stage, run.name)
            job_id = submit_slurm(
                stage,
                machine,
                directory,
                argv,
                predecessors,
                paths,
            )
            record.update(
                job_id=job_id, state="queued", dependency_job_ids=predecessors
            )
            write(stage_run / "state.json", record)
            tickets[stage.key] = job_id

            def update(state):
                if record["state"] != state:
                    record["state"] = state
                    write(stage_run / "state.json", record)

            code = wait_slurm(machine, directory, job_id, stage_run, tick, update, hold)
            cancelled = code is None
        else:
            code = run_direct(machine, argv, directory, stage_run, tick)
        tick()
        if code == 0 and not stopped(run) and stage.outputs:
            if any(binding.location == "workdir" for binding in stage.outputs.values()):
                current = check_inputs(stage, machine, run.name)
                if input_digests(stage, machine, run.name, current) != input_hashes:
                    raise Error("input_changed", f"{stage.qid}: an input changed during execution")
            outputs, hashes = publish_outputs(stage, machine, run.name)
            record.update(declared_outputs=outputs, output_hashes=hashes)
        elif code and not stopped(run):
            error = slurm_input_failure(stage, machine, directory, paths) if job_id else None
            record["error"] = error or {
                "code": "process_failed",
                "message": f"Program exited with status {code}",
            }
    except (Error, OSError, ValueError) as error:
        record["error"] = diagnostic(error, "execution_error")
        if job_id is not None:
            # Keep the submitted id in the record if the scheduler became unreachable.
            try:
                machine.call(["scancel", job_id], required=False)
            except Error:
                pass
    finally:
        if stopped(run) or cancelled:
            state = "cancelled"
        elif code == 0 and "error" not in record:
            state = "succeeded"
        else:
            state = "failed"
        record.update(state=state, exit_code=code)
        write(stage_run / "state.json", record)
        mark(touch, stage.qid, state)
        for name, binding in stage.outputs.items():
            if state != "succeeded" or name in record.get("declared_outputs", {}):
                mark(touch, binding.qid, state)
    return state


def compatible_slurm(left, right):
    return left.scheduler == right.scheduler == "slurm" and left.ssh == right.ssh


def mark_waiting(run, stage, reason):
    directory = run / stage.qid
    directory.mkdir(exist_ok=True)
    record = {"qualified_id": stage.qid, "state": "queued", "waiting_for": reason}
    path = directory / "state.json"
    if not path.is_file() or read(path) != record:
        write(path, record)


def execute(stages, parents, artifacts, run, touch, expected):
    pending = set(stages)
    active = {}
    results = {}
    tickets = {}
    holds = {}
    last_scheduling = None
    with ThreadPoolExecutor(max_workers=max(1, len(stages))) as pool:
        while pending or active:
            exclusive_waiting = False
            for key in stages:
                if key not in pending:
                    continue
                stage = stages[key]
                if stopped(run) or any(
                    results.get(parent) in {"failed", "cancelled"}
                    for parent in parents[key]
                ):
                    pending.remove(key)
                    results[key] = "cancelled"
                    stage_dir = run / stage.qid
                    stage_dir.mkdir(exist_ok=True)
                    write(
                        stage_dir / "state.json",
                        {"qualified_id": stage.qid, "state": "cancelled"},
                    )
                    mark(touch, stage.qid, "cancelled")
                    for binding in stage.outputs.values():
                        mark(touch, binding.qid, "cancelled")
                    continue
                predecessors = []
                for parent in sorted(parents[key]):
                    if results.get(parent) == "succeeded":
                        continue
                    if (
                        parent not in tickets
                        or stages[parent].outputs
                        or not compatible_slurm(stages[parent].target, stage.target)
                    ):
                        mark_waiting(run, stage, "dependencies")
                        break
                    predecessors.append(tickets[parent])
                else:
                    if (
                        exclusive_waiting
                        or any(stages[other].exclusive for other in active.values())
                        or (stage.exclusive and active)
                    ):
                        exclusive_waiting = exclusive_waiting or stage.exclusive
                        mark_waiting(run, stage, "exclusive stage")
                        continue
                    with admission_lock(run):
                        request = scheduling_request(run)
                        if stopped(run) or (request and request["pause"]):
                            continue
                        pending.remove(key)
                        hold = holds[key] = SlurmHold()
                        future = pool.submit(
                            execute_stage,
                            stage,
                            artifacts[key],
                            run,
                            touch,
                            tickets,
                            predecessors,
                            expected.get(stage.qid),
                            hold,
                        )
                        active[future] = key
            request = scheduling_request(run)
            if request and request["revision"]:
                if request["pause"]:
                    state = "paused" if all(holds[key].confirmed for key in active.values()) else "draining"
                else:
                    state = "resuming" if any(holds[key].owned for key in active.values()) else "active"
                scheduling = {"revision": request["revision"], "state": state}
                if scheduling != last_scheduling:
                    write(run / "scheduling-state.json", scheduling)
                    last_scheduling = scheduling
            if active:
                finished, _ = wait(
                    active, timeout=POLL_INTERVAL, return_when=FIRST_COMPLETED
                )
                for future in finished:
                    key = active.pop(future)
                    del holds[key]
                    results[key] = future.result()
            elif pending:
                time.sleep(POLL_INTERVAL)
    return results
