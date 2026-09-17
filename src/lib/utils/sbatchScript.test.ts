import { describe, it, expect } from 'vitest'
import { buildSbatchScript } from './sbatchScript'

const options = {
  jobName: 'coral-7',
  workingDirectory: '/app/shared-data/run-1',
  timeLimit: '01:00:00',
  command: '/app/coral run graph.json',
}

describe('buildSbatchScript', () => {
  it('emits a serial script with no resource directives and no launcher', () => {
    expect(buildSbatchScript({ ...options, mpi: null })).toBe(
      `#!/bin/bash
#SBATCH --chdir=/app/shared-data/run-1
#SBATCH --output=/app/shared-data/run-1/slurm-%j.out
#SBATCH --job-name=coral-7
#SBATCH --time=01:00:00

/app/coral run graph.json
`
    )
  })

  it('emits resource directives and the launcher prefix under MPI', () => {
    const script = buildSbatchScript({
      ...options,
      mpi: {
        nodes: 2,
        tasksPerNode: 4,
        launcher: { kind: 'srun', extraArgs: '--mpi=pmix' },
      },
    })

    expect(script).toBe(
      `#!/bin/bash
#SBATCH --chdir=/app/shared-data/run-1
#SBATCH --output=/app/shared-data/run-1/slurm-%j.out
#SBATCH --job-name=coral-7
#SBATCH --nodes=2
#SBATCH --ntasks-per-node=4
#SBATCH --time=01:00:00

srun --mpi=pmix /app/coral run graph.json
`
    )
  })

  it('keeps the command shell-quoted exactly as the caller supplied it', () => {
    const script = buildSbatchScript({
      ...options,
      jobName: 'executable-3',
      command: '"/app/my program" "parameters.json"',
      mpi: null,
    })

    expect(script).toContain('\n"/app/my program" "parameters.json"\n')
  })

  it('carries no OpenMPI-specific flags or rank count', () => {
    const script = buildSbatchScript({
      ...options,
      mpi: {
        nodes: 1,
        tasksPerNode: 4,
        launcher: { kind: 'srun' },
      },
    })

    expect(script).not.toContain('--allow-run-as-root')
    expect(script).not.toContain('SLURM_NTASKS')
    expect(script).toContain('\nsrun /app/coral run graph.json\n')
  })
})
