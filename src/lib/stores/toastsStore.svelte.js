let toasts = $state([])

export const toastState = {
  dismiss(id) {
    const newToasts = toasts.filter((t) => {
      return t.id !== id
    })
    toasts = newToasts
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
