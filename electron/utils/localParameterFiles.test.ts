import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  localParameterFileExists,
  readLocalParameterFile,
  writeLocalParameterFile,
} from './localParameterFiles'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) =>
        fs.promises.rm(directory, { recursive: true, force: true })
      )
  )
})

const makeWorkingDirectory = async (): Promise<string> => {
  const directory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'dealiix-parameters-')
  )
  temporaryDirectories.push(directory)
  return directory
}

describe('localParameterFiles', () => {
  it('reads and writes an existing relative parameter file', async () => {
    const workingDirectory = await makeWorkingDirectory()
    await fs.promises.mkdir(path.join(workingDirectory, 'nested'))
    await fs.promises.writeFile(
      path.join(workingDirectory, 'nested', 'parameters.prm'),
      'set Value = 1\n'
    )

    expect(
      await localParameterFileExists(workingDirectory, 'nested/parameters.prm')
    ).toBe(true)
    await writeLocalParameterFile(
      workingDirectory,
      'nested/parameters.prm',
      'set Value = 2\n'
    )
    await expect(
      readLocalParameterFile(workingDirectory, 'nested/parameters.prm')
    ).resolves.toMatchObject({ content: 'set Value = 2\n' })
  })

  it('creates a missing parameter file and its parent directory', async () => {
    const workingDirectory = await makeWorkingDirectory()

    await expect(
      writeLocalParameterFile(
        workingDirectory,
        'generated/parameters.prm',
        'set Value = 1\n'
      )
    ).resolves.toMatchObject({
      filePath: path.join(workingDirectory, 'generated/parameters.prm'),
    })
    await expect(
      readLocalParameterFile(workingDirectory, 'generated/parameters.prm')
    ).resolves.toMatchObject({ content: 'set Value = 1\n' })
  })

  it('does not expose files outside the working directory', async () => {
    const workingDirectory = await makeWorkingDirectory()
    expect(
      await localParameterFileExists(workingDirectory, '../outside.prm')
    ).toBe(false)
    await expect(
      readLocalParameterFile(workingDirectory, '../outside.prm')
    ).rejects.toThrow('must remain inside')
  })

  it('reports missing files without throwing during availability checks', async () => {
    const workingDirectory = await makeWorkingDirectory()
    expect(
      await localParameterFileExists(workingDirectory, 'missing.json')
    ).toBe(false)
  })
})
