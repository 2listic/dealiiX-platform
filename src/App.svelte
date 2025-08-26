<script lang="ts">
  import { SvelteFlowProvider } from '@xyflow/svelte'
  import FlowCanvas from './lib/components/FlowCanvas.svelte'
  import Sidebar from './lib/components/layout/Sidebar.svelte'
  import SidebarButtons from './lib/components/layout/SidebarButtons.svelte'
  import { sideBarState } from './lib/stores/sidebar.svelte'
  import { onMount } from 'svelte'
  import ButtonToggleMenu from './lib/components/layout/ButtonToggleMenu.svelte'

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
      <div class="flow-wrapper">
        <FlowCanvas />
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
    flex: 1; /* Takes 1 part of the remaining space */
    max-width: 80px;
  }

  .flow-wrapper {
    flex: 12; /* Takes 12 parts of the remaining space */
    height: 100vh;
  }
</style>
