import { normalizeRelativeParameterPath } from './workspacePath'

type VtkVisualizerUrlTarget = {
  workingDirectory: string
  fileName: string
}

/**
 * Builds a visualizer deep link without loading the reactive settings store.
 * @param visualizerUrl - Base URL of the visualizer service.
 * @param target - Working directory and relative VTK filename.
 * @returns URL that opens the requested VTK file.
 * @throws Error when the visualizer URL, working directory, or filename is invalid.
 */
export const buildVtkVisualizerUrl = (
  visualizerUrl: string,
  target: VtkVisualizerUrlTarget
): string => {
  if (!visualizerUrl.trim()) {
    throw new Error('A VTK visualizer URL is required')
  }
  if (!target.workingDirectory.trim()) {
    throw new Error('A working directory is required to open a VTK file')
  }

  const relativeFileName = normalizeRelativeParameterPath(target.fileName)
  const baseUrl = visualizerUrl.endsWith('/')
    ? visualizerUrl
    : `${visualizerUrl}/`
  const url = new URL('api/open', baseUrl)
  url.searchParams.set('working_directory', target.workingDirectory)
  url.searchParams.set('file', relativeFileName)
  return url.toString()
}
