import type {
  ParameterLeaf,
  ParameterTree,
  ParameterNode,
} from '../types/parameterTypes'
import type { ExecutionLocation } from '../types/settingsTypes'

type ParamsByLocation = Record<ExecutionLocation, ParameterTree | null>

/**
 * Per-location executable parameter trees. Reads/writes resolve against the
 * {@link activeLocation} so each target keeps its own validated + edited params.
 */
let paramsByLocation = $state<ParamsByLocation>({
  local: null,
  remote: null,
})

/**
 * Location whose parameter tree `value`/`snapshot` resolve against. Set by the
 * execution-mode switch orchestration and the startup bootstrap. Plain internal
 * state (no `settingsState` import) so this module stays free of electron side
 * effects in test/util contexts.
 */
let activeLocation: ExecutionLocation = $state('remote')

const PARAMS_KEY = 'execution_parameters'

// Load persisted per-location params (no legacy migration — params were transient before).
const loadParameters = async () => {
  if (!globalThis.window?.electron?.store) return
  const stored = await window.electron.store.get(PARAMS_KEY, undefined)
  if (stored && typeof stored === 'object') {
    const v = stored as Partial<ParamsByLocation>
    paramsByLocation = {
      local: v.local ?? null,
      remote: v.remote ?? null,
    }
  }
}
loadParameters()

/**
 * Set which location's parameter tree `value`/`snapshot` resolve against.
 * @param location - The execution location to make active.
 */
export const setActiveLocation = (location: ExecutionLocation): void => {
  activeLocation = location
}

/**
 * Write a location's parameter tree without changing the active location.
 * Used when validating/syncing a non-active target from Settings.
 * @param location - The execution location whose tree to set.
 * @param value - The parameter tree (or null to clear).
 */
export const setValueFor = (
  location: ExecutionLocation,
  value: ParameterTree | null
): void => {
  paramsByLocation[location] = value
  void persist()
}

export const parametersState = {
  get value() {
    return paramsByLocation[activeLocation]
  },
  set value(v: ParameterTree | null) {
    paramsByLocation[activeLocation] = v
    void persist()
  },
  get snapshot() {
    const parameters = paramsByLocation[activeLocation]
    return parameters
      ? (stripUiMetadata($state.snapshot(parameters)) as ParameterTree)
      : null
  },
}

// ── Private helpers ──

const persist = async () => {
  // globalThis.window (not bare window): value is set fire-and-forget, so it may
  // resolve after a test env is torn down — never throw a ReferenceError there.
  if (globalThis.window?.electron?.store) {
    await window.electron.store.set(
      PARAMS_KEY,
      $state.snapshot(paramsByLocation)
    )
  }
}

const stripUiMetadata = (node: ParameterNode): ParameterNode => {
  if (typeof node !== 'object' || node === null) {
    return node
  }

  const entries = Object.entries(node)
    .filter(([key]) => key !== '__extra')
    .map(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        return [key, stripUiMetadata(value as ParameterLeaf | ParameterTree)]
      }
      return [key, value]
    })

  return Object.fromEntries(entries) as ParameterLeaf | ParameterTree
}
