import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { parseSettingsPreset } from './settingsPreset'

// A settings field renamed or retyped in the app fails here, before a
// deployment loads a preset that silently no longer applies.
const PRESETS_DIR = join(process.cwd(), 'docker', 'presets')
const presetFiles = readdirSync(PRESETS_DIR).filter((f) => f.endsWith('.json'))

describe('docker/presets', () => {
  it('has preset files', () => {
    expect(presetFiles.length).toBeGreaterThan(0)
  })

  it.each(presetFiles)('%s applies every field it sets', (file) => {
    const raw = JSON.parse(readFileSync(join(PRESETS_DIR, file), 'utf8'))

    expect(parseSettingsPreset(raw).ignored).toEqual([])
  })
})
