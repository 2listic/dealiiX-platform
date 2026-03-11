#!/bin/bash
#SBATCH --chdir=/app/shared-data
#SBATCH --output=/app/shared-data/slurm-%j.out
#SBATCH --job-name=coral-{{INTERNAL_JOB_ID}}

/app/build/core/coral --plugin /app/build/backends/dealii/libcoral_backend_dealii.so run /app/shared-data/graph.json --touch-dir {{INTERNAL_JOB_ID}}
