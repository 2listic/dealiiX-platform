const { readFileSync, readdirSync } = require('node:fs')
const { join } = require('node:path')
const Ajv2020 = require('ajv/dist/2020')

const directory = join(__dirname, '../../schemas')
const ajv = new Ajv2020({ strictTypes: false })
const ids = new Map()
for (const name of readdirSync(directory)) {
  if (!name.endsWith('.schema.json')) continue
  const schema = JSON.parse(readFileSync(join(directory, name), 'utf8'))
  ajv.addSchema(schema)
  ids.set(name.replace('.schema.json', ''), schema.$id)
}
const desktop = JSON.parse(
  readFileSync(join(directory, 'desktop/frontend-settings.schema.json'), 'utf8')
)
ajv.addSchema(desktop)
ids.set('frontend-settings', desktop.$id)

function validator(name, fragment = '') {
  const validate = ajv.getSchema(ids.get(name) + fragment)
  if (!validate) throw new Error('Missing schema: ' + name + fragment)
  return validate
}

module.exports = { ajv, validator }
