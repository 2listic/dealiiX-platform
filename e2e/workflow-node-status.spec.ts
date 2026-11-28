import { _electron as electron, expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

test('the canvas follows checked, active and failed nodes in the submitted graph', async ({}, info) => {
  const helper = info.outputPath('backend.cjs')
  const report = info.outputPath('report')
  const profile = info.outputPath('profile', 'backend.config.json')
  const network = info.outputPath('profile', 'network.json')
  const plain = { arguments: [], inputs: [], outputs: [] }
  const stage = 'independent::Task'
  const child = 'coral::Task'
  const group = 'independent::Group'
  const registry = {
    __backend: {
      id: 'independent',
      operations: ['describe', 'validate', 'submit', 'status'],
      configuration_digest: 'sha256:' + '1'.repeat(64),
      registry_digest: 'sha256:' + '2'.repeat(64),
    },
    [stage]: { ...plain, type: stage, node_type: 'void_function' },
    [group]: {
      ...plain,
      type: group,
      node_type: 'network',
      capabilities: { actions: ['open_child_workflow'] },
      value: {
        registry: {
          __backend: { id: 'coral' },
          [child]: { ...plain, type: child, node_type: 'void_function' },
        },
      },
    },
  }
  await mkdir(dirname(profile), { recursive: true })
  await writeFile(profile, '{}')
  await writeFile(report, 'running')
  await writeFile(
    network,
    JSON.stringify({
      version: 1,
      backend: { id: 'independent' },
      workflow: {
        nodes: {
          0: { type: stage, name: 'Input file', position: { x: 50, y: 70 } },
          1: {
            ...plain,
            type: group,
            node_type: 'network',
            name: 'Producer',
            position: { x: 340, y: 70 },
            value: {
              version: 1,
              backend: { id: 'coral' },
              workflow: {
                nodes: {
                  0: {
                    type: child,
                    name: 'Inner operation',
                    position: { x: 120, y: 70 },
                  },
                },
                edges: {},
              },
            },
          },
          2: { type: stage, name: 'Output file', position: { x: 50, y: 210 } },
          3: {
            type: stage,
            name: 'Waiting step',
            position: { x: 340, y: 210 },
          },
          4: { type: stage, name: 'Unreported', position: { x: 50, y: 350 } },
        },
        edges: {},
      },
    })
  )
  await writeFile(
    helper,
    `
      const { readFileSync } = require('node:fs')
      const { version, operation } = JSON.parse(readFileSync(0, 'utf8'))
      const registry = ${JSON.stringify(registry)}
      registry.__backend.version = version
      const response = { version, operation }
      if (operation === 'describe') {
        response.result = registry
      } else if (operation === 'validate') {
        response.error = { code: 'missing_input', message: 'Missing required input', qualified_id: '0' }
      } else {
        const finished = operation === 'status' && readFileSync(${JSON.stringify(report)}, 'utf8') === 'failed'
        const state = operation === 'submit' ? 'queued' : finished ? 'failed' : 'running'
        const nodes = {
          0: { qualified_id: '0', state: 'succeeded' },
          1: { qualified_id: '1', state },
          '1_0': { qualified_id: '1_0', state: finished ? 'succeeded' : state },
          2: { qualified_id: '2', state },
          3: { qualified_id: '3', state: finished ? 'cancelled' : 'queued' },
        }
        if (finished) {
          nodes[2].error = {
            code: 'missing_output', message: 'Required output was not created', qualified_id: '2',
          }
        }
        response.result = { run_id: 'run-' + '3'.repeat(32), state, nodes }
      }
      console.log(JSON.stringify(response))
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
    const importGraph = async () => {
      await page.getByTitle('Import / Export', { exact: true }).click()
      await page
        .getByRole('button', { name: 'Import Graph', exact: true })
        .click()
    }
    const runAction = async (name: string) => {
      await page.getByTitle('Run', { exact: true }).click()
      await page.getByRole('button', { name, exact: true }).click()
    }
    const node = (name: string) =>
      page.getByRole('group', { name, exact: true })

    await importGraph()
    await runAction('Validate graph')
    await expect(node('Input file')).toHaveAttribute('data-run-state', 'failed')
    await expect(node('Input file')).toHaveAccessibleDescription(
      /Missing required input/
    )
    await runAction('Run new job')
    await expect(node('Output file')).toHaveAttribute(
      'data-run-state',
      'running'
    )
    await expect(node('Output file')).toHaveCSS(
      'background-color',
      'rgb(255, 226, 189)'
    )
    await expect(node('Input file')).toHaveCSS(
      'background-color',
      'rgb(216, 243, 220)'
    )
    await expect(node('Waiting step')).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)'
    )
    await expect(node('Unreported')).not.toHaveAttribute('data-run-state', /.+/)

    await node('Producer').getByTitle('Open subnetwork').click()
    await expect(node('Inner operation')).toHaveAttribute(
      'data-run-state',
      'running'
    )
    await writeFile(report, 'failed')
    await expect(node('Inner operation')).toHaveAttribute(
      'data-run-state',
      'succeeded'
    )
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(node('Output file')).toHaveAttribute(
      'data-run-state',
      'failed'
    )
    await expect(node('Output file')).toHaveCSS(
      'background-color',
      'rgb(246, 176, 176)'
    )
    await expect(node('Waiting step')).toHaveAttribute(
      'data-run-state',
      'cancelled'
    )
    await importGraph()
    await expect(node('Output file')).not.toHaveAttribute(
      'data-run-state',
      /.+/
    )
  } finally {
    await app.close()
  }
})
