<script lang="ts">
  import { colorModeState } from '../../stores/colorModeStore.svelte'

  let checked = $derived(colorModeState.value === 'dark')

  const onChangeSwitch = async () => {
    colorModeState.toggle()
  }
</script>

<div id="button-dark-mode-wrapper">
  <label class="switch">
    <input bind:checked type="checkbox" onchange={onChangeSwitch} />
    <span class="slider round" title="Switch between light and dark modes"
    ></span>
  </label>
  <svg
    version="1.1"
    id="Icons"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 32 32"
    xml:space="preserve"
    width="30px"
    height="30px"
  >
    <line class="st0" x1="16" y1="3" x2="16" y2="29" />
    <path class="st0" d="M16,23c-3.87,0-7-3.13-7-7s3.13-7,7-7" />
    <line class="st0" x1="6.81" y1="6.81" x2="8.93" y2="8.93" />
    <line class="st0" x1="3" y1="16" x2="6" y2="16" />
    <line class="st0" x1="6.81" y1="25.19" x2="8.93" y2="23.07" />
    <path
      class="st0"
      d="M16,12.55C17.2,10.43,19.48,9,22.09,9c0.16,0,0.31,0.01,0.47,0.02c-1.67,0.88-2.8,2.63-2.8,4.64
	c0,2.9,2.35,5.25,5.25,5.25c1.6,0,3.03-0.72,3.99-1.85C28.48,20.43,25.59,23,22.09,23c-2.61,0-4.89-1.43-6.09-3.55"
    />
  </svg>
</div>

<style>
  #button-dark-mode-wrapper {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }

  .st0 {
    fill: none;
    stroke: var(--ternary-color);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-miterlimit: 10;
  }

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
