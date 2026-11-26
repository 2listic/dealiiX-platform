/// <reference path="../../../electron/types/ssh2.d.ts" />

import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { expect, it, vi } from 'vitest'
import {
  importGraphFromProtocol,
  parseGraphWithQualifiedIds,
} from '../graph/graphParser'
import { getEdgesSnapshot, getNodesSnapshot } from '../stores/nodes.svelte'
import {
  getRegistryBackend,
  setActiveLocation,
  setRegistry,
} from '../stores/registryStore.svelte'
import { createDefaultSettings } from '../types/settingsTypes'
import { probeAndSyncExecutionSettings } from '../../../electron/utils/executionProbe'
import { protocolErrors } from './protocolSchemas'

vi.mock('../../../electron/utils/sshConnections.js', () => ({
  connectToSSHWithKey: vi.fn(),
}))

it('loads a graph using the registry returned by the register-only backend', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'platform-protocol-'))
  try {
    const fixture = resolve('test_files/protocol-mock')
    const binary = join(fixture, 'backend.cjs')
    const plugin = join(fixture, 'registry.json')
    const probe = await probeAndSyncExecutionSettings({
      location: 'local',
      backendKind: 'coral',
      target: {
        ...createDefaultSettings().execution.local,
        workingDirectory: directory,
        coralBinaryPath: binary,
        coralPluginPath: plugin,
      },
    })
    expect(probe.metadata?.kind, probe.status.message).toBe('nodeRegistry')
    if (probe.metadata?.kind !== 'nodeRegistry')
      throw new Error(probe.status.message)
    expect(protocolErrors('registry', probe.metadata.data)).toEqual([])
    expect(await setRegistry(probe.metadata.data, 'local')).toEqual([])
    setActiveLocation('local')

    const graph = JSON.parse(
      await readFile(join(fixture, 'network.json'), 'utf8')
    )
    const imported = await importGraphFromProtocol(graph)
    expect(imported.invalidEdges).toEqual([])
    expect(getNodesSnapshot().map(({ data }) => data.type)).toEqual([
      'std::string',
      'mock::sink',
    ])
    expect(getEdgesSnapshot()).toHaveLength(1)

    const identity = getRegistryBackend('local')
    expect(identity).toEqual(graph.backend)
    expect(getRegistryBackend('remote')).toBeUndefined()
    const exported = parseGraphWithQualifiedIds(
      getNodesSnapshot(),
      getEdgesSnapshot(),
      identity
    )
    expect(exported.backend).toEqual(graph.backend)
    expect(protocolErrors('network-execution', exported)).toEqual([])
    await expect(
      promisify(execFile)(binary, [
        '-p',
        plugin,
        'run',
        join(fixture, 'network.json'),
      ])
    ).rejects.toMatchObject({ code: 2 })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
