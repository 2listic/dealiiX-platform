#!/usr/bin/env python3
"""Replay a published MOX history as the output of a mock life-X heart run."""

import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile


ARCHIVE = "https://github.com/dealii-X/dealii-X/releases/download/assets/assets.zip"
CASES = {
    "normal pressure": (
        "electromechanics.csv",
        "cc28a7411f1f473d4df6dae06a0cfa094629de4acc85ca1b453f0033ac1cdf1c",
    ),
    "hypertension": (
        "electromechanics_SH_severe.csv",
        "c01b0dd135042db4b195025dd2874912033331babd39198b1df6622027fd5291",
    ),
}


def replay(parameters, destination):
    condition = json.loads(parameters.read_text(encoding="utf-8"))["condition"]["value"]
    if condition not in CASES:
        raise ValueError(f"Unknown MOX condition {condition!r}")
    member, expected_hash = CASES[condition]
    with tempfile.TemporaryDirectory(dir=destination.parent) as directory:
        archive = Path(directory) / "assets.zip"
        csv = Path(directory) / member
        subprocess.run([
            "curl", "--fail", "--silent", "--show-error", "--location",
            "--max-time", "120", "--output", str(archive), ARCHIVE,
        ], check=True)
        digest = hashlib.sha256()
        with zipfile.ZipFile(archive) as bundle, bundle.open(member) as source, csv.open("wb") as stream:
            while chunk := source.read(1024 * 1024):
                digest.update(chunk)
                stream.write(chunk)
        if digest.hexdigest() != expected_hash:
            raise ValueError(f"MOX checksum mismatch for {member}")
        csv.replace(destination)
    print(f"{condition}: {member} from {ARCHIVE} (sha256 {expected_hash})")


if __name__ == "__main__":
    replay(*map(Path, sys.argv[1:]))
