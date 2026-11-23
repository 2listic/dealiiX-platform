// Shared with the Electron main process, whose compiled ESM needs the `.js` suffix.
import {
  BACKEND_KINDS,
  EXECUTION_LOCATIONS,
  MPI_LAUNCHER_KINDS,
  createDefaultSettings,
  type AppSettings,
  type BackendKind,
  type ExecutionLocation,
} from '../types/settingsTypes.js'

/**
 * Settings values a preset may set: any field of {@link AppSettings} that has a
 * default, nested as in `AppSettings`. Probe status is never preset.
 */
export type SettingsPresetValues = Record<string, unknown>

/**
 * A preset as read from the file named by `DEALIIX_SETTINGS_PRESET`.
 */
export type SettingsPreset = {
  settings: SettingsPresetValues
  selection: Partial<{ location: ExecutionLocation; backendKind: BackendKind }>
}

/**
 * Validates a raw preset (parsed JSON) against the settings defaults. A field is
 * kept when the defaults have it with the same type; anything else is dropped
 * and reported, so a typo in the preset file never reaches the stored settings.
 *
 * @param raw - The parsed content of the preset file.
 * @returns The validated preset and the dotted paths of the dropped fields.
 * @throws {Error} When `raw` is not a JSON object.
 */
export const parseSettingsPreset = (
  raw: unknown
): { preset: SettingsPreset; ignored: string[] } => {
  if (!isPlainObject(raw)) {
    throw new Error('A settings preset must be a JSON object')
  }
  const ignored: string[] = []
  const settings = isPlainObject(raw.settings)
    ? filterAgainst(
        raw.settings,
        createDefaultSettings(),
        ['settings'],
        ignored
      )
    : {}
  if (raw.settings !== undefined && !isPlainObject(raw.settings)) {
    ignored.push('settings')
  }

  const selection: SettingsPreset['selection'] = {}
  if (isPlainObject(raw.selection)) {
    const { location, backendKind } = raw.selection
    if (location !== undefined) {
      if (isOneOf(location, EXECUTION_LOCATIONS)) selection.location = location
      else ignored.push('selection.location')
    }
    if (backendKind !== undefined) {
      if (isOneOf(backendKind, BACKEND_KINDS))
        selection.backendKind = backendKind
      else ignored.push('selection.backendKind')
    }
  } else if (raw.selection !== undefined) {
    ignored.push('selection')
  }

  for (const key of Object.keys(raw)) {
    if (key !== 'settings' && key !== 'selection') ignored.push(key)
  }
  return { preset: { settings, selection }, ignored }
}

/**
 * The settings the app supplies, as opposed to those the user chose: the
 * defaults, overlaid with the preset values of this installation.
 *
 * @param preset - The preset values, `{}` when there is no preset.
 * @returns A new settings object.
 */
export const buildSuppliedSettings = (
  preset: SettingsPresetValues
): AppSettings => {
  const supplied = createDefaultSettings()
  for (const { path, value } of leavesOf(preset)) setAt(supplied, path, value)
  return supplied
}

/**
 * Brings the stored settings up to date with the supplied ones, keeping what
 * the user changed. A field takes the supplied value when it is missing, or
 * when it still holds the value supplied last time; any other value was
 * chosen by the user and stays.
 *
 * @param stored - The stored settings, or `undefined` on first launch.
 * @param supplied - The settings supplied now, from {@link buildSuppliedSettings}.
 * @param lastSupplied - The settings supplied on the previous launch; the
 *   defaults when none were recorded.
 * @returns A new settings object; the inputs are not modified.
 */
export const applySuppliedSettings = (
  stored: AppSettings | undefined,
  supplied: AppSettings,
  lastSupplied: AppSettings | undefined
): AppSettings => {
  if (stored === undefined) return structuredClone(supplied)
  const previous = lastSupplied ?? createDefaultSettings()
  const result = structuredClone(stored)

  for (const { path, value } of leavesOf(supplied)) {
    const current = getAt(result, path)
    if (current === undefined || current === getAt(previous, path)) {
      setAt(result, path, value)
    }
  }
  return result
}

// ── Private helpers ──

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isOneOf = <T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is T => allowed.includes(value as T)

// Fields whose string value must come from a fixed list.
const ENUM_FIELDS: Record<string, readonly string[]> = {
  mpiLauncher: MPI_LAUNCHER_KINDS,
}

// Keeps the fields of `value` that `reference` has with the same type, recursing
// into nested objects. `path` is only used to name dropped fields.
const filterAgainst = (
  value: Record<string, unknown>,
  reference: unknown,
  path: string[],
  ignored: string[]
): Record<string, unknown> => {
  const kept: Record<string, unknown> = {}
  const allowedKinds: readonly string[] | undefined =
    ENUM_FIELDS[path[path.length - 1]]
  for (const [key, field] of Object.entries(value)) {
    const fieldPath = [...path, key]
    const ref = isPlainObject(reference) ? reference[key] : undefined

    if (key === 'probes' || ref === undefined) {
      ignored.push(fieldPath.join('.'))
    } else if (isPlainObject(ref)) {
      if (isPlainObject(field)) {
        const nested = filterAgainst(field, ref, fieldPath, ignored)
        if (Object.keys(nested).length > 0) kept[key] = nested
      } else {
        ignored.push(fieldPath.join('.'))
      }
    } else if (typeof field !== typeof ref) {
      ignored.push(fieldPath.join('.'))
    } else if (
      key === 'kind' &&
      allowedKinds &&
      !isOneOf(field, allowedKinds)
    ) {
      ignored.push(fieldPath.join('.'))
    } else {
      kept[key] = field
    }
  }
  return kept
}

// Probe status is per-user state, never supplied, so it is not walked.
const leavesOf = (
  value: Record<string, unknown>,
  path: string[] = []
): { path: string[]; value: unknown }[] =>
  Object.entries(value).flatMap(([key, field]) => {
    if (key === 'probes') return []
    return isPlainObject(field)
      ? leavesOf(field, [...path, key])
      : [{ path: [...path, key], value: field }]
  })

const getAt = (value: unknown, path: string[]): unknown =>
  path.reduce<unknown>(
    (node, key) => (isPlainObject(node) ? node[key] : undefined),
    value
  )

// Creates missing intermediate objects, for stored settings that predate a field.
const setAt = (target: object, path: string[], value: unknown): void => {
  let node = target as Record<string, unknown>
  for (const key of path.slice(0, -1)) {
    if (!isPlainObject(node[key])) node[key] = {}
    node = node[key] as Record<string, unknown>
  }
  node[path[path.length - 1]] = value
}
