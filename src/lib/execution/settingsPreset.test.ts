import { describe, it, expect } from 'vitest'
import {
  applySuppliedSettings,
  buildSuppliedSettings,
  parseSettingsPreset,
} from './settingsPreset'
import { createDefaultSettings } from '../types/settingsTypes'

const release = buildSuppliedSettings({
  execution: {
    remote: {
      host: 'coral-ssh-slurm',
      port: 22,
      coralBinaryPath: '/usr/local/bin/coral-release',
    },
  },
})

const debug = buildSuppliedSettings({
  execution: {
    remote: {
      host: 'coral-ssh-slurm',
      port: 22,
      coralBinaryPath: '/usr/local/bin/coral-debug',
    },
  },
})

describe('parseSettingsPreset', () => {
  it('keeps fields the settings defaults have, with the same type', () => {
    const { preset, ignored } = parseSettingsPreset({
      settings: {
        urlVisualizer: 'http://coral-visualizer:8080',
        execution: {
          remote: { host: 'coral-ssh-slurm', port: 22 },
          local: { mpiLauncher: { kind: 'mpirun' } },
        },
      },
    })

    expect(preset).toEqual({
      settings: {
        urlVisualizer: 'http://coral-visualizer:8080',
        execution: {
          remote: { host: 'coral-ssh-slurm', port: 22 },
          local: { mpiLauncher: { kind: 'mpirun' } },
        },
      },
    })
    expect(ignored).toEqual([])
  })

  it('drops unknown fields, wrong types, bad enum values and probes', () => {
    const { preset, ignored } = parseSettingsPreset({
      settings: {
        execution: {
          remote: {
            host: 'coral-ssh-slurm',
            port: '22',
            hots: 'typo',
            mpiLauncher: { kind: 'aprun' },
            probes: { coral: { outcome: 'success', message: '' } },
          },
        },
      },
      selection: { location: 'cloud', backendKind: 'coral' },
      extra: true,
    })

    expect(preset).toEqual({
      settings: { execution: { remote: { host: 'coral-ssh-slurm' } } },
    })
    expect(ignored).toEqual([
      'settings.execution.remote.port',
      'settings.execution.remote.hots',
      'settings.execution.remote.mpiLauncher.kind',
      'settings.execution.remote.probes',
      'selection',
      'extra',
    ])
  })

  it('throws when the preset is not a JSON object', () => {
    expect(() => parseSettingsPreset([])).toThrow()
    expect(() => parseSettingsPreset(null)).toThrow()
  })
})

describe('buildSuppliedSettings', () => {
  it('is the defaults without a preset', () => {
    expect(buildSuppliedSettings({})).toEqual(createDefaultSettings())
  })

  it('overlays the preset on the defaults', () => {
    expect(release.execution.remote.host).toBe('coral-ssh-slurm')
    expect(release.execution.remote.mpiLauncher).toEqual({ kind: 'srun' })
  })
})

describe('applySuppliedSettings', () => {
  it('takes the supplied settings on first launch', () => {
    expect(applySuppliedSettings(undefined, release, undefined)).toEqual(
      release
    )
  })

  it('updates a field the user left as supplied last time', () => {
    const stored = structuredClone(release)

    const result = applySuppliedSettings(stored, debug, release)

    expect(result.execution.remote.coralBinaryPath).toBe(
      '/usr/local/bin/coral-debug'
    )
  })

  it('keeps a field the user changed', () => {
    const stored = structuredClone(release)
    stored.execution.remote.coralBinaryPath = '/home/me/coral'

    const result = applySuppliedSettings(stored, debug, release)

    expect(result.execution.remote.coralBinaryPath).toBe('/home/me/coral')
  })

  it('without a record, compares against the defaults', () => {
    const stored = createDefaultSettings()
    stored.execution.remote.port = 2223

    const result = applySuppliedSettings(stored, release, undefined)

    // `host` still held its default, `port` was changed by the user.
    expect(result.execution.remote.host).toBe('coral-ssh-slurm')
    expect(result.execution.remote.port).toBe(2223)
  })

  it('passes a changed default to a user who never touched the field', () => {
    const before = createDefaultSettings()
    const after = createDefaultSettings()
    after.urlVisualizer = 'http://localhost:8009'

    const result = applySuppliedSettings(createDefaultSettings(), after, before)

    expect(result.urlVisualizer).toBe('http://localhost:8009')
  })

  it('fills a field missing from stored settings', () => {
    const stored = createDefaultSettings()
    delete (stored.execution.remote as Partial<typeof stored.execution.remote>)
      .host

    const result = applySuppliedSettings(stored, release, release)

    expect(result.execution.remote.host).toBe('coral-ssh-slurm')
  })

  it('keeps the stored probe status', () => {
    const stored = structuredClone(release)
    stored.execution.remote.probes = {
      coral: { outcome: 'success', message: 'ok' },
    }

    const result = applySuppliedSettings(stored, debug, release)

    expect(result.execution.remote.probes).toEqual(
      stored.execution.remote.probes
    )
  })

  it('does not modify its inputs', () => {
    const stored = createDefaultSettings()
    const before = structuredClone(stored)

    applySuppliedSettings(stored, release, undefined)

    expect(stored).toEqual(before)
  })
})
