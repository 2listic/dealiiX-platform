import { _electron as electron, expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

test('the standard editor submits its saved graph to the workflow backend', async ({}, info) => {
  const helper = info.outputPath('backend.cjs')
  const profile = info.outputPath('profile', 'backend.config.json')
  const network = join(dirname(profile), 'network.json')
  await mkdir(dirname(profile), { recursive: true })
  await writeFile(profile, '{}')
  await writeFile(
    network,
    JSON.stringify({
      version: 1,
      backend: { id: 'independent' },
      workflow: {
        nodes: { 0: { type: 'independent::Check', name: 'Opened check' } },
        edges: {},
      },
    })
  )
  await writeFile(
    helper,
    `
    const request = JSON.parse(require('node:fs').readFileSync(0, 'utf8'))
    const { version, operation } = request
    const configuration_digest = 'sha256:' + '1'.repeat(64)
    const registry_digest = 'sha256:' + '2'.repeat(64)
    const run_id = 'run-' + '3'.repeat(32)
    let result
    if (operation === 'describe') {
      const Enabled = { value: 'false', default_value: 'false', documentation: '', pattern: '[Bool]', pattern_description: '[Bool]' }
      result = {
        __backend: { id: 'independent', version, operations: ['describe', 'migrate', 'submit', 'status', 'logs'], configuration_digest, registry_digest },
        'independent::Check': {
          type: 'independent::Check', node_type: 'void_function', arguments: [], inputs: [], outputs: [],
          display_name: 'Check', class_name: 'Independent', configuration: { Enabled },
          capabilities: { actions: ['configure'], configuration_exposable: true },
        },
      }
    } else if (operation === 'migrate') {
      result = { network: request.document, changes: [] }
    } else if (operation === 'submit') {
      const node = request.network.workflow.nodes['0']
      if (node.configuration?.Enabled?.value !== 'true' ||
          !node.configuration_exposures.exposures[0].input ||
          request.configuration_digest !== configuration_digest ||
          request.registry_digest !== registry_digest) throw Error('Expected the saved exposed graph and both revisions')
      result = { run_id, state: 'queued', nodes: {} }
    } else if (operation === 'status') {
      result = { run_id, state: 'succeeded', nodes: { 0: { qualified_id: '0', state: 'succeeded' } } }
    } else if (operation === 'logs') {
      result = { run_id, logs: { 0: 'Backend ran the configured graph' } }
    }
    console.log(JSON.stringify({ version, operation, result }))
  `
  )
  const app = await electron.launch({
    args: [process.cwd(), '--no-sandbox'],
    env: {
      ...process.env,
      E2E_TEST: '1',
      ELECTRON_USERDATA: info.outputPath('userdata'),
      DEALIIX_BACKEND_COMMAND: JSON.stringify([process.execPath, helper]),
      DEALIIX_CONFIGURATION: profile,
    },
  })
  try {
    const page = await app.firstWindow()
    await app.evaluate(
      ({ dialog }, expected) => {
        dialog.showOpenDialog = async (parentOrOptions, options) => {
          const actual = options ?? parentOrOptions
          if (
            !('defaultPath' in actual) ||
            actual.defaultPath !== expected.start
          ) {
            throw new Error(
              'Expected the workflow picker to start beside the profile'
            )
          }
          return { canceled: false, filePaths: [expected.network] }
        }
      },
      { start: dirname(profile), network }
    )
    await expect(page.getByTestId('flow-canvas')).toBeVisible()
    const sidebar = page.getByTestId('sidebar')
    await sidebar.hover()
    await expect(sidebar.getByTestId('sidebar-node-class')).toHaveText(
      'Independent Independent -> Check'
    )
    await page.getByTitle('Import / Export', { exact: true }).click()
    await page
      .getByRole('button', { name: 'Import Nodes', exact: true })
      .click()
    await expect(
      page.getByText('[TODO] The backend supplies the registry.', {
        exact: false,
      })
    ).toBeVisible()
    await page.getByTitle('Import / Export', { exact: true }).click()
    await page
      .getByRole('button', { name: 'Import Graph', exact: true })
      .click()
    await page.getByRole('button', { name: 'Configure Opened check' }).click()
    await page.getByRole('checkbox', { name: 'Enabled', exact: true }).check()
    await page.getByTitle('Expose Enabled as a graph input').click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByRole('button', { name: 'Back to graph' }).click()
    await page.getByTitle('Run new job', { exact: true }).click()
    await expect(page.getByText('succeeded', { exact: true })).toBeVisible()
    await page.getByTitle('View logs from the current job').click()
    await expect(
      page.getByText('Backend ran the configured graph', { exact: false })
    ).toBeVisible()
  } finally {
    await app.close()
  }
})
