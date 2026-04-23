#!/bin/bash
#SBATCH --chdir={{WORKING_DIRECTORY}}
#SBATCH --output={{WORKING_DIRECTORY}}/slurm-%j.out
#SBATCH --job-name=coral-{{INTERNAL_JOB_ID}}
#SBATCH --nodes={{NODES}}
#SBATCH --ntasks-per-node={{NTASKS_PER_NODE}}
#SBATCH --time={{TIME_LIMIT}}

mpirun --allow-run-as-root -np ${SLURM_NTASKS:-1} {{CORAL_BINARY_PATH}} --plugin {{CORAL_PLUGIN_PATH}} run {{WORKING_DIRECTORY}}/graph.json --touch-dir nodes-exec-status/{{INTERNAL_JOB_ID}}
