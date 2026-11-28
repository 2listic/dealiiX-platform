import { frontendSettingsState } from './frontendSettings.svelte'
import { toastState } from './toastsStore.svelte'

const darkSystem = globalThis.window?.matchMedia?.(
  '(prefers-color-scheme: dark)'
)
let systemDark = $state(darkSystem?.matches ?? false)
darkSystem?.addEventListener('change', (event) => (systemDark = event.matches))

const colorMode = $derived(
  frontendSettingsState.theme === 'dark' ||
    (frontendSettingsState.theme === 'auto' && systemDark)
    ? 'dark'
    : 'light'
)

if (globalThis.document) {
  $effect.root(() => {
    $effect(() => {
      document.documentElement.classList.toggle('dark', colorMode === 'dark')
    })
  })
}

export const colorModeState = {
  get value() {
    return colorMode
  },
  async toggle() {
    try {
      await frontendSettingsState.setTheme(
        colorMode === 'dark' ? 'light' : 'dark'
      )
    } catch (error) {
      toastState.add({
        message: error instanceof Error ? error.message : String(error),
        type: 'error',
      })
    }
  },
}
