<script lang="ts">
  import { SvelteFlowProvider } from '@xyflow/svelte'
  import FlowCanvas from './lib/components/FlowCanvas.svelte'
  import ParametersView from './lib/components/ParametersView.svelte'
  import Sidebar from './lib/components/layout/Sidebar.svelte'
  import SidebarButtons from './lib/components/layout/SidebarButtons.svelte'
  import { sideBarState } from './lib/stores/sidebar.svelte'
  import { onMount } from 'svelte'
  import ButtonToggleMenu from './lib/components/layout/ButtonToggleMenu.svelte'
  import TabBar from './lib/components/layout/TabBar.svelte'
  import ToastsWrapper from './lib/components/ToastsWrapper.svelte'

  let activeTab: 'node-editor' | 'parameters' = $state('node-editor')

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
        <div class="flow-wrapper" class:hidden={activeTab !== 'node-editor'}>
          <FlowCanvas />
        </div>
        <div class="flow-wrapper" class:hidden={activeTab !== 'parameters'}>
          <ParametersView />
        </div>
        <TabBar {activeTab} onchange={(tab) => (activeTab = tab)} />
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
    display: flex;
    flex-direction: column;
  }

  .flow-wrapper {
    flex: 1;
    min-height: 0;
  }

  .hidden {
    display: none;
  }
</style>
