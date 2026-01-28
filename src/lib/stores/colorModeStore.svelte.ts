import { type ColorModeClass } from '@xyflow/svelte'

// Check localStorage for initial value
const initialColorMode =
  (localStorage.getItem('colorMode') as ColorModeClass) || 'light'

// Initialize reactive state
let colorMode: ColorModeClass = $state(initialColorMode)

/**
 * It updates the theme mode browser side and in the electron main process if running. It also updates the localStorage
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
  localStorage.setItem('colorMode', colorMode)
  console.log('Browser theme', colorMode)
}

// Initialize colore mode
updateThemeMode()

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
