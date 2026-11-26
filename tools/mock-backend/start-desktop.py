"""Launch Platform with a dedicated Local + CORAL backend settings preset."""

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def write_json(path, data):
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def parameter(path, description):
    return {
        "value": str(path),
        "default_value": str(path),
        "documentation": description,
        "pattern": "[Anything]",
        "pattern_description": "[Anything]",
    }


def prepare_preset(mode, configuration=None):
    profile = ROOT / ".ai" / "mock-desktop" / mode
    work = profile / "work"
    binary = HERE / "mock-backend"
    plugin = profile / "parameters.json"
    if mode in {"coral", "native"} and (mode == "native" or not plugin.exists()):
        coral = ROOT / "build/core/coral"
        dealii = ROOT / "build/backends/dealii/libcoral_backend_dealii.so"
        if not coral.is_file() or not os.access(coral, os.X_OK) or not dealii.is_file():
            raise SystemExit(f"This preset requires {coral} and {dealii}. Use --mock-only without them.")

    work.mkdir(parents=True, exist_ok=True)
    if mode == "orchestrator":
        binary, plugin = ROOT / "tools" / "orchestrator" / "orchestrator", configuration
    elif mode == "native":
        binary, plugin = coral, dealii
    elif not plugin.exists():
        parameters = json.loads((HERE / "parameters.json").read_text(encoding="utf-8"))
        parameters["Executables"] = {
            "local-example": {
                "Label": parameter("Local executable example", "Name in the parent palette"),
                "Binary": parameter(HERE / "example-local-executable", "Local executable path"),
                "InputTypes": parameter(
                    json.dumps(["std::string", "int", "double", "bool"]), "Types of workflow inputs"
                ),
            },
        }
        if mode == "coral":
            parameters["CORAL"] = {
                "Binary": parameter(coral, "Local CORAL executable"),
                "Plugin": parameter(dealii, "Local deal.II plugin"),
                "MPIEnabled": parameter("true", "Initialize MPI in the local CORAL child"),
            }
        write_json(plugin, parameters)

    preset = profile / "settings-preset.json"
    write_json(preset, {
        "settings": {"execution": {"local": {
            "workingDirectory": str(work),
            "coralBinaryPath": str(binary),
            "coralPluginPath": str(plugin),
        }}},
        "selection": {"location": "local", "backendKind": "coral"},
    })
    return preset, profile / "user-data"


def mock_python():
    venv = ROOT / ".venv-mock"
    python = venv / "bin" / "python"
    if not python.exists():
        subprocess.run([sys.executable, "-m", "venv", str(venv)], check=True)
    available = subprocess.run(
        [str(python), "-c", "import jsonschema, referencing"],
        capture_output=True,
    )
    if available.returncode:
        subprocess.run(
            [str(python), "-m", "pip", "install", "-r", str(HERE / "requirements.txt")],
            check=True,
        )
    return python


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--mock-only", dest="mode", action="store_const", const="mock",
                       help="Use the mock without CORAL delegation")
    modes.add_argument("--native-coral", dest="mode", action="store_const", const="native",
                       help="Use local CORAL directly")
    modes.add_argument("--orchestrator-config", type=Path,
                       help="Use the Python orchestrator with this configuration")
    parser.set_defaults(mode="coral")
    parser.add_argument("--prepare-only", action="store_true",
                        help="Write and print the preset path without launching the app")
    args = parser.parse_args()
    configuration = args.orchestrator_config
    mode = args.mode
    if configuration is not None:
        configuration = configuration.resolve()
        if not configuration.is_file():
            parser.error(f"Configuration file not found: {configuration}")
        mode = "orchestrator"
    preset, user_data = prepare_preset(mode, configuration)
    print(preset, flush=True)
    if args.prepare_only:
        return

    environment = {
        **os.environ,
        "DEALIIX_SETTINGS_PRESET": str(preset),
        "ELECTRON_USERDATA": str(user_data),
    }
    environment.pop("ELECTRON_RUN_AS_NODE", None)
    if mode != "native":
        python = mock_python()
        environment["PATH"] = f"{python.parent}{os.pathsep}{os.environ.get('PATH', os.defpath)}"
    os.chdir(ROOT)
    os.execvpe("npm", ["npm", "run", "dev"], environment)


if __name__ == "__main__":
    main()
