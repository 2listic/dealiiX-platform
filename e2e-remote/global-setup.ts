const REMOTE_URL = 'http://localhost:8080'

const TEST_USER = {
  username: 'e2etest',
  email: 'e2etest@test.com',
  password: 'e2epassword',
}

/**
 * Playwright global setup for Tier 2 (remote) E2E tests.
 *
 * Polls until coral-remote-server responds (up to 30 s), then registers
 * the shared test user. A 409 response means the user already exists —
 * treated as success for idempotency across repeated runs.
 */
export default async function globalSetup() {
  await waitForServer()
  await registerTestUser()
}

// ── Private helpers ──

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      // Any HTTP response (even 401 / 400) means the server is up.
      const res = await fetch(`${REMOTE_URL}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'probe', password: 'probe' }),
      })
      if (res.status !== undefined) return
    } catch {
      // Connection refused — keep polling.
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(
    `coral-remote-server did not become ready within 30 s at ${REMOTE_URL}`
  )
}

async function registerTestUser(): Promise<void> {
  const res = await fetch(`${REMOTE_URL}/api/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER),
  })
  // 409 = user already exists from a previous run — that's fine.
  if (!res.ok && res.status !== 409) {
    const body = await res.text()
    throw new Error(
      `Failed to register test user: HTTP ${res.status} — ${body}`
    )
  }
}
