import type { ExecutionLocation } from '../types/settingsTypes'
import {
  parameterFileExists,
  parameterFileTarget,
  type ParameterFileTarget,
} from './parameterFileAccess'
import { buildVtkVisualizerUrl } from './vtkVisualizerUrl'
import { normalizeRelativeParameterPath } from './workspacePath'

export { buildVtkVisualizerUrl } from './vtkVisualizerUrl'

/** The target path understood by the VTK visualizer deep link. */
export type VtkVisualizerTarget = ParameterFileTarget

/**
 * Resolves a VTK filename against the active local or remote working directory.
 * @param location - Execution location containing the file.
 * @param fileName - Relative VTK filename.
 * @returns Resolved visualizer target.
 */
export const vtkVisualizerTarget = (
  location: ExecutionLocation,
  fileName: string,
  workingDirectory?: string
): VtkVisualizerTarget => {
  const configuredTarget = parameterFileTarget(location, fileName)
  return workingDirectory?.trim()
    ? { ...configuredTarget, workingDirectory }
    : configuredTarget
}

/** Normalizes directory separators and removes trailing separators. */
const normalizeDirectory = (directory: string): string => {
  const normalized = directory.trim().replaceAll('\\', '/')
  const withoutTrailingSeparators = normalized.replace(/\/+$/, '')
  return withoutTrailingSeparators || (normalized.startsWith('/') ? '/' : '')
}

/**
 * Converts a file found below a run directory into a path below the configured
 * visualizer directory. The visualizer intentionally rejects working
 * directories other than its configured data directory, so a run directory
 * outside that root cannot be represented by a safe deep link.
 */
const fileNameFromConfiguredDirectory = (
  configuredDirectory: string,
  fileDirectory: string,
  fileName: string
): string | undefined => {
  const configured = normalizeDirectory(configuredDirectory)
  const directory = normalizeDirectory(fileDirectory)
  if (!configured || !directory) return undefined

  const relativeFileName = normalizeRelativeParameterPath(fileName)
  if (configured === directory) return relativeFileName

  const configuredPrefix = configured === '/' ? '/' : `${configured}/`
  if (!directory.startsWith(configuredPrefix)) return undefined

  const relativeDirectory = directory.slice(configuredPrefix.length)
  return relativeDirectory
    ? `${relativeDirectory}/${relativeFileName}`
    : relativeFileName
}

/**
 * Finds a VTK file in the configured working directory or the latest run
 * directory. Files found in a run directory are returned relative to the
 * configured working directory, which is the only working directory accepted
 * by the visualizer endpoint.
 * @param location - Execution location containing the file.
 * @param fileName - Relative VTK filename.
 * @param latestRunDirectory - Most recent run directory, if available.
 * @returns The first existing target, or undefined when no candidate exists.
 */
export const findVtkVisualizerTarget = async (
  location: ExecutionLocation,
  fileName: string,
  latestRunDirectory?: string
): Promise<VtkVisualizerTarget | undefined> => {
  const configuredTarget = vtkVisualizerTarget(location, fileName)
  const directories = [
    configuredTarget.workingDirectory,
    latestRunDirectory,
  ].filter((directory): directory is string => Boolean(directory?.trim()))
  const uniqueDirectories = [...new Set(directories)]

  for (const workingDirectory of uniqueDirectories) {
    const target = vtkVisualizerTarget(location, fileName, workingDirectory)
    if (!(await vtkVisualizerFileExists(target))) continue

    const visualizerFileName = fileNameFromConfiguredDirectory(
      configuredTarget.workingDirectory,
      workingDirectory,
      fileName
    )
    if (!visualizerFileName) return undefined

    return {
      ...configuredTarget,
      fileName: visualizerFileName,
    }
  }

  return undefined
}

/**
 * Checks whether the selected VTK file is already available at its target.
 * @param target - Visualizer target to check.
 * @returns Promise resolving to whether the file exists.
 */
export const vtkVisualizerFileExists = async (
  target: VtkVisualizerTarget
): Promise<boolean> => parameterFileExists(target)
