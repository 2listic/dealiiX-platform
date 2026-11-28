import { _electron as electron, expect, test } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
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
    const fs = require('node:fs')
    const request = JSON.parse(fs.readFileSync(0, 'utf8'))
    const profile = process.argv[3]
    let { enabled = 'false' } = JSON.parse(fs.readFileSync(profile, 'utf8'))
    const { version, operation } = request
    const digest = () => 'sha256:' + (enabled === 'true' ? '4' : '1').repeat(64)
    const registry_digest = 'sha256:' + '2'.repeat(64)
    const run_id = 'run-' + '3'.repeat(32)
    let result
    if (operation === 'configure') {
      if (request.configuration_digest !== digest()) throw Error('Expected the configuration revision being edited')
      enabled = request.configuration.Enabled.value
      fs.writeFileSync(profile, JSON.stringify({ enabled }))
    }
    if (operation === 'describe' || operation === 'configure') {
      const Enabled = { value: 'false', default_value: 'false', documentation: '', pattern: '[Bool]', pattern_description: '[Bool]' }
      result = {
        __backend: {
          id: 'independent', version, operations: ['describe', 'configure', 'migrate', 'submit', 'status', 'logs'],
          configuration_digest: digest(), registry_digest, configuration: { Enabled: { ...Enabled, value: enabled } },
        },
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
          enabled !== 'true' || request.configuration_digest !== digest() ||
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
    await expect(page.getByLabel('Execution location')).toHaveCount(0)
    await expect(page.getByLabel('Execution mode')).toHaveCount(0)
    const sidebar = page.getByTestId('sidebar')
    await sidebar.hover()
    await expect(sidebar.getByTestId('sidebar-node-class')).toHaveText(
      'Independent Independent -> Check'
    )
    await page.getByTitle('Settings', { exact: true }).click()
    await page
      .getByRole('button', { name: 'Backend Settings', exact: true })
      .click()
    const backendSettings = page.locator('#settings-modal')
    await expect(
      backendSettings.getByRole('heading', {
        name: 'Backend Settings',
        exact: true,
      })
    ).toBeVisible()
    await backendSettings
      .getByRole('checkbox', { name: 'Enabled', exact: true })
      .check()
    await backendSettings
      .getByRole('button', { name: 'Save', exact: true })
      .click()
    await expect(page.getByText('Backend configuration saved')).toBeVisible()
    await expect(backendSettings).toBeHidden()
    await page.getByTitle('Import / Export', { exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Import Nodes', exact: true })
    ).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Import Graph', exact: true })
      .click()
    await page.getByRole('button', { name: 'Configure Opened check' }).click()
    await page.getByRole('checkbox', { name: 'Enabled', exact: true }).check()
    await page.getByTitle('Expose Enabled as a graph input').click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByRole('button', { name: 'Back to graph' }).click()
    await page.getByTitle('Run', { exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Validate graph', exact: true })
    ).toHaveCount(0)
    await page.getByRole('button', { name: 'Run new job', exact: true }).click()
    await expect(page.getByText('succeeded', { exact: true })).toBeVisible()
    await page.getByTitle('View logs from the current job').click()
    await expect(
      page.getByText('Backend ran the configured graph', { exact: false })
    ).toBeVisible()
  } finally {
    await app.close()
  }
})

test('Backend Settings edits the private profile in the shared modal and refreshes its registry on Save', async ({}, info) => {
  const helper = info.outputPath('backend.cjs')
  const profile = info.outputPath('backend.config.json')
  const incompatible = info.outputPath('incompatible.json')
  const compatible = info.outputPath('compatible.json')
  await mkdir(dirname(profile), { recursive: true })
  const settingsFile = (value: string, plugin?: string) =>
    JSON.stringify({
      backend: { id: 'independent', ...(plugin && { plugin }) },
      configuration: {
        Label: {
          value,
          default_value: 'Before',
          documentation: '',
          pattern: '[Anything]',
          pattern_description: '[Anything]',
        },
      },
    })
  const initial = settingsFile('Before')
  await writeFile(profile, initial)
  await writeFile(incompatible, settingsFile('Wrong', 'other-plugin'))
  await writeFile(compatible, settingsFile('After'))
  await writeFile(
    helper,
    `
    const fs = require('node:fs')
    const { version, operation } = JSON.parse(fs.readFileSync(0, 'utf8'))
    const { configuration: { Label: { value } } } = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'))
    if (operation !== 'describe') throw Error('Expected describe')
    if (value === 'Invalid') {
      console.log(JSON.stringify({ version, operation, error: {
        code: 'invalid_configuration', message: 'Choose a valid backend label',
      } }))
    } else {
      console.log(JSON.stringify({ version, operation, result: {
        __backend: {
          id: 'independent', version, operations: ['describe'],
          configuration_digest: 'sha256:' + '1'.repeat(64), registry_digest: 'sha256:' + '2'.repeat(64),
        },
        'independent::Check': {
          type: 'independent::Check', node_type: 'void_function',
          arguments: [], inputs: [], outputs: [], class_name: value,
        },
      } }))
    }
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
    await expect(page.getByTestId('flow-canvas')).toBeVisible()
    const sidebar = page.getByTestId('sidebar')
    await expect(sidebar.locator('[data-class-name="Before"]')).toBeAttached()
    await page.getByTitle('Settings', { exact: true }).click()
    await page
      .getByRole('button', { name: 'Backend Settings', exact: true })
      .click()
    const backendSettings = page.locator('#settings-modal')
    await app.evaluate(
      ({ dialog }, paths) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [paths.shift()!],
        })
      },
      [incompatible, compatible]
    )
    await expect(
      backendSettings.getByRole('heading', { name: 'Backend Settings' })
    ).toBeVisible()
    await expect(
      backendSettings.getByRole('button', { name: 'Validate & Sync' })
    ).toHaveCount(0)
    const label = backendSettings.getByRole('textbox', { name: 'Label' })
    await expect(label).toHaveValue('Before')
    const importFile = backendSettings.getByRole('button', {
      name: 'Import from file',
    })
    await importFile.click()
    await expect(backendSettings.getByRole('alert')).toContainText(
      'independent/other-plugin'
    )
    await expect(label).toHaveValue('Before')
    expect(await readFile(profile, 'utf8')).toEqual(initial)
    const setLabel = (value: string) =>
      label.evaluate((input: HTMLInputElement, value) => {
        input.value = value
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }, value)
    const save = backendSettings.getByRole('button', {
      name: 'Save',
      exact: true,
    })
    await setLabel('Invalid')
    await save.click()
    await expect(
      page.getByText('Choose a valid backend label', { exact: false })
    ).toBeVisible()
    expect(await readFile(profile, 'utf8')).toEqual(initial)
    await importFile.click()
    await expect(label).toHaveValue('After')
    expect(await readFile(profile, 'utf8')).toEqual(initial)
    await save.click()
    await expect(backendSettings).toBeHidden()
    await expect(sidebar.locator('[data-class-name="After"]')).toBeAttached()
    expect(JSON.parse(await readFile(profile, 'utf8'))).toEqual(
      JSON.parse(settingsFile('After'))
    )
  } finally {
    await app.close()
  }
})
