interface Toast {
  id: number
  type: 'success' | 'error' | 'info'
  dismissible: boolean
  timeout: number
  message: string
}

let toasts = $state<Toast[]>([])

export const toastState = {
  /**
   * Removes a toast from the queue by ID.
   * @param id - The ID of the toast to remove.
   */
  dismiss(id: number) {
    const newToasts = toasts.filter((t) => {
      return t.id !== id
    })
    toasts = newToasts
  },
  /**
   * Queues a new toast notification. Defaults: type `'success'`, dismissible, 5 s timeout (10 s for errors).
   * @param toast - Toast fields to display. Only `message` is required; all other fields override the defaults.
   */
  add(toast: Partial<Toast> & { message: string }) {
    const id = Math.floor(Math.random() * 10000)
    const timeoutDefault = toast.type == 'error' ? 10000 : 5000
    const defaults = {
      id,
      type: 'success' as const,
      dismissible: true,
      timeout: timeoutDefault,
    }
    const newToast = { ...defaults, ...toast }
    toasts.push(newToast)

    if (newToast.timeout) {
      setTimeout(() => this.dismiss(id), newToast.timeout)
    }
  },
  /**
   * Looks up a toast by ID without removing it.
   * @param id - The ID of the toast to find.
   * @returns The matching toast, or `undefined` if not found.
   */
  getToast(id: number) {
    return toasts.find((toast) => toast.id === id)
  },
  /** The reactive list of active toasts, consumed by `ToastsWrapper.svelte`. */
  get current() {
    return toasts
  },
}
