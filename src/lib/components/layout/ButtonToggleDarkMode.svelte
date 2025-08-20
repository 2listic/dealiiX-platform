<script lang="ts">
  import { colorModeState } from '../../stores/colorModeStore.svelte'

  let checked = $derived(colorModeState.value === 'dark')

  const onChangeSwitch = async () => {
    colorModeState.toggle()
    // @ts-ignore
    if (window.electron) {
      // @ts-ignore
      const actualTheme = await window.electron.invoke(
        'set-theme',
        colorModeState.value
      )
      console.log('Electron theme: ', actualTheme)
    }
    if (checked === true) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    console.log('Browser theme', colorModeState.value)
  }
</script>

<label class="switch">
  <input bind:checked type="checkbox" onchange={onChangeSwitch} />
  <span class="slider round" title="Switch between light and dark modes"></span>
</label>
<div style="margin-top: 0.5rem">
  {#if checked}
    Dark mode
  {:else}
    Light mode
  {/if}
</div>

<style>
  .switch {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 27px;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    -webkit-transition: 0.4s;
    transition: 0.4s;
  }

  .slider:before {
    position: absolute;
    content: '';
    height: 21px;
    width: 21px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    -webkit-transition: 0.4s;
    transition: 0.4s;
  }

  input:checked + .slider:before {
    -webkit-transform: translateX(21px);
    -ms-transform: translateX(21px);
    transform: translateX(21px);
  }

  /* Rounded sliders */
  .slider.round {
    border-radius: 27px;
  }

  .slider.round:before {
    border-radius: 50%;
  }
</style>
