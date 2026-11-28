import { _electron as electron, expect, test } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

test('frontend settings validate, persist and switch the root backend', async ({}, info) => {
  const helper = info.outputPath('backend.cjs')
  const initial = info.outputPath('initial.json')
  const alternative = info.outputPath('alternative.json')
  const invalid = info.outputPath('invalid.json')
  const userData = info.outputPath('userdata')
  await mkdir(dirname(helper), { recursive: true })
  await Promise.all([
    writeFile(initial, '{"id":"initial"}'),
    writeFile(alternative, '{"id":"alternative"}'),
    writeFile(invalid, '{"error":true}'),
    writeFile(
      helper,
      `
      const fs = require('node:fs')
      const { version, operation } = JSON.parse(fs.readFileSync(0, 'utf8'))
      const { id, error } = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'))
      if (operation !== 'describe') throw Error('Expected backend describe')
      const configuration_digest = 'sha256:' + '1'.repeat(64)
      const registry_digest = 'sha256:' + (id === 'initial' ? '2' : '3').repeat(64)
      const result = {
        __backend: { id, version, configuration_digest, registry_digest, operations: ['describe'] },
        [id + '::Check']: {
          type: id + '::Check', node_type: 'void_function', arguments: [], inputs: [], outputs: [],
          display_name: 'Check', class_name: id,
        },
      }
      console.log(JSON.stringify(error ? {
        version, operation, error: { code: 'bad_profile', message: 'Invalid backend profile' },
      } : { version, operation, result }))
    `
    ),
  ])
  const launch = () =>
    electron.launch({
      args: [process.cwd(), '--no-sandbox'],
      env: {
        ...process.env,
        E2E_TEST: '1',
        ELECTRON_USERDATA: userData,
        DEALIIX_BACKEND_COMMAND: JSON.stringify([process.execPath, helper]),
        DEALIIX_CONFIGURATION: initial,
      },
    })
  const app = await launch()
  try {
    const page = await app.firstWindow()
    const openSettings = () =>
      page.getByTitle('Frontend Settings', { exact: true }).click()
    const settings = page.locator('#frontend-settings-modal')
    const initialPalette = page.locator(
      '[data-testid=sidebar-node-class][data-class-name=Initial]'
    )
    const alternativePalette = page.locator(
      '[data-testid=sidebar-node-class][data-class-name=Alternative]'
    )
    await expect(initialPalette).toBeVisible()
    await openSettings()
    await expect(
      settings.getByRole('heading', { name: 'Frontend Settings' })
    ).toBeVisible()
    const backendProfile = settings.getByRole('textbox', {
      name: 'Backend configuration file',
    })
    await expect(backendProfile).toHaveValue(initial)
    const setProfile = async (path: string) => {
      await backendProfile.evaluate((input: HTMLInputElement, value) => {
        input.value = value
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }, path)
      await expect(backendProfile).toHaveValue(path)
    }
    await setProfile(invalid)
    await settings.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(settings.getByRole('alert')).toContainText(
      'Invalid backend profile'
    )
    await expect(initialPalette).toBeVisible()
    await expect(
      readFile(info.outputPath('userdata', 'frontend.config.json'))
    ).rejects.toHaveProperty('code', 'ENOENT')

    await setProfile(alternative)
    await settings.getByRole('combobox', { name: 'Theme' }).selectOption('dark')
    await settings.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(settings).toBeHidden()
    await expect(alternativePalette).toBeVisible()
    await expect(initialPalette).toHaveCount(0)
    await expect(page.locator('html')).toHaveClass('dark')
    const saved = JSON.parse(
      await readFile(
        info.outputPath('userdata', 'frontend.config.json'),
        'utf8'
      )
    )
    expect(saved['Backend configuration file'].value).toBe(alternative)
    expect(saved.Theme.value).toBe('dark')
  } finally {
    await app.close()
  }
  const restarted = await launch()
  try {
    const page = await restarted.firstWindow()
    await expect(
      page.locator(
        '[data-testid=sidebar-node-class][data-class-name=Alternative]'
      )
    ).toBeVisible()
    await expect(page.locator('html')).toHaveClass('dark')
  } finally {
    await restarted.close()
  }
})
