/**
 * The VTK button's action on a string literal node: find the file in the
 * working directory and open it in coral-visualizer.
 */

import { settingsState } from '../stores/settingsStore.svelte'
import { toastState } from '../stores/toastsStore.svelte'
import { openNewWindow } from '../execution/sshMessages'
import {
  parameterFileExists,
  parameterFileTarget,
} from '../parameters/parameterFileAccess'
import { buildVtkVisualizerUrl } from './vtkVisualizerUrl'

/**
 * Opens a VTK file of the active location's working directory in
 * coral-visualizer; a missing file or a failure is reported in a toast.
 *
 * @param fileName - The file name, relative to the working directory.
 * @returns Resolves once the window opened or the failure was reported.
 */
export const openVtkFile = async (fileName: string): Promise<void> => {
  try {
    if (!settingsState.urlVisualizer) {
      throw new Error('Set the visualizer URL in Settings')
    }
    const target = parameterFileTarget('remote', fileName)
    if (!(await parameterFileExists(target))) {
      throw new Error('VTK file is not available in the working directory')
    }
    await openNewWindow(
      buildVtkVisualizerUrl(settingsState.urlVisualizer, target)
    )
  } catch (error) {
    toastState.add({
      message:
        error instanceof Error
          ? error.message
          : 'Failed to open the VTK visualizer',
      type: 'error',
    })
  }
}
