import { describe, expect, it } from 'vitest'
import type { ParameterTree } from '../types/parameterTypes'
import {
  parseParametersFile,
  parseParametersFileWithFormat,
  parsePrmParameters,
  getParameterProbeFileNames,
  normalizeParameterFileName,
  serializeParametersFile,
  stringifyPrmParameters,
  replaceExtension,
} from './parameterFileFormat'

const samplePrm = `# Listing of Parameters
# ---------------------
subsection Error
  # When set to false, no computations are performed.
  set Enable computation of the errors = true

  # Number of digits to use when printing the error.
  set Error precision                  = 3

  # Extra columns to add to the table. Available options are dofs and cells.
  set Extra columns                    = cells, dofs
end
`

describe('parameterFileFormat', () => {
  it('parses prm subsections and set values into a parameter tree', () => {
    const parsed = parsePrmParameters(samplePrm)
    const error = parsed.Error as ParameterTree

    expect(error['Enable computation of the errors']).toMatchObject({
      value: 'true',
      default_value: 'true',
      pattern_description: '[Text]',
      documentation: 'When set to false, no computations are performed.',
    })
    expect(error['Error precision']).toMatchObject({
      value: '3',
      pattern_description: '[Text]',
    })
    expect(error['Extra columns']).toMatchObject({
      value: 'cells, dofs',
      pattern_description: '[Text]',
    })
  })

  it('treats prm comments as documentation for the following entry', () => {
    const parsed = parsePrmParameters(`# Header comment
subsection Solver
  # First documentation line.
  # Second documentation line.
  set Tolerance = 1e-8
end
`)
    const solver = parsed.Solver as ParameterTree

    expect(solver.Tolerance).toMatchObject({
      value: '1e-8',
      documentation: 'First documentation line.\nSecond documentation line.',
    })
  })

  it('keeps every prm value as free text, even booleans and single numbers', () => {
    const parsed = parsePrmParameters(`set Enabled =
set First id = 10
set Flag = true
set Tolerance = 1e-8
`)

    expect(parsed.Enabled).toMatchObject({
      value: '',
      default_value: '',
      pattern_description: '[Text]',
    })
    expect(parsed['First id']).toMatchObject({
      value: '10',
      pattern_description: '[Text]',
    })
    expect(parsed.Flag).toMatchObject({
      value: 'true',
      pattern_description: '[Text]',
    })
    expect(parsed.Tolerance).toMatchObject({
      value: '1e-8',
      pattern_description: '[Text]',
    })
  })

  it('detects prm content even when the requested filename ends in .json', () => {
    const parsed = parseParametersFileWithFormat(samplePrm, 'parameters.json')

    expect(parsed.format).toBe('prm')
    expect(parsed.data.Error).toBeDefined()
  })

  it('builds probe filenames that fall back to the alternate format', () => {
    expect(getParameterProbeFileNames('parameters.json')).toEqual([
      'parameters.json',
      'parameters.prm',
    ])
    expect(getParameterProbeFileNames('parameters.prm')).toEqual([
      'parameters.prm',
      'parameters.json',
    ])
  })

  it('normalizes parameter filenames to the detected format', () => {
    expect(replaceExtension('parameters.json', 'prm')).toBe(
      'parameters.prm'
    )
    expect(replaceExtension('parameters', 'json')).toBe(
      'parameters.json'
    )
  })

  it('normalizes imported parameter filenames without keeping directory prefixes', () => {
    expect(normalizeParameterFileName('/tmp/parameters23.prm', 'prm')).toBe(
      'parameters23.prm'
    )
    expect(normalizeParameterFileName('nested/parameters.json', 'prm')).toBe(
      'parameters.prm'
    )
    expect(normalizeParameterFileName('', 'json')).toBe('parameters.json')
  })

  it('serializes parameter trees as prm when the target path ends in .prm', () => {
    const tree: ParameterTree = {
      Error: {
        'Error precision': {
          value: '3',
          default_value: '3',
          documentation: 'Number of digits to use when printing the error.',
          pattern: '[0-9]+',
          pattern_description: '[Integer]',
        },
      },
    }

    const prm = serializeParametersFile(tree, 'parameters.prm')

    expect(prm).toContain('subsection Error')
    expect(prm).toContain('# Number of digits to use when printing the error.')
    expect(prm).toContain('set Error precision = 3')
    expect(prm).toContain('end')
  })

  it('round-trips prm values through the shared parse and stringify helpers', () => {
    const parsed = parseParametersFile(samplePrm, 'parameters.prm')
    const serialized = stringifyPrmParameters(parsed)
    const reparsed = parsePrmParameters(serialized)

    expect(reparsed).toEqual(parsed)
  })

  it('keeps json as the default output format', () => {
    const tree: ParameterTree = {
      Solver: {
        Tolerance: {
          value: '1e-8',
          default_value: '1e-8',
          documentation: '',
          pattern: '.*',
          pattern_description: '[Double]',
        },
      },
    }

    expect(
      JSON.parse(serializeParametersFile(tree, 'parameters.json'))
    ).toEqual(tree)
  })
})
