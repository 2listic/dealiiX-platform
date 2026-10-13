/** VTK dataset extensions understood by coral-visualizer. */
const VTK_FILE_EXTENSION_RE = /\.(pvd|pvtu|vtu|vtk)$/i

/**
 * Returns true when a scalar value names a VTK dataset file.
 * @param value - Value to inspect.
 * @returns Whether the value is a supported VTK dataset filename.
 */
export const isVtkFileName = (value: unknown): value is string =>
  typeof value === 'string' && VTK_FILE_EXTENSION_RE.test(value.trim())
