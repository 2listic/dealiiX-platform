#!/usr/bin/env python3
"""MOX QAV -> native MetricFlowX; preserve the complete supplied history."""
import argparse
import csv
import hashlib
import json
import os
from pathlib import Path
import shutil
import shlex
import socket
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
RELEASE = "https://github.com/dealii-X/dealii-X/releases/download/assets/"
REVISION = "7ebd35b4c1166ae41e34831f29f9c79bcefc957c"
THREAD_VARIABLES = ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS",
                    "DEAL_II_NUM_THREADS", "NUMEXPR_NUM_THREADS")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(command, **kwargs):
    print("+", " ".join(map(str, command)), flush=True)
    subprocess.run(list(map(str, command)), check=True, **kwargs)


def assets(base):
    base.mkdir(parents=True, exist_ok=True)
    manifest_path = base / "assets-manifest.json"
    if not manifest_path.exists():
        urllib.request.urlretrieve(RELEASE + manifest_path.name, manifest_path)
    manifest = json.loads(manifest_path.read_text())
    archive = base / "assets.zip"
    if not archive.exists():
        urllib.request.urlretrieve(RELEASE + archive.name, archive)
    if digest(archive) != manifest["archive"]["sha256"]:
        raise ValueError("MOX archive checksum mismatch")
    target = base / "assets"
    target.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        for item in manifest["files"]:
            name = item["name"]
            if Path(name).name != name:
                raise ValueError("Unexpected asset path")
            data = z.read(name)
            if hashlib.sha256(data).hexdigest() != item["sha256"]:
                raise ValueError(f"MOX member checksum mismatch: {name}")
            path = target / name
            if path.exists() and path.read_bytes() != data:
                raise ValueError(f"Refusing to overwrite modified asset: {path}")
            if not path.exists():
                path.write_bytes(data)
    return target


def cardiac_inputs(raw, output):
    with raw.open() as f:
        rows = list(csv.DictReader(line for line in f if line.strip()))
    fields = ("time", "QAV", "pressure_AA", "volume_LV")
    import numpy as np
    values = np.array([[float(row[key]) for key in fields] for row in rows])
    if not np.isfinite(values).all() or not (np.diff(values[:, 0]) > 0).all():
        raise ValueError("Invalid MOX time series")
    if abs(values[0, 0]) > 1e-12 or abs(values[-1, 0] - 8) > 1e-12:
        raise ValueError("This comparison requires the supplied 0-8 s history")
    # This snapshot uses 133.322 Pa/mmHg for its 0D-to-3D pressure transfer.
    systemic_0d = np.array([float(row["pARSYS"]) for row in rows]) * 133.322
    pressure_transfer_error = float(np.max(np.abs(values[:, 2] - systemic_0d)))
    if pressure_transfer_error > 1e-3:
        raise ValueError("pressure_AA no longer matches the MOX systemic 0D pressure")
    with (output / "inflow.csv").open("w") as f:
        writer = csv.writer(f)
        writer.writerow(("time_s", "flow_m3_s"))
        writer.writerows(zip(values[:, 0], values[:, 1] * 1e-6))
    with (output / "heart_reference.csv").open("w") as f:
        writer = csv.writer(f)
        writer.writerow(("time_s", "flow_m3_s", "pressure_Pa", "volume_LV_mL"))
        writer.writerows(zip(values[:, 0], values[:, 1] * 1e-6,
                             values[:, 2], values[:, 3]))
    return {"samples": len(rows), "time_start_s": values[0, 0],
            "time_end_s": values[-1, 0], "minimum_QAV_mL_s": values[:, 1].min(),
            "maximum_QAV_mL_s": values[:, 1].max(), "source_sha256": digest(raw),
            "MOX_pressure_AA_vs_0D_pARSYS_max_difference_Pa": pressure_transfer_error}


def parameters(args, out):
    template = Path(__file__).with_name("parameters") / f"{args.model}.prm.in"
    return (template.read_text()
            .replace("@DATA_DIR@", str(out))
            .replace("@REFINEMENTS@", str(args.refinements)))


def prepare(args, source, out):
    run(["git", "-C", source, "merge-base", "--is-ancestor", REVISION, "HEAD"])
    out.mkdir(parents=True, exist_ok=True)
    if (out / "output").exists():
        raise ValueError(f"Results already exist: {out}/output; choose a fresh --output")
    if args.model == "adavn_full":
        network = out / "network"
        if not (network / "provenance.json").exists():
            cache = args.adavn_cache
            if not cache:
                cache = out.parent / "adan_sources"
                command = [sys.executable, source / "tools/adan/download_sources.py",
                           "--data-dir", cache]
                if args.geometry == "anatomical":
                    if os.environ.get("ADAVN_ATLAS_PERMISSION") != "1":
                        raise ValueError("Anatomical atlas download requires ADAVN_ATLAS_PERMISSION=1; "
                                         "or supply an existing authorized --adavn-cache")
                    command += ["--include-atlas", "--include-veins", "--atlas-permission"]
                run(command)
            with (out / "prepare_network.log").open("w") as log:
                run([sys.executable, source / "tools/adan/prepare_full.py",
                     "--data-dir", cache, "--output-dir", network,
                     "--geometry", args.geometry], stdout=log, stderr=subprocess.STDOUT)
        provenance = json.loads((network / "provenance.json").read_text())
        if provenance["geometry_mode"] != args.geometry:
            raise ValueError("Prepared geometry differs from requested geometry")
        for name, checksum in provenance["sha256"].items():
            if digest(network / name) != checksum:
                raise ValueError(f"Prepared network checksum mismatch: {name}")
    else:
        (out / "network").mkdir(exist_ok=True)
        shutil.copy2(source / "tutorials/04_adan56/network.vtk", out / "network/network.vtk")
    raw_dir = assets(out.parent)
    receipt = cardiac_inputs(raw_dir / "electromechanics.csv", out)
    (out / "parameters.prm").write_text(parameters(args, out))
    receipt.update(model=args.model, ranks=32 if args.model == "adavn_full" else 4,
                   threads_per_rank=1, source_revision=subprocess.check_output(
                       ["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip(),
                   executable=str(args.executable), executable_sha256=digest(args.executable),
                   parameters_sha256=digest(out / "parameters.prm"),
                   cardiac_period_s=args.period, cardiac_period_basis="Explicit analysis convention; QAV peaks separated by 0.8 s",
                   final_four_cycles_start_s=4.8, coupling="one-way QAV; no clipping, repetition, pressure shift or phase alignment")
    (out / "provenance.json").write_text(json.dumps(receipt, indent=2) + "\n")


def plot(args, out):
    import numpy as np
    os.environ.setdefault("MPLCONFIGDIR", "/tmp/heart-circulation-matplotlib")
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    heart = np.genfromtxt(out / "heart_reference.csv", delimiter=",", names=True)
    times, pressure, flow = [], [], []
    with (out / "output/terminals.csv").open() as f:
        for row in csv.DictReader(f):
            if int(row["boundary_id"]) == 0:
                times.append(float(row["time_s"]))
                pressure.append(float(row["pressure_Pa"]))
                flow.append(-float(row["flow_m3_s"]))  # outward -> into network
    t, p, q = map(np.array, (times, pressure, flow))
    if len(t) < 2 or abs(t[-1] - 8) > 1e-9 or not np.isfinite(p).all():
        raise ValueError("Simulation did not finish the supplied history")
    if not np.all(np.diff(t) > 0):
        raise ValueError("Repeated/misordered inlet export")
    start = 8 - args.period
    selected = t >= start - 1e-9
    t, p, q = t[selected], p[selected], q[selected]
    reference = np.interp(t, heart["time_s"], heart["pressure_Pa"])
    prescribed = np.interp(t, heart["time_s"], heart["flow_m3_s"])
    volume = np.interp(t, heart["time_s"], heart["volume_LV_mL"])
    if len(t) < 100 or abs(t[0] - start) > 1e-8:
        raise ValueError("Insufficient last-cycle coverage")
    mmhg = 133.322387415
    fig, axes = plt.subplots(1, 3, figsize=(15, 4.4), constrained_layout=True)
    for pp, label in ((p, args.model + " inlet"), (reference, "MOX ascending aorta (0D)")):
        axes[0].plot(t - start, pp / mmhg, label=label)
        axes[1].plot(prescribed * 1e6, pp / mmhg, label=label)
        axes[2].plot(volume, pp / mmhg, label=label)
    axes[0].set(xlabel="Time in last cycle [s]", ylabel="Pressure [mmHg]")
    axes[1].set(xlabel="Aortic-valve flow [mL/s]", ylabel="Pressure [mmHg]", title="Pressure–flow loop")
    axes[2].set(xlabel="MOX left-ventricular volume [mL]", ylabel="Aortic pressure [mmHg]", title="Aortic pressure vs MOX LV volume")
    axes[0].legend(fontsize=8)
    for ax in axes:
        ax.grid(alpha=.25)
    fig.suptitle(f"{args.model}: MOX forcing, {start:g}–8 s; no pressure/phase adjustment")
    for ext in ("png", "pdf", "svg"):
        fig.savefig(out / f"pressure_loops.{ext}", dpi=180)
    plt.close(fig)
    error = p - reference
    duration = t[-1] - t[0]
    average = lambda value: float(np.trapezoid(value, t) / duration)
    metrics = dict(last_cycle_start_s=start, last_cycle_end_s=float(t[-1]),
                   samples=len(t), mean_inlet_pressure_mmHg=average(p)/mmhg,
                   mean_MOX_pressure_mmHg=average(reference)/mmhg,
                   pressure_rmse_mmHg=average(error**2)**.5/mmhg,
                   maximum_pressure_difference_mmHg=float(np.max(np.abs(error)))/mmhg,
                   max_inlet_flow_error_m3_s=float(np.max(np.abs(q-prescribed))),
                   pressure_difference_is_calibration_metric=True,
                   pressure_volume_plot="Aortic pressures against shared MOX LV volume; not an LV pressure-volume loop")
    metrics["max_inlet_flow_error_fraction_of_peak"] = metrics["max_inlet_flow_error_m3_s"] / float(np.max(np.abs(prescribed)))
    metrics["inlet_flow_acceptance_fraction_of_peak"] = 1e-3
    if metrics["max_inlet_flow_error_fraction_of_peak"] > 1e-3:
        raise ValueError(f"Inlet did not reproduce QAV: {metrics}")
    previous = np.interp(t - args.period, times, pressure)
    metrics["last_vs_previous_pressure_rmse_mmHg"] = average((p-previous)**2)**.5/mmhg
    mass = np.genfromtxt(out / "output/mass_conservation.csv", delimiter=",", names=True)
    last_mass = mass[mass["t"] >= start - 1e-9]
    delta_volume = float(last_mass["total_volume"][-1] - last_mass["total_volume"][0])
    integrated_flux = float(np.trapezoid(last_mass["net_flux"], last_mass["t"]))
    stroke_volume = float(np.trapezoid(prescribed, t))
    metrics["last_cycle_mass_defect_m3"] = delta_volume - integrated_flux
    metrics["last_cycle_mass_defect_fraction_of_stroke_volume"] = abs(delta_volume-integrated_flux)/abs(stroke_volume)
    metrics["last_cycle_max_mass_imbalance_m3_s"] = float(np.max(np.abs(last_mass["imbalance"])))
    metrics["last_cycle_minimum_network_volume_m3"] = float(np.min(last_mass["total_volume"]))
    import meshio
    final_mesh = out / "output" / f"{args.model}_01600.pvtu"
    pieces = ET.parse(final_mesh).findall(".//Piece")
    minimum_area, exported_points = float("inf"), 0
    for piece in pieces:
        mesh = meshio.read(final_mesh.parent / piece.attrib["Source"])
        for field in ("area", "velocity", "pressure"):
            if not np.isfinite(mesh.point_data[field]).all():
                raise ValueError(f"Nonfinite final VTK field: {field}")
        minimum_area = min(minimum_area, float(np.min(mesh.point_data["area"])))
        exported_points += len(mesh.points)
    if minimum_area <= 0 or len(pieces) != (32 if args.model == "adavn_full" else 4):
        raise ValueError("Invalid final MPI mesh output")
    metrics["final_vtk_minimum_sampled_area_m2"] = minimum_area
    metrics["final_vtk_exported_points"] = exported_points
    metrics["final_vtk_rank_pieces"] = len(pieces)
    native = json.loads((out / "output/initialization_statistics.json").read_text())
    if native["ramp_last_relative_factor"] != 1 or native["ramp_last_absolute_factor"] != 1:
        raise ValueError("Final tolerance ramp did not reach the configured precision")
    metrics["final_relative_tolerance_multiplier"] = native["ramp_last_relative_factor"]
    metrics["final_absolute_tolerance_multiplier"] = native["ramp_last_absolute_factor"]
    (out / "comparison.json").write_text(json.dumps(metrics, indent=2) + "\n")
    np.savetxt(out / "last_cycle.csv", np.column_stack((t,p,reference,q,prescribed,volume)),
               delimiter=",", header="time_s,inlet_pressure_Pa,MOX_pressure_Pa,inlet_flow_m3_s,QAV_m3_s,MOX_LV_volume_mL", comments="")
    print(json.dumps(metrics, indent=2))


def main():
    for key in THREAD_VARIABLES:
        os.environ[key] = "1"
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("model", choices=("adavn_full", "adan56"))
    p.add_argument("--stage", choices=("prepare", "run", "plot", "all"), default="all")
    p.add_argument("--source", type=Path, default=os.environ.get("METRIC_FLOW_SOURCE"))
    p.add_argument("--executable", type=Path, default=os.environ.get("BLOOD_FLOW_EXECUTABLE"))
    p.add_argument("--output", type=Path)
    p.add_argument("--adavn-cache", type=Path, default=os.environ.get("ADAVN_SOURCE_CACHE"))
    p.add_argument("--geometry", choices=("anatomical", "metric"), default="anatomical")
    p.add_argument("--refinements", type=int, default=3)
    p.add_argument("--period", type=float, choices=(.8,), default=.8,
                   help="Analysis period for this MOX snapshot; does not repeat the input")
    p.add_argument("--launcher", default=os.environ.get("MPIEXEC", "mpiexec"))
    p.add_argument("--submit", action="store_true", help="Submit execution and plotting to a dedicated Slurm job")
    p.add_argument("--partition", default="gpu")
    p.add_argument("--dependency", help="Optional Slurm dependency, e.g. afterok:12345")
    p.add_argument("--allow-local", action="store_true", help="Explicitly permit execution outside Slurm")
    args = p.parse_args()
    out = (args.output or ROOT / "local_runs/heart_circulation" / args.model).resolve()
    if args.stage in ("prepare", "all"):
        if args.source is None or args.executable is None:
            p.error("Set --source and --executable (MetricFlowX PR #82, including #80)")
        args.source, args.executable = args.source.resolve(), args.executable.resolve()
        if not args.executable.is_file():
            p.error("Missing blood_flow executable")
        prepare(args, args.source, out)
    if args.submit:
        receipt = json.loads((out / "provenance.json").read_text())
        base = [sys.executable, str(Path(__file__).resolve()), args.model,
                "--output", str(out), "--launcher", args.launcher]
        batch = out / "run.sbatch"
        batch.write_text("#!/usr/bin/env bash\nset -euo pipefail\n" +
                         shlex.join(base + ["--stage", "run"]) + "\n" +
                         shlex.join(base + ["--stage", "plot"]) + "\n")
        command = ["sbatch", "--parsable", "--partition", args.partition,
                   "--nodes", "1", "--ntasks", str(receipt["ranks"]),
                   "--cpus-per-task", "1", "--hint=nomultithread", "--mem=32G",
                   "--time=02:00:00", "--job-name", "mox-" + args.model,
                   "--output", str(out / "slurm-%j.log"), str(batch)]
        if args.dependency:
            command[1:1] = ["--dependency", args.dependency]
        job = subprocess.check_output(command, text=True).strip()
        (out / "slurm_job_id.txt").write_text(job + "\n")
        print("Submitted Slurm job", job)
        return
    if args.stage in ("run", "all"):
        if not os.environ.get("SLURM_JOB_ID") and not args.allow_local:
            p.error("Use --submit for Slurm, or explicitly select --allow-local on a standalone machine")
        receipt = json.loads((out / "provenance.json").read_text())
        executable = Path(receipt["executable"])
        if digest(executable) != receipt["executable_sha256"] or digest(out / "parameters.prm") != receipt["parameters_sha256"]:
            raise ValueError("Prepared executable/parameters changed")
        if (out / "output").exists():
            raise ValueError("Refusing to overwrite an existing simulation")
        env = os.environ.copy()
        mpi_temp = tempfile.mkdtemp(prefix=f"mox-mpi-{env.get('SLURM_JOB_ID', 'local')}-")
        env["TMPDIR"] = mpi_temp
        env["OMPI_MCA_shmem_mmap_relocate_backing_file"] = "1"
        env["OMPI_MCA_shmem_mmap_backing_file_base_dir"] = mpi_temp
        # OpenMPI on this site can expand the batch affinity mask. Choose one
        # OS CPU per physical core from the inherited allocation and let each
        # newly launched rank bind itself before exec, without a nested launcher.
        cores = {}
        for cpu in sorted(os.sched_getaffinity(0)):
            topology = Path(f"/sys/devices/system/cpu/cpu{cpu}/topology")
            key = ((topology / "physical_package_id").read_text().strip(),
                   (topology / "core_id").read_text().strip())
            cores.setdefault(key, cpu)
        selected_cpus = list(cores.values())[:receipt["ranks"]]
        if len(selected_cpus) != receipt["ranks"]:
            raise ValueError("Fewer allocated physical cores than requested MPI ranks")
        binding_dir = out / "rank_bindings"
        binding_dir.mkdir(exist_ok=True)
        env["DEALIIX_RANK_CPUS"] = ",".join(map(str, selected_cpus))
        env["DEALIIX_BINDING_DIR"] = str(binding_dir)
        runtime = dict(host=socket.gethostname(), slurm_job_id=env.get("SLURM_JOB_ID"),
                       batch_allowed_os_cpus=sorted(os.sched_getaffinity(0)),
                       selected_os_cpus=selected_cpus,
                       ranks=receipt["ranks"], computational_threads_per_rank=1,
                       mpi_binding="Each new rank binds to one allocated physical core before solver exec")
        (out / "runtime.json").write_text(json.dumps(runtime, indent=2) + "\n")
        with (out / "run.log").open("w") as log:
            launch = [args.launcher, "--bind-to", "none", "-n", str(receipt["ranks"]),
                      sys.executable, Path(__file__).with_name("rank_entry.py")]
            run(launch + [executable, out / "parameters.prm"],
                cwd=out, env=env, stdout=log, stderr=subprocess.STDOUT)
        for rank, cpu in enumerate(selected_cpus):
            recorded = json.loads((binding_dir / f"rank_{rank:02d}.json").read_text())
            if recorded["rank"] != rank or recorded["allowed_os_cpus"] != [cpu]:
                raise ValueError(f"Rank {rank} did not bind to its allocated core")
    if args.stage in ("plot", "all"):
        plot(args, out)


if __name__ == "__main__":
    main()
