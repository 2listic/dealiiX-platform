<script lang="ts">
  import { colorModeState } from '../../stores/colorModeStore.svelte'

  // const toggleExpandSidebar = () => sideBarState.toggle()

  const onColorModeChange = async (e) => {
    const newMode = e.target.value
    // @ts-ignore
    if (window.electron) {
      // @ts-ignore
      const actualTheme = await window.electron.invoke('set-theme', newMode)
      console.log('Electron theme: ', actualTheme)
    }
    if (newMode === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    console.log('Browser theme', newMode)
  }
</script>

<select
  class="custom-panel"
  bind:value={colorModeState.value}
  onchange={onColorModeChange}
>
  <option value="light">Light mode</option>
  <option value="dark">Dark mode</option>
</select>

<style>
  .custom-panel {
    background-color: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 1vh;
    margin-bottom: 1vh;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    font-size: 1.5em;
    color: #333;
    cursor: pointer;
  }
</style>
