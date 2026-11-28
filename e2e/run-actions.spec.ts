import { _electron as electron, expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

test('the Run menu uses the root backend operations and their diagnostics', async ({}, info) => {
  const helper = info.outputPath('backend.cjs')
  const profile = info.outputPath('backend.config.json')
  await mkdir(dirname(profile), { recursive: true })
  await writeFile(profile, '{}')
  await writeFile(
    helper,
    `
    const fs = require('node:fs')
    const request = JSON.parse(fs.readFileSync(0, 'utf8'))
    const { version, operation } = request
    const profilePath = process.argv[3]
    const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'))
    const configuration_digest = 'sha256:' + '1'.repeat(64)
    const registry_digest = 'sha256:' + '2'.repeat(64)
    const source = 'run-' + '3'.repeat(32)
    const replay = 'run-' + '4'.repeat(32)
    const status = (run_id, state, extra = {}) => ({ run_id, state, nodes: {}, ...extra })
    let result
    let error
    switch (operation) {
      case 'describe':
        result = { __backend: { id: 'independent', version, configuration_digest, registry_digest,
          operations: profile.operations ?? ['describe', 'validate', 'submit', 'outputs', 'status', 'replay', 'cancel', 'pause', 'resume'] } }
        break
      case 'validate':
      case 'submit':
        if (request.network.backend.id !== 'independent' || request.configuration_digest !== configuration_digest || request.registry_digest !== registry_digest)
          throw Error('Expected the root workflow and both revisions')
        if (operation === 'submit') result = status(source, 'succeeded')
        else if (profile.reject) error = { code: 'invalid_network', message: 'Rejected by backend' }
        else result = { valid: true }
        break
      case 'outputs':
        if (request.run_id !== source) throw Error('Expected the latest run')
        result = { run_id: source, outputs: { '0': ['results/flow.vtu'] } }
        break
      case 'replay':
        if (request.run_id !== source) throw Error('Expected the successful source run')
        result = status(replay, 'running', { source_run_id: source, scheduling: { revision: 0, state: 'active' } })
        break
      case 'pause':
      case 'resume':
        if (request.run_id !== replay) throw Error('Expected the same replayed run')
        profile.scheduling = operation === 'pause'
          ? { revision: 1, state: 'paused' }
          : { revision: 2, state: 'active' }
        fs.writeFileSync(profilePath, JSON.stringify(profile))
        result = status(replay, 'running', { scheduling: profile.scheduling })
        break
      case 'cancel':
        if (request.run_id !== replay) throw Error('Expected the replayed run')
        profile.cancelled = true
        fs.writeFileSync(profilePath, JSON.stringify(profile))
        result = status(replay, 'cancelled')
        break
      case 'status':
        result = request.run_id === source ? status(source, 'succeeded') : status(replay,
          profile.cancelled ? 'cancelled' : 'running',
          profile.cancelled ? {} : { scheduling: profile.scheduling ?? { revision: 0, state: 'active' } })
        break
    }
    console.log(JSON.stringify(error ? { version, operation, error } : { version, operation, result }))
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
    const run = page.getByTitle('Run', { exact: true })
    await run.click()
    const action = (name: string) =>
      page.getByRole('button', { name, exact: true })
    await expect(action('View latest outputs')).toBeDisabled()
    await expect(action('Replay latest run')).toBeDisabled()
    await expect(action('Cancel latest run')).toBeDisabled()
    await expect(action('Pause latest run')).toBeDisabled()
    await action('Validate graph').click()
    await expect(
      page.getByText('Workflow is valid', { exact: true })
    ).toBeVisible()
    await writeFile(profile, '{"reject":true}')
    await run.click()
    await action('Validate graph').click()
    await expect(
      page.getByText('invalid_network: Rejected by backend')
    ).toBeVisible()

    await run.click()
    await action('Run new job').click()
    await expect(page.getByRole('cell', { name: 'succeeded' })).toBeVisible()
    await run.click()
    await action('View latest outputs').click()
    await expect(
      page.getByText('results/flow.vtu', { exact: false })
    ).toBeVisible()
    await action('Close').click()
    await run.click()
    await action('Replay latest run').click()
    await expect(page.getByRole('cell', { name: 'running' })).toBeVisible()
    await run.click()
    await action('Pause latest run').click()
    await expect(
      page.getByRole('cell', { name: 'Paused', exact: true })
    ).toBeVisible()
    await run.click()
    await action('Resume latest run').click()
    await expect(
      page.getByRole('cell', { name: 'running', exact: true })
    ).toBeVisible()
    await run.click()
    await action('Cancel latest run').click()
    await action('Cancel run').click()
    await expect(page.getByRole('cell', { name: 'cancelled' })).toBeVisible()
  } finally {
    await app.close()
  }
})
