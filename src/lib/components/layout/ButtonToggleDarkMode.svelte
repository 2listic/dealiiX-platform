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
  <span class="slider round"></span>
</label>
<div>
  {#if checked}
    Dark mode
  {:else}
    Light mode
  {/if}
</div>

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

  .switch {
    position: relative;
    display: inline-block;
    width: 60px;
    height: 34px;
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
    height: 26px;
    width: 26px;
    left: 4px;
    bottom: 4px;
    background-color: white;
    -webkit-transition: 0.4s;
    transition: 0.4s;
  }

  input:checked + .slider {
    background-color: #2196f3;
  }

  input:focus + .slider {
    box-shadow: 0 0 1px #2196f3;
  }

  input:checked + .slider:before {
    -webkit-transform: translateX(26px);
    -ms-transform: translateX(26px);
    transform: translateX(26px);
  }

  /* Rounded sliders */
  .slider.round {
    border-radius: 34px;
  }

  .slider.round:before {
    border-radius: 50%;
  }
</style>
