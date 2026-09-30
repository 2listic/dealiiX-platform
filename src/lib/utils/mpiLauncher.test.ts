import { describe, it, expect } from 'vitest'
import { buildLocalMpiArgs, buildMpiLauncherCommand } from './mpiLauncher'

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

describe('buildLocalMpiArgs', () => {
  it('prepends mpirun and the requested process count', () => {
    expect(
      buildLocalMpiArgs({ kind: 'mpirun' }, 4, '/opt/step-70', [
        'parameters.json',
      ])
    ).toEqual({
      command: 'mpirun',
      args: ['-np', '4', '/opt/step-70', 'parameters.json'],
    })
  })

  it('tokenizes configured launcher arguments without using a shell', () => {
    expect(
      buildLocalMpiArgs(
        { kind: 'mpirun', extraArgs: '--allow-run-as-root --mca "pml ^ucx"' },
        2,
        '/opt/my executable',
        ['parameters.json']
      ).args
    ).toEqual([
      '--allow-run-as-root',
      '--mca',
      'pml ^ucx',
      '-np',
      '2',
      '/opt/my executable',
      'parameters.json',
    ])
  })

  it('rejects Slurm launchers and invalid process counts locally', () => {
    expect(() =>
      buildLocalMpiArgs({ kind: 'srun' }, 2, '/opt/app', [])
    ).toThrow('requires the mpirun launcher')
    expect(() =>
      buildLocalMpiArgs({ kind: 'mpirun' }, 0, '/opt/app', [])
    ).toThrow('at least one process')
  })
})
