#!/bin/bash
#SBATCH --chdir=/app/shared-data
#SBATCH --output=/app/shared-data/slurm-%j.out
#SBATCH --job-name=coral-{{INTERNAL_JOB_ID}}
#SBATCH --nodes={{NODES}}
#SBATCH --ntasks-per-node={{NTASKS_PER_NODE}}
#SBATCH --time={{TIME_LIMIT}}

mpirun --allow-run-as-root -np ${SLURM_NTASKS:-1} /app/build/core/coral --plugin /app/build/backends/dealii/libcoral_backend_dealii.so {{RUN_FLAGS}} --touch-dir nodes-exec-status/{{INTERNAL_JOB_ID}}
