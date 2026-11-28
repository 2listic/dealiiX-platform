import { _electron as electron, expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

test('the canvas selection edits the saved choice and keeps the configuration editor', async ({}, info) => {
  const helper = info.outputPath('backend.cjs')
  const profile = info.outputPath('profile', 'backend.config.json')
  const network = info.outputPath('profile', 'network.json')
  const selectionType = 'independent::Choose'
  const leaf = (value: string) => ({
    value,
    default_value: value,
    documentation: '',
    pattern: '[Anything]',
    pattern_description: '[Anything]',
  })
  const registry = {
    __backend: {
      id: 'independent',
      operations: ['describe', 'submit'],
      configuration_digest: 'sha256:' + '1'.repeat(64),
      registry_digest: 'sha256:' + '2'.repeat(64),
    },
    [selectionType]: {
      type: selectionType,
      node_type: 'void_function',
      arguments: [
        {
          connection_type: 'output',
          type: 'std::string',
          name: 'Selected case',
          configuration_path: ['choice'],
        },
      ],
      inputs: [],
      outputs: [0],
      configuration: {
        choices: leaf('example one | example two'),
        choice: { ...leaf('example one'), selection_options: 'choices' },
      },
      capabilities: { actions: ['configure'], configuration_exposable: false },
    },
  }
  await mkdir(dirname(profile), { recursive: true })
  await writeFile(profile, '{}')
  await writeFile(
    network,
    JSON.stringify({
      version: 1,
      backend: { id: registry.__backend.id },
      workflow: {
        nodes: {
          0: {
            type: selectionType,
            name: 'Choose case',
            configuration: {
              choices: leaf('baseline | alternate'),
              choice: leaf('baseline'),
            },
          },
        },
        edges: {},
      },
    })
  )
  await writeFile(
    helper,
    `
      const request = JSON.parse(require('node:fs').readFileSync(0, 'utf8'))
      const { version, operation } = request
      const registry = ${JSON.stringify(registry)}
      registry.__backend.version = version
      let result
      if (operation === 'describe') {
        result = registry
      } else if (operation === 'submit') {
        const { choice } = request.network.workflow.nodes['0'].configuration
        if (choice.value !== 'third case') throw new Error('The workflow lost the selected value')
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
    await expect(page.getByTestId('flow-canvas')).toBeVisible()
    await page.getByTitle('Import / Export', { exact: true }).click()
    await page
      .getByRole('button', { name: 'Import Graph', exact: true })
      .click()
    const dropdown = page.getByRole('combobox', { name: 'Selected case' })
    await expect(dropdown).toHaveValue('baseline')
    await expect(dropdown.getByRole('option')).toHaveText([
      'baseline',
      'alternate',
    ])
    await dropdown.selectOption('alternate')
    await expect(dropdown).toHaveValue('alternate')
    await page.keyboard.press('Control+Z')
    await expect(dropdown).toHaveValue('baseline')
    await page.keyboard.press('Control+Shift+Z')
    await expect(dropdown).toHaveValue('alternate')

    await page.getByRole('button', { name: 'Configure Choose case' }).click()
    await expect(page.getByRole('combobox', { name: 'choice' })).toHaveValue(
      'alternate'
    )
    await page
      .getByRole('textbox', { name: 'choices' })
      .fill('baseline | alternate | third case')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByRole('button', { name: 'Back to graph' }).click()
    await dropdown.selectOption('third case')
    await page.getByTitle('Run new job', { exact: true }).click()
    await expect(page.getByText('succeeded', { exact: true })).toBeVisible()
  } finally {
    await app.close()
  }
})
