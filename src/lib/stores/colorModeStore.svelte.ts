import { type ColorModeClass } from '@xyflow/svelte'

// Initialize reactive state
let colorMode: ColorModeClass = $state('light')

// Load initial color mode from electron-store
const loadColorMode = async () => {
  if (window.electron?.store) {
    colorMode = (await window.electron.store.get(
      'colorMode',
      'light'
    )) as ColorModeClass
    updateThemeMode()
  } else {
    console.warn('Electron store not available (e.g., dev:vite mode)')
  }
}
loadColorMode()

/**
 * It updates the theme mode browser side and in the electron main process if running. It also updates the store
 */
const updateThemeMode = async () => {
  if (window.electron) {
    const actualTheme = await window.electron.invoke('set-theme', colorMode)
    console.log('Electron theme: ', actualTheme)
  }
  if (colorMode == 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  await window.electron.store.set('colorMode', colorMode)
  console.log('Browser theme', colorMode)
}

export const colorModeState = {
  get value() {
    return colorMode
  },
  set value(value) {
    colorMode = value
    updateThemeMode()
  },
  toggle() {
    const newColorMode = colorMode === 'light' ? 'dark' : 'light'
    colorMode = newColorMode
    updateThemeMode()
  },
}
