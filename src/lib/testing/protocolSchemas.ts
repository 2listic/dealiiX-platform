import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import Ajv2020 from 'ajv/dist/2020'

/** A schema in `schemas/`, named by its file name without `.schema.json`. */
export type ProtocolSchema =
  | 'common'
  | 'parameters'
  | 'registry'
  | 'network'
  | 'network-execution'

/** Repository folder holding the protocol schemas. */
export const SCHEMAS_DIR = join(process.cwd(), 'schemas')

const ajv = new Ajv2020({ allErrors: true, strictTypes: false })
const schemaIds = new Map<string, string>()
for (const file of readdirSync(SCHEMAS_DIR)) {
  if (!file.endsWith('.schema.json')) continue
  const schema = JSON.parse(readFileSync(join(SCHEMAS_DIR, file), 'utf8'))
  ajv.addSchema(schema)
  schemaIds.set(file.replace(/\.schema\.json$/, ''), schema.$id)
}

/**
 * Validates a document against one of the protocol schemas.
 * @param schema - The schema to validate against.
 * @param document - The document to check.
 * @returns One line per violation; empty when the document is valid.
 * @throws {Error} If no schema of that name exists.
 */
export const protocolErrors = (
  schema: ProtocolSchema,
  document: unknown
): string[] => {
  const validate = ajv.getSchema(schemaIds.get(schema) ?? '')
  if (!validate) throw new Error(`Unknown protocol schema: ${schema}`)
  if (validate(document)) return []
  return (validate.errors ?? []).map(
    (error) => `${error.instancePath || '/'} ${error.message}`
  )
}
