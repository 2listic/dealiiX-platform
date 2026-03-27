<script lang="ts">
  import { SvelteFlowProvider } from '@xyflow/svelte'
  import FlowCanvas from './lib/components/FlowCanvas.svelte'
  import ParametersView from './lib/components/ParametersView.svelte'
  import Sidebar from './lib/components/layout/Sidebar.svelte'
  import SidebarButtons from './lib/components/layout/SidebarButtons.svelte'
  import { sideBarState } from './lib/stores/sidebar.svelte'
  import { onMount } from 'svelte'
  import ButtonToggleMenu from './lib/components/layout/ButtonToggleMenu.svelte'
  import ToastsWrapper from './lib/components/ToastsWrapper.svelte'

  let parametersOpen = $state(false)

  let isExpanded = $derived(sideBarState.isExpanded)
  let sidebarWrapperElem
  let sidebarPositionHolderElem
  var style = window.getComputedStyle(document.body)
  const sidebarWrapperWidth = style.getPropertyValue('--sidebar-wrapper-width')

  onMount(() => {
    sidebarWrapperElem = document.getElementById('sidebar-wrapper')
    sidebarPositionHolderElem = document.getElementById(
      'sidebar-position-holder'
    )
  })
  $effect(() => {
    if (isExpanded && sidebarWrapperElem && sidebarPositionHolderElem) {
      sidebarWrapperElem.style.position = 'static'
      sidebarWrapperElem.style.width = '25vw'
      sidebarPositionHolderElem.style.display = 'none'
    } else if (sidebarWrapperElem && sidebarPositionHolderElem) {
      sidebarWrapperElem.style.position = 'absolute'
      sidebarWrapperElem.style.width = sidebarWrapperWidth
      sidebarPositionHolderElem.style.display = 'block'
    }
  })
</script>

<main>
  <ToastsWrapper></ToastsWrapper>
  <SvelteFlowProvider>
    <div id="app-container">
      <ButtonToggleMenu />
      <div id="sidebar-wrapper">
        <Sidebar />
      </div>
      <div id="sidebar-position-holder"></div>
      <div id="sidebar-buttons-wrapper">
        <SidebarButtons />
      </div>
      <div class="main-content">
        <div class="flow-wrapper">
          <FlowCanvas />
        </div>
        <div class="parameters-panel" class:open={parametersOpen}>
          <button
            class="parameters-tab"
            onclick={() => (parametersOpen = !parametersOpen)}
            title={parametersOpen
              ? 'Close parameters panel'
              : 'Open parameters panel'}
          >
            <span>Parameters</span>
          </button>
          <div class="parameters-panel-inner">
            <ParametersView />
          </div>
        </div>
      </div>
    </div>
  </SvelteFlowProvider>
</main>

<style>
  :root {
    --sidebar-wrapper-min-width: 50px;
    --sidebar-wrapper-width: 3vw;
  }

  #app-container {
    height: 100vh;
    width: 100vw;
    display: flex;
    flex-direction: row;
  }

  #sidebar-wrapper {
    position: absolute;
    left: 0;
    top: 0;
    z-index: 100;
    cursor: pointer;
    /* margin-top: 30px; */
    min-width: var(--sidebar-wrapper-min-width);
    transition: width 0.5s 0.1s ease-in-out;
  }

  #sidebar-position-holder {
    min-width: var(--sidebar-wrapper-min-width);
    width: var(--sidebar-wrapper-width);
  }

  #sidebar-wrapper:hover {
    width: 25vw !important; /* Set important to override the inline style */
  }

  #sidebar-buttons-wrapper {
    flex: 0 0 auto; /* Don't grow, don't shrink, use element's intrinsic width (fit-content) as starting size */
    width: fit-content;
  }

  .main-content {
    /* flex:1 — sole growing child in the flex row, it takes all remaining horizontal space after the sidebar. */
    flex: 1;
    height: 100vh;
    /* position: relative - makes it the anchor for the absolutely-positioned parameters panel and its pull-tab. */
    position: relative;
    overflow: hidden;
  }

  .flow-wrapper {
    width: 100%;
    height: 100%;
  }

  .parameters-panel {
    position: absolute;
    z-index: 50;
    top: 7rem;
    /* Positioned to the right edge of .main-content */
    right: 0;
    width: 65%;
    height: calc(100% - 7rem);
    background-color: var(--background-color);
    border-top: 2px solid var(--xy-edge-stroke, #ccc);
    border-left: 1px solid var(--xy-edge-stroke, #ccc);
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
    /* Transform - translates fully off-screen to the right */
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.33, 1, 0.68, 1);
    pointer-events: none;
    display: flex;
    flex-direction: column;
  }

  .parameters-panel-inner {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }

  .parameters-tab {
    position: absolute;
    left: -3rem;
    top: 1rem;
    width: 3rem;
    height: 9rem;
    background: var(--primary-color);
    border: 1px solid var(--xy-edge-stroke, #ccc);
    border-right: none;
    border-radius: 6px 0 0 6px;
    box-shadow: -2px 0 6px rgba(0, 0, 0, 0.12);
    cursor: pointer;
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    color: var(--ternary-color);
    font-weight: bold;
    font-size: 1.1rem;
  }

  .parameters-tab span {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    user-select: none;
    letter-spacing: 0.04em;
  }

  .parameters-panel.open {
    /* Remove the translation */
    transform: translateX(0);
    pointer-events: auto;
  }
</style>
