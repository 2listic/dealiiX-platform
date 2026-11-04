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
}

let request = $state<ConfirmationRequest | null>(null)
let pending = $state(false)
let resolvePending: ((_confirmed: boolean) => void) | null = null

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
   * @param confirmed - Whether the user confirmed.
   * @returns {void}
   */
  settle(confirmed: boolean): void {
    if (!pending) return
    pending = false
    const resolve = resolvePending
    resolvePending = null
    resolve?.(confirmed)
  },
}

/**
 * Asks the user to confirm an action in the app's confirmation dialog.
 * A new request answers a still-pending one with `false`.
 *
 * @param next - What the dialog shows.
 * @returns Resolves to `true` when confirmed, `false` when cancelled or dismissed.
 */
export const confirmAction = (next: ConfirmationRequest): Promise<boolean> => {
  confirmationState.settle(false)
  request = next
  pending = true
  return new Promise((resolve) => {
    resolvePending = resolve
  })
}
