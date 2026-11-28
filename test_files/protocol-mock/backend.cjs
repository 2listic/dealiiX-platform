#!/usr/bin/env node
/** JavaScript fixture for the legacy CORAL probe and the workflow service. */
const { copyFileSync } = require('node:fs')
const { join } = require('node:path')

const [flag, registryPath, operation, ...extra] = process.argv.slice(2)
if (
  flag === '--configuration' &&
  registryPath &&
  operation === 'exchange' &&
  !extra.length
) {
  require('./exchange.cjs').exchange(registryPath)
} else if (
  flag !== '-p' ||
  !registryPath ||
  operation !== 'register' ||
  extra.length
) {
  process.stderr.write(
    'Use -p REGISTRY register or --configuration PROFILE exchange\n'
  )
  process.exitCode = 2
} else {
  copyFileSync(registryPath, join(process.cwd(), 'node_types.json'))
}
