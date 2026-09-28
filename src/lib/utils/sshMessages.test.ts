import { describe, expect, it, vi, beforeEach } from 'vitest'

// sshMessages.ts transitively imports several `.svelte.ts` stores that check
// `window.electron` at module-init time, so `window` must be stubbed globally
// before the module is (dynamically) imported.
const invoke = vi.fn()

vi.stubGlobal('window', {
  electron: {
    invoke,
    store: {
      get: vi.fn(async (_key: string, defaultValue: unknown) => defaultValue),
      set: vi.fn(async () => true),
      remove: vi.fn(async () => true),
    },
  },
})

const {
  ensureUniqueRemoteDir,
  submitExecutableStageRemote,
  submitCoralStageRemote,
} = await import('./sshMessages')

beforeEach(() => {
  invoke.mockReset()
})

/**
 * Drives a stage submission with every SSH round-trip stubbed and returns the
 * uploaded `job.sh`, so the generated sbatch script can be asserted directly.
 */
const uploadedBatchScript = async (
  config: Parameters<typeof submitExecutableStageRemote>[0]['config']
): Promise<string> => {
  const uploads: Record<string, string> = {}
  invoke.mockImplementation(
    async (channel: string, payload: Record<string, string>) => {
      if (channel === 'upload-file-ssh') {
        uploads[payload.remotePath] = payload.content
        return ''
      }
      // mkdir and sbatch share a channel; only sbatch must return a job id.
      return payload.command?.startsWith('sbatch') ? '4242' : ''
    }
  )

  await submitExecutableStageRemote({
    parameters: {},
    stageDir: '/data/stage-p0',
    config,
    dependencyJobIds: [],
  })
  return uploads['/data/stage-p0/job.sh']
}

const baseExecutableConfig = {
  executablePath: '/opt/step-70',
  parametersFileName: 'parameters.json',
  nodes: 2,
  tasksPerNode: 4,
  timeLimit: '02:00:00',
  useMpi: false,
}

describe('submitExecutableStageRemote batch script', () => {
  it('omits MPI resource directives and the launcher when MPI is off', async () => {
    const script = await uploadedBatchScript(baseExecutableConfig)

    expect(script).not.toContain('--nodes=')
    expect(script).not.toContain('--ntasks-per-node=')
    expect(script).not.toContain('srun')
    expect(script).not.toContain('mpirun')
    expect(script).toContain('"/opt/step-70" "parameters.json"')
  })

  it("requests the resources and launches through the target's launcher when MPI is on", async () => {
    const script = await uploadedBatchScript({
      ...baseExecutableConfig,
      useMpi: true,
    })

    expect(script).toContain('#SBATCH --nodes=2')
    expect(script).toContain('#SBATCH --ntasks-per-node=4')
    // srun is the remote default, and it takes the rank count from the
    // allocation requested above rather than restating it.
    expect(script).toContain('srun "/opt/step-70" "parameters.json"')
    expect(script).not.toContain('SLURM_NTASKS')
  })

  it('applies the configured time limit rather than the fallback', async () => {
    const script = await uploadedBatchScript(baseExecutableConfig)

    expect(script).toContain('#SBATCH --time=02:00:00')
  })

  it('absolutizes existing input files in the staged parameter file', async () => {
    const uploads: Record<string, string> = {}
    invoke.mockImplementation(
      async (channel: string, payload: Record<string, string>) => {
        if (channel === 'upload-file-ssh') {
          uploads[payload.remotePath] = payload.content
          return ''
        }

        if (channel === 'execute-ssh-with-key') {
          // The batched file check echoes back the paths that exist.
          if (payload.command?.startsWith('for p in')) {
            return payload.command.includes("'/app/shared-data/mesh.vtu'")
              ? '/app/shared-data/mesh.vtu\n'
              : ''
          }
          return payload.command?.startsWith('sbatch') ? '4242' : ''
        }

        return ''
      }
    )

    await submitExecutableStageRemote({
      parameters: {
        Mesh: {
          File: {
            value: 'mesh.vtu',
            default_value: 'mesh.vtu',
            documentation: '',
            pattern: '.*',
            pattern_description: '[Text]',
          },
        },
      },
      stageDir: '/data/stage-p0',
      config: baseExecutableConfig,
      dependencyJobIds: [],
    })

    expect(uploads['/data/stage-p0/parameters.json']).toContain(
      '"value": "/app/shared-data/mesh.vtu"'
    )
  })
})

describe('submitCoralStageRemote parameter staging', () => {
  it('stages referenced parameter files while preserving relative paths', async () => {
    const uploads: Record<string, string> = {}
    invoke.mockImplementation(
      async (channel: string, payload: Record<string, string>) => {
        if (channel === 'upload-file-ssh') {
          uploads[payload.remotePath] = payload.content
          return ''
        }
        if (payload.command?.startsWith('sbatch')) return '4242'
        if (payload.command?.includes('cat')) return 'set Value = 3\n'
        return ''
      }
    )

    await submitCoralStageRemote({
      graph: {
        workflow: {
          nodes: {
            '0': {
              type: 'std::string',
              value: 'nested/poisson.prm',
            },
          },
          edges: {},
        },
      },
      stageDir: '/app/shared-data/run-1',
      config: {
        coralBinaryPath: '/opt/coral',
        coralPluginPath: '/opt/plugin.so',
        nodes: 1,
        tasksPerNode: 2,
        timeLimit: '00:10:00',
        useMpi: false,
      },
      dependencyJobIds: [],
    })

    expect(uploads['/app/shared-data/run-1/nested/poisson.prm']).toBe(
      'set Value = 3\n'
    )
    expect(uploads['/app/shared-data/run-1/graph.json']).toContain(
      'nested/poisson.prm'
    )
  })

  it('materializes parameter inputs inside a subnetwork before upload', async () => {
    const uploads: Record<string, string> = {}
    let remoteParameterContent =
      'subsection ImmersX Coral Poisson\nset Initial refinement = 1\nend\n'
    invoke.mockImplementation(
      async (channel: string, payload: Record<string, string>) => {
        if (channel === 'upload-file-ssh') {
          uploads[payload.remotePath] = payload.content
          if (payload.remotePath === '/app/shared-data/nested/poisson.prm') {
            remoteParameterContent = payload.content
          }
          return ''
        }
        if (payload.command?.startsWith('sbatch')) return '4242'
        if (payload.command?.includes('cat')) {
          return remoteParameterContent
        }
        return ''
      }
    )

    await submitCoralStageRemote({
      graph: {
        workflow: {
          nodes: {
            '16': {
              type: 'coral::Network',
              node_type: 'network',
              name: 'step1 triangulation input free',
              arguments: [],
              inputs: [],
              outputs: [],
              value: {
                author: 'test',
                date_time_utc: '',
                version: 1,
                workflow: {
                  nodes: {
                    '13': {
                      type: 'std::string',
                      value: 'nested/poisson.prm',
                      parameter_file: {
                        exposures: [
                          {
                            path: [
                              'ImmersX Coral Poisson',
                              'Initial refinement',
                            ],
                            type: 'string',
                            input: true,
                            output: false,
                          },
                        ],
                      },
                    },
                    '15': { type: 'std::string', value: '4' },
                  },
                  edges: {
                    '0': {
                      source: 15,
                      source_output: 0,
                      target: 13,
                      target_handle:
                        'parameter-input-%5B%22ImmersX%20Coral%20Poisson%22%2C%22Initial%20refinement%22%5D',
                    },
                  },
                },
              },
            },
          },
          edges: {},
        },
      },
      stageDir: '/app/shared-data/run-nested',
      config: {
        coralBinaryPath: '/opt/coral',
        coralPluginPath: '/opt/plugin.so',
        nodes: 1,
        tasksPerNode: 2,
        timeLimit: '00:10:00',
        useMpi: false,
      },
      dependencyJobIds: [],
    })

    expect(uploads['/app/shared-data/run-nested/nested/poisson.prm']).toContain(
      'set Initial refinement = 4'
    )
    const uploadedGraph = uploads['/app/shared-data/run-nested/graph.json']
    expect(uploadedGraph).not.toContain('parameter_file')
    expect(uploadedGraph).not.toContain('target_handle')
    expect(uploadedGraph).toContain('"edges":{}')
  })

  it('binds an outer subnetwork input to a dangling parameter port', async () => {
    const uploads: Record<string, string> = {}
    let remoteParameterContent =
      'subsection ImmersX Coral Poisson\nset Initial refinement = 1\nend\n'
    invoke.mockImplementation(
      async (channel: string, payload: Record<string, string>) => {
        if (channel === 'upload-file-ssh') {
          uploads[payload.remotePath] = payload.content
          if (payload.remotePath === '/app/shared-data/nested/dangling.prm') {
            remoteParameterContent = payload.content
          }
          return ''
        }
        if (payload.command?.startsWith('sbatch')) return '4242'
        if (payload.command?.includes('cat')) return remoteParameterContent
        return ''
      }
    )

    await submitCoralStageRemote({
      graph: {
        workflow: {
          nodes: {
            '12': {
              type: 'coral::Network',
              node_type: 'network',
              name: 'step1 triangulation input free',
              arguments: [
                {
                  connection_type: 'input',
                  name: 'ImmersX Coral Poisson / Initial refinement',
                  type: 'std::string',
                },
              ],
              inputs: [0],
              outputs: [],
              value: {
                author: 'test',
                date_time_utc: '',
                version: 1,
                workflow: {
                  nodes: {
                    '13': {
                      type: 'std::string',
                      value: 'nested/dangling.prm',
                      parameter_file: {
                        exposures: [
                          {
                            path: [
                              'ImmersX Coral Poisson',
                              'Initial refinement',
                            ],
                            type: 'string',
                            input: true,
                            output: false,
                          },
                        ],
                      },
                    },
                  },
                  edges: {},
                },
              },
            },
            '14': { type: 'std::string', value: '4' },
          },
          edges: {
            '0': {
              source: 14,
              source_output: 0,
              target: 12,
              target_input: 0,
            },
          },
        },
      },
      stageDir: '/app/shared-data/run-dangling',
      config: {
        coralBinaryPath: '/opt/coral',
        coralPluginPath: '/opt/plugin.so',
        nodes: 1,
        tasksPerNode: 2,
        timeLimit: '00:10:00',
        useMpi: false,
      },
      dependencyJobIds: [],
    })

    expect(
      uploads['/app/shared-data/run-dangling/nested/dangling.prm']
    ).toContain('set Initial refinement = 4')
  })
})

describe('ensureUniqueRemoteDir', () => {
  it('returns the requested dir when it does not already exist', async () => {
    invoke.mockResolvedValueOnce('')

    const result = await ensureUniqueRemoteDir('/data/run-poisson')

    expect(result).toBe('/data/run-poisson')
    expect(invoke).toHaveBeenCalledTimes(1)
  })

  it('retries with a timestamp-suffixed dir when the first candidate collides', async () => {
    invoke.mockResolvedValueOnce('EXISTS').mockResolvedValueOnce('')

    const result = await ensureUniqueRemoteDir('/data/run-poisson')

    expect(result).toMatch(/^\/data\/run-poisson-\d+$/)
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting all retry attempts', async () => {
    invoke.mockResolvedValue('EXISTS')

    await expect(ensureUniqueRemoteDir('/data/run-poisson')).rejects.toThrow(
      'Could not allocate a unique directory under /data/run-poisson'
    )
    expect(invoke).toHaveBeenCalledTimes(3)
  })
})
