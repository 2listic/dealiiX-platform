<script>
  import { SvelteFlowProvider } from '@xyflow/svelte'
  import FlowCanvas from './lib/components/FlowCanvas.svelte'
  import DnDProvider from './lib/components/DnDProvider.svelte'
  import Sidebar from './lib/components/layout/Sidebar.svelte'
  import SidebarButtons from './lib/components/layout/SidebarButtons.svelte'
  import { sideBarState } from './lib/stores/sidebar.svelte'
  import { onMount } from 'svelte'

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

  const toggleExpandSidebar = () => sideBarState.toggle()
</script>

<main>
  <SvelteFlowProvider>
    <DnDProvider>
      <div id="app-container">
        <button
          id="button-sidebar-expansion"
          title="Toggle between fixed and collapsible menu"
          onclick={toggleExpandSidebar}
        >
          {#if sideBarState.isExpanded}
            <svg
              width="20px"
              height="20px"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M13 5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44772 11 5C11 5.55228 11.4477 6 12 6C12.5523 6 13 5.55228 13 5Z"
                stroke="#000000"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13C12.5523 13 13 12.5523 13 12Z"
                stroke="#000000"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M13 19C13 18.4477 12.5523 18 12 18C11.4477 18 11 18.4477 11 19C11 19.5523 11.4477 20 12 20C12.5523 20 13 19.5523 13 19Z"
                stroke="#000000"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          {:else}
            <svg
              width="20px"
              height="20px"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 17H20M4 12H20M4 7H20"
                stroke="#000000"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          {/if}
        </button>
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
    </DnDProvider>
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

  #button-sidebar-expansion {
    position: absolute;
    z-index: 101;
    top: 0;
    left: 0;
    margin: 0.5rem 25px 0.5rem 0.5rem;
    background-color: var(--background-color-secondary);
    border: 1px solid grey;
    border-radius: 5px;
    cursor: pointer;
  }
  #button-sidebar-expansion:hover {
    border-color: var(--border-color-hover);
  }

  #sidebar-wrapper {
    position: absolute;
    left: 0;
    top: 0;
    z-index: 100;
    cursor: pointer;
    /* margin-top: 30px; */
    min-width: var(--sidebar-wrapper-min-width);
    transition: width 0.4s 0.1s ease-in-out;
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
