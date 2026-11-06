/**
 * App-wide confirmation dialog, used instead of `window.confirm`: after a
 * native dialog closes, Electron can leave the page's inputs unable to take
 * focus. `ConfirmationModal` (mounted once in App) shows the pending request.
 */

/** What the confirmation dialog shows. */
export type ConfirmationRequest = {
  message: string
  title?: string
  /** Label of the confirm button; defaults to "Confirm". */
  confirmText?: string
  /** Label of the cancel button; defaults to "Cancel". */
  cancelText?: string
  confirmVariant?: 'default' | 'action' | 'delete'
  /** Label of a second action button, shown only when set. */
  alternativeText?: string
}

/** The button that answered the dialog; `cancel` also covers any other close. */
export type ConfirmationAnswer = 'confirm' | 'alternative' | 'cancel'

let request = $state<ConfirmationRequest | null>(null)
/** Resolves the waiting caller's promise; set while a request waits for an answer. */
let resolveAnswer = $state<((_answer: ConfirmationAnswer) => void) | null>(null)

export const confirmationState = {
  /** The last request; kept after it is answered so the dialog keeps its text while it fades out. */
  get request(): ConfirmationRequest | null {
    return request
  },
  /** Whether a request waits for an answer. */
  get pending(): boolean {
    return resolveAnswer !== null
  },
  /**
   * Answers the waiting request; does nothing when none waits.
   *
   * @param answer - The button the user chose.
   * @returns {void}
   */
  answer(answer: ConfirmationAnswer): void {
    const resolve = resolveAnswer
    resolveAnswer = null
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
  // A newer request replaces one still waiting, so its caller is not left hanging.
  confirmationState.answer('cancel')
  request = next
  return new Promise((resolve) => {
    resolveAnswer = resolve
  })
}

/**
 * Asks the user to confirm an action, through {@link chooseAction}.
 *
 * @param next - What the dialog shows.
 * @returns Resolves to `true` when confirmed, `false` for any other answer or close.
 */
export const confirmAction = async (
  next: ConfirmationRequest
): Promise<boolean> => {
  const answer = await chooseAction(next)
  return answer === 'confirm'
}
