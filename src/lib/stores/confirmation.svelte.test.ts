import { describe, expect, it } from 'vitest'
import {
  chooseAction,
  confirmAction,
  confirmationState,
} from './confirmation.svelte'

describe('confirmAction', () => {
  it('resolves with the answer and keeps the request text', async () => {
    const answer = confirmAction({ message: 'Unmark?' })

    expect(confirmationState.pending).toBe(true)
    expect(confirmationState.request?.message).toBe('Unmark?')

    confirmationState.settle('confirm')

    await expect(answer).resolves.toBe(true)
    expect(confirmationState.pending).toBe(false)
    expect(confirmationState.request?.message).toBe('Unmark?')
  })

  it('answers only once, so closing after confirming is ignored', async () => {
    const answer = confirmAction({ message: 'Delete?' })

    confirmationState.settle('confirm')
    confirmationState.settle('cancel')

    await expect(answer).resolves.toBe(true)
  })

  it('answers a pending request with false when a new one arrives', async () => {
    const first = confirmAction({ message: 'First?' })
    const second = confirmAction({ message: 'Second?' })

    await expect(first).resolves.toBe(false)
    expect(confirmationState.request?.message).toBe('Second?')

    confirmationState.settle('confirm')
    await expect(second).resolves.toBe(true)
  })
})

describe('chooseAction', () => {
  it('resolves with the button chosen', async () => {
    const answer = chooseAction({
      message: 'Missing file',
      alternativeText: 'Upload',
    })

    expect(confirmationState.request?.alternativeText).toBe('Upload')

    confirmationState.settle('alternative')

    await expect(answer).resolves.toBe('alternative')
  })

  it('makes confirmAction false when the alternative is chosen', async () => {
    const answer = confirmAction({ message: 'Continue?' })

    confirmationState.settle('alternative')

    await expect(answer).resolves.toBe(false)
  })
})
