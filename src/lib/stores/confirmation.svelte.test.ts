import { describe, expect, it } from 'vitest'
import { confirmAction, confirmationState } from './confirmation.svelte'

describe('confirmAction', () => {
  it('resolves with the answer and keeps the request text', async () => {
    const answer = confirmAction({ message: 'Unmark?' })

    expect(confirmationState.pending).toBe(true)
    expect(confirmationState.request?.message).toBe('Unmark?')

    confirmationState.settle(true)

    await expect(answer).resolves.toBe(true)
    expect(confirmationState.pending).toBe(false)
    expect(confirmationState.request?.message).toBe('Unmark?')
  })

  it('answers only once, so closing after confirming is ignored', async () => {
    const answer = confirmAction({ message: 'Delete?' })

    confirmationState.settle(true)
    confirmationState.settle(false)

    await expect(answer).resolves.toBe(true)
  })

  it('answers a pending request with false when a new one arrives', async () => {
    const first = confirmAction({ message: 'First?' })
    const second = confirmAction({ message: 'Second?' })

    await expect(first).resolves.toBe(false)
    expect(confirmationState.request?.message).toBe('Second?')

    confirmationState.settle(true)
    await expect(second).resolves.toBe(true)
  })
})
