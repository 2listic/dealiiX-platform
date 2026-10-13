import fs from 'fs'
import path from 'path'

const resolveParameterFile = (
  workingDirectory: string,
  fileName: string
): string => {
  if (!workingDirectory?.trim()) {
    throw new Error('A local working directory is required')
  }
  if (!fileName?.trim() || path.isAbsolute(fileName)) {
    throw new Error(
      'Parameter file names must be relative to the working directory'
    )
  }

  const root = path.resolve(workingDirectory)
  const resolved = path.resolve(root, fileName)
  const relative = path.relative(root, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Parameter file must remain inside the working directory')
  }
  return resolved
}

const assertRegularFile = async (filePath: string): Promise<void> => {
  const stat = await fs.promises.stat(filePath)
  if (!stat.isFile()) throw new Error(`Not a regular file: ${filePath}`)
}

export const localParameterFileExists = async (
  workingDirectory: string,
  fileName: string
): Promise<boolean> => {
  try {
    const filePath = resolveParameterFile(workingDirectory, fileName)
    await assertRegularFile(filePath)
    return true
  } catch {
    return false
  }
}

export const readLocalParameterFile = async (
  workingDirectory: string,
  fileName: string
): Promise<{ filePath: string; content: string }> => {
  const filePath = resolveParameterFile(workingDirectory, fileName)
  await assertRegularFile(filePath)
  return { filePath, content: await fs.promises.readFile(filePath, 'utf8') }
}

export const writeLocalParameterFile = async (
  workingDirectory: string,
  fileName: string,
  content: string
): Promise<{ filePath: string }> => {
  const filePath = resolveParameterFile(workingDirectory, fileName)
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
  await fs.promises.writeFile(filePath, content, 'utf8')
  return { filePath }
}
