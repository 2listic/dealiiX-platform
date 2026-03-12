#!/bin/bash
#SBATCH --chdir=/app/shared-data
#SBATCH --output=/app/shared-data/slurm-%j.out
#SBATCH --job-name=coral-{{INTERNAL_JOB_ID}}
#SBATCH --nodes=1
#SBATCH --ntasks-per-node=4
# #SBATCH --time=01:00:00

mpirun --allow-run-as-root -np ${SLURM_NTASKS:-1} /app/build/core/coral --plugin /app/build/backends/dealii/libcoral_backend_dealii.so run /app/shared-data/graph.json --touch-dir nodes-exec-status/{{INTERNAL_JOB_ID}}
