import type { ExecutionLocation } from '../types/settingsTypes'
import {
  parameterFileExists,
  parameterFileTarget,
  type ParameterFileTarget,
} from './parameterFileAccess'
import { buildVtkVisualizerUrl } from './vtkVisualizerUrl'

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

/**
 * Finds a VTK file in the configured working directory or the latest run
 * directory, preserving the directory where the file was found for the URL.
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
    if (await vtkVisualizerFileExists(target)) return target
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
