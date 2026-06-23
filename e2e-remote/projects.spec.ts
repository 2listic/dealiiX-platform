import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

test.describe('Projects', () => {
  test('can create a project and see it in the list', async ({
    authedPage: page,
  }) => {
    const name = `Test Project ${Date.now()}`
    await createProject(page, name)

    await openLoadProjects(page)
    await expect(page.locator('.project-card', { hasText: name })).toBeVisible()

    await deleteProjectByName(page, name)
    await page.keyboard.press('Escape')
  })

  test('can rename a project', async ({ authedPage: page }) => {
    const name = `Rename Me ${Date.now()}`
    const newName = `Renamed ${Date.now()}`
    await createProject(page, name)

    await openLoadProjects(page)
    await page
      .locator('.project-card', { hasText: name })
      .getByRole('button', { name: 'Edit' })
      .click()

    await expect(page.locator('h2', { hasText: 'Edit Project' })).toBeVisible()
    // Only the Edit modal's form is in the DOM when it is open.
    const nameInput = page.locator('#project-name')
    await nameInput.clear()
    await nameInput.fill(newName)
    await page.getByRole('button', { name: 'Update' }).click()

    await expect(
      page.locator('[role="alert"]').filter({ hasText: 'saved' })
    ).toBeVisible()
    await expect(page.locator('[role="alert"]')).toHaveCount(0, {
      timeout: 15_000,
    })

    // onUpdate() refreshes the list in place — the projects modal stays open.
    await expect(
      page.locator('.project-card', { hasText: newName })
    ).toBeVisible()

    await deleteProjectByName(page, newName)
    await page.keyboard.press('Escape')
  })

  test('can delete a project', async ({ authedPage: page }) => {
    const name = `Delete Me ${Date.now()}`
    await createProject(page, name)

    await openLoadProjects(page)
    const card = page.locator('.project-card', { hasText: name })
    await expect(card).toBeVisible()

    await card.getByRole('button', { name: 'Delete' }).click()
    await page
      .locator('.confirmation-modal')
      .getByRole('button', { name: 'Delete' })
      .click()

    // Card disappears reactively from the list.
    await expect(card).not.toBeVisible({ timeout: 5_000 })
    await expect(
      page.locator('[role="alert"]').filter({ hasText: 'deleted' })
    ).toBeVisible()

    await page.keyboard.press('Escape')
  })

  test('can load a project and get a success toast', async ({
    authedPage: page,
  }) => {
    const name = `Load Me ${Date.now()}`
    await createProject(page, name)

    await openLoadProjects(page)
    await page
      .locator('.project-card', { hasText: name })
      .getByRole('button', { name: 'Load' })
      .click()

    await expect(
      page.locator('[role="alert"]').filter({ hasText: /loaded successfully/i })
    ).toBeVisible({ timeout: 10_000 })

    // Cleanup
    await expect(page.locator('[role="alert"]')).toHaveCount(0, {
      timeout: 15_000,
    })
    await openLoadProjects(page)
    await deleteProjectByName(page, name)
    await page.keyboard.press('Escape')
  })
})

// ── Helpers ──

async function openProjectMenu(page: Page): Promise<void> {
  await page.locator('button[title="Project"]').click()
}

async function createProject(page: Page, name: string): Promise<void> {
  await openProjectMenu(page)
  await page
    .locator('[role="menu"]')
    .locator('button', { hasText: 'Save Project' })
    .click()

  await expect(page.locator('h2', { hasText: 'Save Project' })).toBeVisible()
  await page.locator('#project-name').fill(name)
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(
    page.locator('[role="alert"]').filter({ hasText: 'saved successfully' })
  ).toBeVisible()
  await expect(page.locator('[role="alert"]')).toHaveCount(0, {
    timeout: 15_000,
  })
}

async function openLoadProjects(page: Page): Promise<void> {
  await openProjectMenu(page)
  await page
    .locator('[role="menu"]')
    .locator('button', { hasText: 'Load Projects' })
    .click()
  // Wait until the modal header is visible.
  await expect(page.locator('h2', { hasText: 'Projects' })).toBeVisible()
  // Info toast appears when there are no projects — wait for it to clear.
  await expect(page.locator('[role="alert"]')).toHaveCount(0, {
    timeout: 15_000,
  })
}

async function deleteProjectByName(page: Page, name: string): Promise<void> {
  const card = page.locator('.project-card', { hasText: name })
  await card.getByRole('button', { name: 'Delete' }).click()
  await page
    .locator('.confirmation-modal')
    .getByRole('button', { name: 'Delete' })
    .click()
  await expect(
    page.locator('[role="alert"]').filter({ hasText: 'deleted' })
  ).toBeVisible()
  await expect(page.locator('[role="alert"]')).toHaveCount(0, {
    timeout: 15_000,
  })
}
