import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { protocolErrors, type ProtocolSchema } from './protocolSchemas'

const ROOT = process.cwd()

const jsonFiles = (folder: string, prefix = ''): string[] =>
  readdirSync(join(ROOT, folder))
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .map((name) => `${folder}/${name}`)

const read = (path: string): unknown =>
  JSON.parse(readFileSync(join(ROOT, path), 'utf8'))

const checkedBy =
  (schema: ProtocolSchema) =>
  (path: string): [ProtocolSchema, string] => [schema, path]

const documents: [ProtocolSchema, string][] = [
  ...jsonFiles('examples/graphs').map(checkedBy('network')),
  ...jsonFiles('examples/parameters').map(checkedBy('parameters')),
  ...jsonFiles('src/lib/data').map(checkedBy('registry')),
  ...jsonFiles('test_files', 'network-').map(checkedBy('network')),
  ...jsonFiles('test_files', 'poisson-').map(checkedBy('network')),
  ...jsonFiles('e2e/fixtures').map(checkedBy('network')),
  ...jsonFiles('schemas/examples', 'registry-').map(checkedBy('registry')),
  ...jsonFiles('schemas/examples', 'network-')
    .filter((path) => !path.endsWith('/network-execution.json'))
    .map(checkedBy('network')),
  ['registry', 'schemas/examples/registry.json'],
  ['network-execution', 'schemas/examples/network-execution.json'],
  ['parameters', 'tools/orchestrator/examples/backend.config.json'],
  ['network', 'tools/orchestrator/examples/network.json'],
  ['registry', 'tools/mock-backend/registry.json'],
  ['parameters', 'tools/mock-backend/parameters.json'],
  ['network-execution', 'tools/mock-backend/network.json'],
  ['network-execution', 'tools/mock-backend/network-coral.json'],
]

describe('protocol schemas', () => {
  it.each(documents)('%s accepts %s', (schema, path) => {
    expect(protocolErrors(schema, read(path))).toEqual([])
  })

  it('rejects a saved network in the execution form', () => {
    const graph = read('examples/graphs/immersx-poisson-2d-parameter-file.json')

    expect(protocolErrors('network', graph)).toEqual([])
    expect(protocolErrors('network-execution', graph)).not.toEqual([])
  })
})
