import { readFile } from 'node:fs/promises'
import {
  BrowserWindow,
  dialog,
  type IpcMainInvokeEvent,
  type OpenDialogOptions,
} from 'electron/main'

export async function pickSettingsFile(
  event: IpcMainInvokeEvent,
  title: string,
  defaultPath: string
): Promise<{ document: unknown } | undefined> {
  const options: OpenDialogOptions = {
    title,
    defaultPath,
    properties: ['openFile'],
    filters: [{ name: 'Settings JSON', extensions: ['json'] }],
  }
  const parent = BrowserWindow.fromWebContents(event.sender)
  const { canceled, filePaths } = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options)
  if (canceled || !filePaths[0]) return
  return { document: JSON.parse(await readFile(filePaths[0], 'utf8')) }
}
