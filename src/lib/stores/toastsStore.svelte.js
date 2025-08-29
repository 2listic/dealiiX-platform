let toasts = $state([])

export const toastState = {
  dismiss(id) {
    console.log('toast id to dismiss', id)
    const newToasts = toasts.filter((t) => {
      return t.id !== id
    })
    console.log('newToasts', $state.snapshot(newToasts))
    toasts = newToasts
    console.log('toasts after dismiss', $state.snapshot(toasts))
  },
  add(toast) {
    const id = Math.floor(Math.random() * 10000)

    const timeoutDefault = toast.type == 'error' ? 10000 : 5000
    const defaults = {
      id,
      type: 'success',
      dismissible: true,
      timeout: timeoutDefault,
    }

    const newToast = { ...defaults, ...toast }
    toasts.push(newToast)
    console.log('toasts', $state.snapshot(toasts))

    if (newToast.timeout) {
      setTimeout(() => this.dismiss(id), newToast.timeout)
    }
  },
  getToast(id) {
    return toasts.find((toast) => toast.id === id)
  },
  get current() {
    return toasts
  },
}
