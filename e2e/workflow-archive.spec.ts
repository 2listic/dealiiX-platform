import { _electron as electron, expect, test } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

test('opens and saves workflows in backend collections with revision protection', async ({}, info) => {
  const profile = info.outputPath('backend.json')
  const shared = info.outputPath('backend.json.workflows', 'shared')
  const nativeDirectory = info.outputPath('native-workflows')
  const file = resolve(shared, 'case.network.json')
  const network = {
    version: 1,
    backend: { id: 'mock' },
    workflow: { nodes: {}, edges: {} },
  }
  const leaf = (value: string) => ({
    value,
    default_value: value,
    documentation: '',
    pattern: '[Anything]',
    pattern_description: '[Anything]',
  })
  await mkdir(dirname(profile), { recursive: true })
  await mkdir(shared, { recursive: true })
  await writeFile(
    profile,
    JSON.stringify({
      backend: { id: 'mock' },
      configuration: { Greeting: leaf('hello'), Archive: leaf('true') },
    })
  )
  await writeFile(file, JSON.stringify(network))
  await mkdir(nativeDirectory)
  const nativeGraph = JSON.stringify({ ...network, author: 'native picker' })
  await writeFile(resolve(nativeDirectory, 'native.json'), nativeGraph)
  const app = await electron.launch({
    args: [process.cwd(), '--no-sandbox'],
    env: {
      ...process.env,
      E2E_TEST: '1',
      ELECTRON_USERDATA: info.outputPath('userdata'),
      DEALIIX_CONFIGURATION: profile,
      DEALIIX_BACKEND_COMMAND: JSON.stringify([
        process.execPath,
        resolve('test_files/protocol-mock/backend.cjs'),
      ]),
    },
  })
  try {
    const page = await app.firstWindow()
    const modal = page.locator('#workflow-archive-modal')
    await app.evaluate(({ dialog }) => {
      dialog.showOpenDialog = async (...args) => {
        const { defaultPath } = args.at(-1) as { defaultPath: string }
        return { canceled: false, filePaths: [defaultPath + '/native.json'] }
      }
    })
    const native = await page.evaluate(
      async ({ directory, setting }) => {
        const baseline =
          await window.electron.workflow.saveDefault('graph.json')
        const { configuration } = await window.electron.frontendSettings.get()
        await window.electron.frontendSettings.save({
          ...configuration,
          'Workflow directory': { ...setting, value: directory },
        })
        return {
          baseline,
          save: await window.electron.workflow.saveDefault('graph.json'),
          contents: await window.electron.workflow.openWorkflow(),
        }
      },
      { directory: nativeDirectory, setting: leaf(nativeDirectory) }
    )
    expect(native).toEqual({
      baseline: resolve(dirname(profile), 'graph.json'),
      save: resolve(nativeDirectory, 'graph.json'),
      contents: nativeGraph,
    })
    const choose = async (label: string) => {
      await page.getByTitle('Import / Export', { exact: true }).click()
      await page
        .getByRole('menu')
        .getByRole('button', { name: label, exact: true })
        .click()
    }
    await choose('Import Remote Graph')
    const files = modal.getByRole('listbox', { name: 'Workflow' })
    await expect(
      files.getByRole('option', { name: 'case.network.json' })
    ).toBeVisible()
    await files.selectOption('case.network.json')
    await modal.getByRole('button', { name: 'Open', exact: true }).click()
    await expect(modal).toBeHidden()

    const external = JSON.stringify({ ...network, author: 'another editor' })
    await writeFile(file, external)
    await choose('Save Remote Graph')
    await expect(modal.getByRole('textbox', { name: 'File name' })).toHaveValue(
      'case.network.json'
    )
    await expect(modal.getByRole('option', { name: 'Examples' })).toHaveCount(0)
    await modal.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(modal.getByRole('alert')).toContainText('workflow_conflict')
    expect(await readFile(file, 'utf8')).toBe(external)

    await modal
      .getByRole('textbox', { name: 'File name' })
      .fill('copy.network.json')
    await modal.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(modal).toBeHidden()
    const copy = JSON.parse(
      await readFile(resolve(shared, 'copy.network.json'), 'utf8')
    )
    expect(copy.workflow).toEqual(network.workflow)
  } finally {
    await app.close()
  }
})
