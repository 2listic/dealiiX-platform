import fs from 'fs'
import store from './storage.js'
import {
  applySuppliedSettings,
  buildSuppliedSettings,
  parseSettingsPreset,
  type SettingsPreset,
} from '../../src/lib/execution/settingsPreset.js'
import { isValidAppSettings } from '../../src/lib/types/settingsTypes.js'

/**
 * Brings the stored settings up to date with the ones the app supplies (the
 * defaults, overlaid with the preset file named by `DEALIIX_SETTINGS_PRESET`),
 * keeping what the user changed, and records the supplied settings for the
 * next launch. The preset's execution selection is stored only when none is.
 * Runs before the window opens, so the renderer and the SSH handlers read the
 * result. Stored settings of an unknown shape are left to the renderer, which
 * restores the defaults and says so.
 *
 * @returns Nothing; the result is written to the electron store.
 */
export function applyStartupSettings(): void {
  const preset = readPreset(process.env.DEALIIX_SETTINGS_PRESET)
  const stored = store.get('settings')
  if (stored !== undefined && !isValidAppSettings(stored)) {
    console.warn('Stored settings have an unknown shape; preset not applied')
    return
  }

  const lastSupplied = store.get('settings_supplied')
  const supplied = buildSuppliedSettings(preset.settings)
  store.set(
    'settings',
    applySuppliedSettings(
      stored,
      supplied,
      isValidAppSettings(lastSupplied) ? lastSupplied : undefined
    )
  )
  store.set('settings_supplied', supplied)

  if (
    Object.keys(preset.selection).length > 0 &&
    store.get('execution_selection') === undefined
  ) {
    store.set('execution_selection', preset.selection)
  }
}

// ── Private helpers ──

// A missing or broken preset file is logged and skipped, so the app still starts.
const readPreset = (file: string | undefined): SettingsPreset => {
  const none: SettingsPreset = { settings: {}, selection: {} }
  if (!file) return none
  try {
    const { preset, ignored } = parseSettingsPreset(
      JSON.parse(fs.readFileSync(file, 'utf8'))
    )
    if (ignored.length > 0) {
      console.warn(`Settings preset ${file}: ignored ${ignored.join(', ')}`)
    }
    return preset
  } catch (error) {
    console.error(`Settings preset ${file} not applied:`, error)
    return none
  }
}
