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

const { ensureUniqueRemoteDir } = await import('./sshMessages')

beforeEach(() => {
  invoke.mockReset()
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
