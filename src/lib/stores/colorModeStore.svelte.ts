import { type ColorModeClass } from '@xyflow/svelte'

let colorMode: ColorModeClass = $state('light')

export const colorModeState = {
  get value() {
    return colorMode
  },
  set value(value) {
    colorMode = value
  },
  toggle() {
    colorMode = colorMode === 'light' ? 'dark' : 'light'
  },
}
