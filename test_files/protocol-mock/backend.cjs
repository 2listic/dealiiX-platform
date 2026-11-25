#!/usr/bin/env node
/** Register-only fixture for Platform's local CORAL probe. */
const { copyFileSync } = require('node:fs')
const { join } = require('node:path')

const [flag, registryPath, operation, ...extra] = process.argv.slice(2)
if (
  flag !== '-p' ||
  !registryPath ||
  operation !== 'register' ||
  extra.length
) {
  process.stderr.write(
    'Protocol test mock supports only -p REGISTRY register\n'
  )
  process.exitCode = 2
} else {
  copyFileSync(registryPath, join(process.cwd(), 'node_types.json'))
}
