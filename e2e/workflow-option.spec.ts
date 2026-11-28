import { _electron as electron, expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parameterHandle } from '../src/lib/graph/handleIds'

test('Option renders a saved boolean on the canvas and submits changes', async ({}, info) => {
  const helper = info.outputPath('backend.cjs')
  const profile = info.outputPath('backend.json')
  const network = info.outputPath('workflow.json')
  const targetHandle = parameterHandle('input', ['Enabled'])
  await mkdir(dirname(profile), { recursive: true })
  await writeFile(profile, '{}')
  await writeFile(
    network,
    JSON.stringify({
      version: 1,
      backend: { id: 'independent' },
      workflow: {
        nodes: {
          0: { type: 'bool', value: 'true', position: { x: 50, y: 70 } },
          1: {
            type: 'independent::Check',
            position: { x: 350, y: 70 },
            configuration_exposures: {
              exposures: [
                { path: ['Enabled'], type: 'bool', input: true, output: false },
              ],
            },
          },
        },
        edges: {
          0: {
            source: 0,
            source_output: 0,
            target: 1,
            target_handle: targetHandle,
          },
        },
      },
    })
  )
  await writeFile(
    helper,
    `
    const request = JSON.parse(require('node:fs').readFileSync(0, 'utf8'))
    const { version, operation } = request
    let result
    if (operation === 'describe') {
      result = {
        __backend: { id: 'independent', version, operations: ['describe', 'submit'],
          configuration_digest: 'sha256:' + '1'.repeat(64),
          registry_digest: 'sha256:' + '2'.repeat(64) },
        bool: { type: 'bool', display_name: 'Option', node_type: 'elementary_constructor',
          value: 'false', arguments: [], inputs: [], outputs: [-1] },
        'independent::Check': { type: 'independent::Check', node_type: 'void_function',
          arguments: [], inputs: [], outputs: [],
          capabilities: { actions: ['configure'], configuration_exposable: true },
          configuration: {
            Enabled: { value: 'true', default_value: 'true', documentation: '',
              pattern: '[Bool]', pattern_description: '[Bool]' },
          },
        },
      }
    } else if (operation === 'submit') {
      const { nodes, edges } = request.network.workflow
      if (nodes['0'].name !== 'Enable check' || nodes['0'].value !== 'false' ||
          Object.values(edges)[0]?.target_handle !== ${JSON.stringify(targetHandle)}) {
        throw Error('Expected the updated option wired to the boolean input')
      }
      result = { run_id: 'run-' + '3'.repeat(32), state: 'succeeded', nodes: {} }
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
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      })
    }, network)
    const choose = async (menu: string, action: string) => {
      await page.getByTitle(menu, { exact: true }).click()
      await page.getByRole('button', { name: action, exact: true }).click()
    }
    const sidebar = page.getByTestId('sidebar')
    await sidebar.hover()
    await expect(
      sidebar.getByTestId('sidebar-node').filter({ hasText: 'Option' })
    ).toBeVisible()
    await choose('Import / Export', 'Import Graph')
    const option = page.getByRole('group', { name: 'Option', exact: true })
    const checked = option.getByRole('checkbox', { name: 'Toggle Option' })
    await expect(checked).toBeChecked()
    await expect(
      option.getByRole('button', { name: 'Configure Option' })
    ).toHaveCount(0)
    await option.getByTitle('Toggle Option').click()
    await expect(checked).not.toBeChecked()
    await choose('Layout', 'Undo')
    await expect(checked).toBeChecked()
    await choose('Layout', 'Redo')
    await expect(checked).not.toBeChecked()

    await option.getByTitle('Edit name').click()
    await page
      .getByRole('textbox', { name: 'Network node name' })
      .fill('Enable check')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(
      page.getByRole('checkbox', { name: 'Toggle Enable check' })
    ).not.toBeChecked()
    await choose('Run', 'Run new job')
    await expect(page.getByText('succeeded', { exact: true })).toBeVisible()
  } finally {
    await app.close()
  }
})
