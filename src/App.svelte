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
          <FlowCanvas
            onToggleParameters={() => (parametersOpen = !parametersOpen)}
          />
        </div>
        <div class="parameters-panel" class:open={parametersOpen}>
          <div class="parameters-panel-header">
            <span>Parameters</span>
            <button onclick={() => (parametersOpen = false)}>&times;</button>
          </div>
          <ParametersView />
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
    flex: 12;
    height: 100vh;
    position: relative;
    overflow: hidden;
  }

  .flow-wrapper {
    width: 100%;
    height: 100%;
  }

  .parameters-panel {
    position: absolute;
    top: 7rem;
    right: 0;
    width: 65%;
    height: calc(100% - 7rem);
    z-index: 50;
    background-color: var(--background-color);
    border-top: 2px solid var(--xy-edge-stroke, #ccc);
    border-left: 1px solid var(--xy-edge-stroke, #ccc);
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.33, 1, 0.68, 1);
    pointer-events: none;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .parameters-panel.open {
    transform: translateX(0);
    pointer-events: auto;
  }

  .parameters-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    background: var(--primary-color);
    border-bottom: 1px solid var(--xy-edge-stroke, #ccc);
    flex: 0 0 auto;
  }

  .parameters-panel-header span {
    font-weight: 600;
    color: var(--ternary-color);
  }

  .parameters-panel-header button {
    background: none;
    border: none;
    font-size: 1.4rem;
    cursor: pointer;
    color: var(--ternary-color);
    line-height: 1;
    padding: 0.25rem 0.5rem;
  }
</style>
