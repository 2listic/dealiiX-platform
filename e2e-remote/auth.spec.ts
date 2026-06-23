import { test, expect, TEST_USER } from './fixtures'

test.describe('Auth', () => {
  test('login button is visible and shows "Login" when logged out', async ({
    remotePage: page,
  }) => {
    await expect(page.locator('[data-testid="login-status"]')).toHaveText(
      'Login'
    )
    // The label is the visible clickable element; verify it lacks the disabled class.
    await expect(page.locator('label[for="login-button"]')).not.toHaveClass(
      /disabled/
    )
  })

  test('user can log in with valid credentials', async ({
    remotePage: page,
  }) => {
    await page.locator('label[for="login-button"]').click()

    await expect(page.locator('#login-username')).toBeVisible()
    await page.locator('#login-username').fill(TEST_USER.username)
    await page.locator('#login-password').fill(TEST_USER.password)
    await page.locator('[data-testid="login-form"] button[type="submit"]').click()

    await expect(page.locator('[data-testid="login-status"]')).toHaveText(
      TEST_USER.username,
      { timeout: 10_000 }
    )
  })

  test('user can log out', async ({ authedPage: page }) => {
    await expect(page.locator('[data-testid="login-status"]')).toHaveText(
      TEST_USER.username
    )

    await page.locator('label[for="login-button"]').click()
    await expect(page.locator('.confirmation-modal')).toBeVisible()
    await page
      .locator('.confirmation-modal')
      .getByRole('button', { name: 'Logout' })
      .click()

    await expect(page.locator('[data-testid="login-status"]')).toHaveText(
      'Login',
      { timeout: 10_000 }
    )
  })
})
