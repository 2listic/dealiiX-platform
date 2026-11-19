/**
 * The VTK button's action on a string literal node: find the file in the
 * working directory or the latest run, and open it in coral-visualizer.
 */

import { executionSelectionState } from '../stores/executionSelection.svelte'
import { jobIdMapState } from '../stores/jobsStore.svelte'
import { settingsState } from '../stores/settingsStore.svelte'
import { toastState } from '../stores/toastsStore.svelte'
import { openNewWindow } from '../execution/sshMessages'
import { buildVtkVisualizerUrl, findVtkVisualizerTarget } from './vtkVisualizer'

/**
 * Opens a VTK file of the active location in coral-visualizer. Looks for it in
 * the configured working directory, then in the latest run's directory; a
 * missing file or a failure is reported in a toast.
 *
 * @param fileName - The file name, relative to the working directory.
 * @returns Resolves once the window opened or the failure was reported.
 */
export const openVtkFile = async (fileName: string): Promise<void> => {
  try {
    const target = await findVtkVisualizerTarget(
      executionSelectionState.location,
      fileName,
      jobIdMapState.getLatestRunWorkingDirectory()
    )
    if (!target) {
      throw new Error(
        'VTK file is not available in the working directory or the last run directory'
      )
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
