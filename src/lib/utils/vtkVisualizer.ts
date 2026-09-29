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
  fileName: string
): VtkVisualizerTarget => parameterFileTarget(location, fileName)

/**
 * Checks whether the selected VTK file is already available at its target.
 * @param target - Visualizer target to check.
 * @returns Promise resolving to whether the file exists.
 */
export const vtkVisualizerFileExists = async (
  target: VtkVisualizerTarget
): Promise<boolean> => parameterFileExists(target)
