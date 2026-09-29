/**
 * Rewrites strings that name existing files while preserving the surrounding
 * JSON-like value. Path and filesystem operations are injected so this
 * traversal can be used for both local files and remote SSH checks.
 */
export const resolveExistingFileReferences = async <T>(
  value: T,
  resolvePath: (value: string) => string,
  isFile: (path: string) => Promise<boolean>
): Promise<T> => {
  const existence = new Map<string, Promise<boolean>>()

  const checkFile = (filePath: string): Promise<boolean> => {
    const cached = existence.get(filePath)
    if (cached) return cached

    const pending = isFile(filePath)
    existence.set(filePath, pending)
    return pending
  }

  const visit = async (current: unknown): Promise<unknown> => {
    if (typeof current === 'string') {
      const filePath = resolvePath(current)
      return (await checkFile(filePath)) ? filePath : current
    }

    if (Array.isArray(current)) {
      return await Promise.all(current.map((item) => visit(item)))
    }

    if (current !== null && typeof current === 'object') {
      const entries = await Promise.all(
        Object.entries(current).map(async ([key, item]) => [
          key,
          await visit(item),
        ])
      )
      return Object.fromEntries(entries)
    }

    return current
  }

  return (await visit(value)) as T
}
