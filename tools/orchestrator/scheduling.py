"""Persist a workflow's requested and acknowledged stage scheduling state."""

from contextlib import contextmanager
from fcntl import LOCK_EX, flock

from protocol import Error, read, write


@contextmanager
def admission_lock(run):
    with (run / "scheduling.lock").open("ab") as handle:
        flock(handle, LOCK_EX)
        yield


def initialize_scheduling(run):
    write(run / "scheduling-request.json", {"revision": 0, "pause": False})


def scheduling_request(run):
    try:
        return read(run / "scheduling-request.json")
    except FileNotFoundError:
        return None


def change_scheduling(run, pause, terminal):
    with admission_lock(run):
        if read(run / "state.json")["state"] in terminal or (run / "cancel").is_file():
            return
        request = scheduling_request(run)
        if request is None:
            raise Error("pause_unavailable", "This run does not support pause and resume")
        if request["pause"] != pause:
            write(run / "scheduling-request.json", {
                "revision": request["revision"] + 1, "pause": pause,
            })


def scheduling_status(run):
    request = scheduling_request(run)
    if request is None:
        return None
    revision = request["revision"]
    try:
        acknowledged = read(run / "scheduling-state.json")
    except FileNotFoundError:
        acknowledged = None
    if acknowledged and acknowledged["revision"] == revision:
        return acknowledged
    if request["pause"]:
        state = "draining"
    else:
        state = "resuming" if revision else "active"
    return {"revision": revision, "state": state}
