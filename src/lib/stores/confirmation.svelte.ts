/**
 * App-wide confirmation dialog, used instead of `window.confirm`: after a
 * native dialog closes, Electron can leave the page's inputs unable to take
 * focus. `ConfirmationHost` (mounted once in App) shows the pending request.
 */

/** What the confirmation dialog shows. */
export type ConfirmationRequest = {
  message: string
  title?: string
  /** Label of the confirm button; defaults to "Confirm". */
  confirmText?: string
  confirmVariant?: 'default' | 'action' | 'delete'
  /** Label of a second action button, shown only when set. */
  alternativeText?: string
}

/** The button that answered the dialog; `cancel` also covers any other close. */
export type ConfirmationAnswer = 'confirm' | 'alternative' | 'cancel'

let request = $state<ConfirmationRequest | null>(null)
let pending = $state(false)
let resolvePending: ((_answer: ConfirmationAnswer) => void) | null = null

export const confirmationState = {
  /** The last request; kept after it is answered so the dialog keeps its text while it fades out. */
  get request(): ConfirmationRequest | null {
    return request
  },
  /** Whether a request is waiting for an answer. */
  get pending(): boolean {
    return pending
  },
  /**
   * Answers the pending request; does nothing when none is pending.
   *
   * @param answer - The button the user chose.
   * @returns {void}
   */
  settle(answer: ConfirmationAnswer): void {
    if (!pending) return
    pending = false
    const resolve = resolvePending
    resolvePending = null
    resolve?.(answer)
  },
}

/**
 * Asks the user to choose in the app's confirmation dialog, which shows a
 * second action button when the request sets `alternativeText`. A new request
 * answers a still-pending one with `cancel`.
 *
 * @param next - What the dialog shows.
 * @returns Resolves to the button chosen, `cancel` when cancelled or dismissed.
 */
export const chooseAction = (
  next: ConfirmationRequest
): Promise<ConfirmationAnswer> => {
  confirmationState.settle('cancel')
  request = next
  pending = true
  return new Promise((resolve) => {
    resolvePending = resolve
  })
}

/**
 * Asks the user to confirm an action in the app's confirmation dialog.
 * A new request answers a still-pending one with `false`.
 *
 * @param next - What the dialog shows.
 * @returns Resolves to `true` when confirmed, `false` when cancelled or dismissed.
 */
export const confirmAction = async (
  next: ConfirmationRequest
): Promise<boolean> => (await chooseAction(next)) === 'confirm'
