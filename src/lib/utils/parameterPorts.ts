import type { ParameterLeaf, ParameterTree } from '../types/parameterTypes'
import {
  ConnectionType,
  Type,
  type Argument,
  type ParameterExposure,
  type ParameterPortType,
  type StandardNodeDefinition,
} from '../types/nodeTypes'
import { isParameterLeaf } from './parameterFileFormat'

const PARAMETER_INPUT_PREFIX = 'parameter-input-'
const PARAMETER_OUTPUT_PREFIX = 'parameter-output-'

/** Returns the frontend port type implied by a parameter template description. */
export const parameterPortType = (
  patternDescription: string | undefined
): ParameterPortType => {
  const description = patternDescription?.trim() ?? ''
  if (description === '[Bool]') return 'bool'
  if (description.startsWith('[Integer')) {
    // deal.II's parameter templates do not carry the C++ type separately.
    // A non-negative integer range is the available indication that the
    // parameter is intended to be unsigned; unconstrained/ranged signed
    // integers remain `int`.
    const lowerBound = description.match(
      /^\[Integer\s+range\s+([+-]?\d+)\.\./i
    )?.[1]
    if (lowerBound !== undefined && Number(lowerBound) >= 0) {
      return 'unsigned int'
    }
    return 'int'
  }
  if (description.startsWith('[Double')) return 'double'
  return 'string'
}

/** Maps a frontend parameter type to the corresponding Coral scalar type. */
export const parameterPortCoralType = (type: ParameterPortType): Type => {
  switch (type) {
    case 'bool':
      return Type.BOOLEAN
    case 'int':
      return Type.INT
    case 'unsigned int':
      return Type.UNSIGNED_INT
    case 'double':
      return Type.DOUBLE
    default:
      return Type.STRING
  }
}

/** Creates a stable handle ID from a parameter path. */
export const parameterHandle = (
  direction: 'input' | 'output',
  path: string[]
): string => {
  const prefix =
    direction === 'input' ? PARAMETER_INPUT_PREFIX : PARAMETER_OUTPUT_PREFIX
  return `${prefix}${encodeURIComponent(JSON.stringify(path))}`
}

/** Decodes a stable parameter handle, returning null for ordinary handles. */
export const parameterHandlePath = (
  handle: string | null | undefined
): { direction: 'input' | 'output'; path: string[] } | null => {
  if (!handle) return null
  const prefix = handle.startsWith(PARAMETER_INPUT_PREFIX)
    ? PARAMETER_INPUT_PREFIX
    : handle.startsWith(PARAMETER_OUTPUT_PREFIX)
      ? PARAMETER_OUTPUT_PREFIX
      : null
  if (!prefix) return null

  try {
    const path = JSON.parse(decodeURIComponent(handle.slice(prefix.length)))
    if (
      !Array.isArray(path) ||
      !path.every((part) => typeof part === 'string')
    ) {
      return null
    }
    return {
      direction: prefix === PARAMETER_INPUT_PREFIX ? 'input' : 'output',
      path,
    }
  } catch {
    return null
  }
}

export const isParameterHandle = (handle: string | null | undefined): boolean =>
  parameterHandlePath(handle) !== null

/** Returns the parameter leaf at a path, or null when the path is stale. */
export const parameterAtPath = (
  tree: ParameterTree,
  path: string[]
): ParameterLeaf | null => {
  let current: unknown = tree
  for (const segment of path) {
    if (!current || typeof current !== 'object') return null
    current = (current as Record<string, unknown>)[segment]
  }
  return isParameterLeaf(current) ? current : null
}

/** Returns a display label for a parameter path. */
export const parameterPathLabel = (path: string[]): string =>
  path.length ? path.join(' / ') : 'parameter'

/** Returns an exposure by path, comparing path segments rather than object identity. */
export const findParameterExposure = (
  exposures: ParameterExposure[] | undefined,
  path: string[]
): ParameterExposure | undefined =>
  exposures?.find(
    (exposure) =>
      exposure.path.length === path.length &&
      exposure.path.every((segment, index) => segment === path[index])
  )

/** Normalises metadata from older or hand-written graph files. */
export const normalizeParameterExposures = (
  exposures: unknown
): ParameterExposure[] => {
  if (!Array.isArray(exposures)) return []
  return exposures.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return []
    const value = candidate as Partial<ParameterExposure>
    if (
      !Array.isArray(value.path) ||
      !value.path.every((segment) => typeof segment === 'string') ||
      (!value.input && !value.output)
    ) {
      return []
    }
    const type: ParameterPortType =
      value.type === 'bool' ||
      value.type === 'int' ||
      value.type === 'unsigned int' ||
      value.type === 'double' ||
      value.type === 'string'
        ? value.type
        : 'string'
    return [
      {
        path: [...value.path],
        type,
        input: Boolean(value.input),
        output: Boolean(value.output),
      },
    ]
  })
}

/** Converts a parameter exposure into a normal graph argument descriptor. */
export const parameterExposureArgument = (
  exposure: ParameterExposure
): Argument => ({
  connection_type:
    exposure.input && exposure.output
      ? ConnectionType.PASSTHROUGH
      : exposure.input
        ? ConnectionType.INPUT
        : ConnectionType.OUTPUT,
  name: parameterPathLabel(exposure.path),
  type: parameterPortCoralType(exposure.type),
})

/** Returns the virtual inputs of a parameter-file node in persisted order. */
export const parameterInputExposures = (
  data: StandardNodeDefinition
): ParameterExposure[] =>
  normalizeParameterExposures(data.parameter_file?.exposures).filter(
    (exposure) => exposure.input
  )

/** Returns the virtual outputs of a parameter-file node in persisted order. */
export const parameterOutputExposures = (
  data: StandardNodeDefinition
): ParameterExposure[] =>
  normalizeParameterExposures(data.parameter_file?.exposures).filter(
    (exposure) => exposure.output
  )

export const parameterExposureForHandle = (
  data: StandardNodeDefinition,
  handle: string | null | undefined,
  direction: 'input' | 'output'
): ParameterExposure | null => {
  const parsed = parameterHandlePath(handle)
  if (!parsed || parsed.direction !== direction) return null
  const exposures =
    direction === 'input'
      ? parameterInputExposures(data)
      : parameterOutputExposures(data)
  return findParameterExposure(exposures, parsed.path) ?? null
}
