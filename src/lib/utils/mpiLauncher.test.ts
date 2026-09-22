import { describe, it, expect } from 'vitest'
import { buildMpiLauncherCommand } from './mpiLauncher'

describe('buildMpiLauncherCommand', () => {
  it('renders the bare launcher when nothing extra is configured', () => {
    expect(buildMpiLauncherCommand({ kind: 'srun' })).toBe('srun')
    expect(buildMpiLauncherCommand({ kind: 'mpirun' })).toBe('mpirun')
  })

  it('never emits a rank count — Slurm supplies it from the allocation', () => {
    expect(buildMpiLauncherCommand({ kind: 'srun' })).not.toContain('-np')
    expect(buildMpiLauncherCommand({ kind: 'mpirun' })).not.toContain('-np')
  })

  it('appends extra arguments verbatim, which is how a PMI plugin is forced', () => {
    expect(
      buildMpiLauncherCommand({ kind: 'srun', extraArgs: '--mpi=pmix' })
    ).toBe('srun --mpi=pmix')
    expect(
      buildMpiLauncherCommand({
        kind: 'mpirun',
        extraArgs: '--allow-run-as-root',
      })
    ).toBe('mpirun --allow-run-as-root')
  })

  it('ignores blank extra arguments', () => {
    expect(buildMpiLauncherCommand({ kind: 'srun', extraArgs: '  ' })).toBe(
      'srun'
    )
  })
})
