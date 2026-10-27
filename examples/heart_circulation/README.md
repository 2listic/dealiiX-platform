# MOX heart → ADAVN full / ADAN56

The scripts prescribe the complete supplied MOX `QAV` history at inlet 0 and
compare the exported inlet trace pressure with `pressure_AA`. This is one-way
coupling. The 0D systemic circulation does not receive feedback from the 1D
network. No negative-flow clipping, time repetition, pressure offset, or phase
alignment is applied.

`run_adavn_full.sh` uses 32 MPI ranks; `run_adan56.sh` uses 4. Both set one
computational thread per rank and run the original 0–8 s history. Analysis uses
0.8 s cycles, consistent with the observed QAV peak spacing. The last cycle is
7.2–8 s. The legend supplies the column meanings and units, but does not declare
the cardiac period; the analysis convention is recorded explicitly.

## Requirements

Use Linux and OpenMPI 5 with MetricFlowX PR #82, commit
`7ebd35b4c1166ae41e34831f29f9c79bcefc957c`, which includes PR #80's full
arterial–venous workflow. Build `blood_flow` in Release with PETSc, METIS,
SUNDIALS and a working parallel MUMPS configuration. Use the MPI launcher from
that build's toolchain. Python requires NumPy, SciPy, Matplotlib and meshio.
Keep the Python environment, source/build and result paths on a filesystem
shared by the compute nodes. The launcher creates a separate node-local MPI
temporary directory for each job, including its shared-memory backing files.

```bash
python3 -m venv /absolute/path/to/heart-venv
/absolute/path/to/heart-venv/bin/pip install -r examples/heart_circulation/requirements.txt
```

```bash
export METRIC_FLOW_SOURCE=/absolute/path/to/metric-flow-x
export BLOOD_FLOW_EXECUTABLE=/absolute/path/to/build/blood_flow
export MPIEXEC=/absolute/path/to/matching/mpiexec
export PYTHON=/absolute/path/to/python

examples/heart_circulation/run_adavn_full.sh --submit
examples/heart_circulation/run_adan56.sh --submit
```

`--submit` creates a dedicated single-node Slurm job in partition `gpu`, with
32 cores for ADAVN and 4 for ADAN56. Change the partition with `--partition`.
The job performs both the solve and plotting. Without `--submit`, run from a
suitable Slurm batch allocation; `--allow-local` explicitly permits standalone
execution. Each new rank binds itself to one physical core from the inherited
Linux affinity mask before executing the solver. `rank_bindings/` records the
actual per-rank OS CPU IDs. This avoids OpenMPI expanding the batch mask on
sites without Slurm PMIx support. Each script launches MPI once. Default results
are separate:

```text
local_runs/heart_circulation/adavn_full/
local_runs/heart_circulation/adan56/
```

Use `--output /absolute/fresh/directory` for another run. Existing simulation
outputs are preserved and cause an error. `--stage prepare`, `--stage run`, and
`--stage plot` expose the individual stages. `all` performs all three.

## Scientific inputs and geometry

The scripts download the MOX archive and manifest from the integration
repository's [assets release](https://github.com/dealii-X/dealii-X/releases/tag/assets).
They verify the archive and every member against SHA-256 before use. An existing
manifest fixes the local snapshot; modified extracted data are preserved by
rejecting overwrites. `QAV` is converted from mL/s to m³/s; `pressure_AA` remains
in Pa. The adapter also checks that `pressure_AA` matches `pARSYS`, the systemic
arterial pressure in the MOX 0D model, with the source's 133.322 Pa/mmHg
conversion. Original CSV and both legends remain beside the result folders.

ADAVN starts from `tutorials/05_adavn_full`: 4,041 arterial and 361 venous source
segments, 8,804 input cells and 1,679 peripheral connections. It regenerates the
grid and connections with `tools/adan/prepare_full.py`. An existing authorized
source cache can be supplied with:

```bash
export ADAVN_SOURCE_CACHE=/absolute/path/to/adan_source_cache
examples/heart_circulation/run_adavn_full.sh
```

Without a cache, the anatomical downloader requires `ADAVN_ATLAS_PERMISSION=1`
confirming the atlas permission specified by the upstream tutorial. For a full
network with synthetic metric coordinates, explicitly use `--geometry metric`;
this changes the geometry and is recorded in the generated provenance. Atlas
geometry and previews stay in the ignored local result directory.

ADAN56 copies `tutorials/04_adan56/network.vtk`, with 77 computational segments
and 31 RCR terminals, using three global refinements (616 cells) by default.
The local inlet-pressure check found 0.143 mmHg RMS between two and three
refinements over the last cycle, and 0.162 mmHg RMS between three and five over
the first complete cycle at final tolerances. These are checks of sensitivity
of the plotted inlet pressure, not a convergence claim for every network field.
The archived five-refinement reference ends before 8 s; its comparison uses
4.8–5.6 s only.
Use `--refinements 5` for the original tutorial resolution.
It retains the tutorial's HLL flux, unit penalty coefficients and
total-pressure factor 0.8;
ADAVN retains HLL_HDG and penalty 0.5. Both use native steady-network
initialization. `--refinements` permits a separate spatial study.

The ADAVN model retains its mixed elastic wall law, peripheral compartments
and fixed central venous reservoirs. ADAN56 retains its arterial wall law and
terminal RCRs. These two closures are different and are not calibrated to the
original MOX 0D model by these scripts.

## Transient and outputs

The tracked parameter files are `parameters/adavn_full.prm.in` and
`parameters/adan56.prm.in`. The preparation stage replaces `@DATA_DIR@` with the
absolute result directory and `@REFINEMENTS@` with the selected ADAN56 level.
The templates contain the physical model, solver controls and complete
tolerance schedule independently of the launcher code.

Both runs hold IDA tolerance multipliers at 1,000 until 4 s, tighten
geometrically over 4–4.8 s, and use final tolerances over 4.8–8 s (four cycles).
Final relative tolerance is `1e-5`; component absolute tolerances are `1e-6`
of reference area, `1e-6 m/s` velocity and `0.01 Pa` capacitor pressure.
BDF order is at most 2, maximum step is 0.02 s, and output cadence is 0.005 s.
The permissive early transient is not used for the pressure comparison.

Each result folder includes:

- `parameters.prm`, converted inflow and cardiac reference CSVs;
- grid/connection files, source checksums and executable/parameter receipts;
- native VTU, inlet/outlet traces, mass and flow-regime diagnostics;
- complete solver log and native IDA statistics;
- `pressure_loops.png`, `.pdf`, `.svg` and `last_cycle.csv`;
- `comparison.json`, with pressure error, inlet-flow reproduction,
  cycle-to-cycle drift and integrated last-cycle mass defect.

When a completed result folder is moved, `executed_parameters.prm` and
`executed_provenance.json` preserve the exact execution inputs; `parameters.prm`
has its absolute I/O paths rebased to the delivered folder, with updated checksums.

The analysis also reads all final parallel VTK pieces independently with
meshio, requiring finite area, velocity and pressure, and positive sampled area.

The figure shows pressure versus time, pressure–flow loops, and both aortic
pressures against the shared MOX left-ventricular volume. The latter is an
aortic-pressure/ventricular-volume comparison, **not a ventricular PV loop**.
The plotting stage requires full-duration output and checks that the inlet
reproduces the supplied flow. Pressure disagreement measures model/closure
differences as well as numerical error; agreement is not enforced by fitting.
The inlet-flow check allows a maximum error of 0.1% of the last-cycle peak.

Run the offline input and parameter checks with:

```bash
python3 -m unittest discover -s examples/heart_circulation -p test_workflow.py -v
```

Relevant open scientific work is tracked in
[MOX conventions #32](https://github.com/dealii-X/dealii-X/issues/32),
[network validation #33](https://github.com/dealii-X/dealii-X/issues/33), and
[ADAVN/ADAN56 comparison #41](https://github.com/dealii-X/dealii-X/issues/41).
The scripts do not establish mesh/time convergence or a calibrated physiological
closed loop.
