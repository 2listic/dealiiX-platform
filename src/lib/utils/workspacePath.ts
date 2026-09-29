/**
 * Normalises a relative POSIX path and rejects traversal outside its root.
 * @param fileName - Path relative to the selected working directory.
 * @returns Normalized relative path.
 * @throws Error when the path is absolute, escapes its root, or is empty.
 */
export const normalizeRelativeParameterPath = (fileName: string): string => {
  const normalized = fileName.trim().replaceAll('\\', '/')
  if (
    !normalized ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized)
  ) {
    throw new Error(
      'Parameter file names must be relative to the working directory'
    )
  }

  const parts: string[] = []
  for (const part of normalized.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (parts.length === 0) {
        throw new Error(
          'Parameter file must remain inside the working directory'
        )
      }
      parts.pop()
    } else {
      parts.push(part)
    }
  }
  if (parts.length === 0) throw new Error('Parameter file name is empty')
  return parts.join('/')
}
