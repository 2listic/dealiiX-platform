import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listRemoteGraphFiles, readRemoteGraphFile } from './remoteFilePicker'

const invoke = vi.fn()
vi.stubGlobal('window', { electron: { invoke } })

beforeEach(() => {
  invoke.mockReset()
})

describe('remote graph file picker', () => {
  it('lists JSON files directly in the remote working directory', async () => {
    invoke.mockResolvedValue('graph-b.json\nnotes.txt\ngraph-a.json\n')

    await expect(listRemoteGraphFiles('/remote/work space')).resolves.toEqual([
      'graph-b.json',
      'graph-a.json',
    ])

    expect(invoke).toHaveBeenCalledWith('execute-ssh-with-key', {
      command:
        "find '/remote/work space' -maxdepth 1 -type f -name '*.json' -exec basename {} \\; | sort",
      rejectOnNonZeroCode: true,
    })
  })

  it('reads a selected remote file relative to the working directory', async () => {
    invoke.mockResolvedValue('{"workflow":{"nodes":{},"edges":{}}}')

    await expect(
      readRemoteGraphFile("/remote/user's workspace", 'graph.json')
    ).resolves.toBe('{"workflow":{"nodes":{},"edges":{}}}')

    expect(invoke).toHaveBeenCalledWith('execute-ssh-with-key', {
      command:
        "test -f '/remote/user'\\''s workspace/graph.json' && cat '/remote/user'\\''s workspace/graph.json'",
      rejectOnNonZeroCode: true,
    })
  })

  it('rejects file names that escape the remote working directory', async () => {
    await expect(
      readRemoteGraphFile('/remote/work', '../graph.json')
    ).rejects.toThrow(/remain inside/)
    expect(invoke).not.toHaveBeenCalled()
  })
})
