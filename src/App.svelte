<script lang="ts">
  import { SvelteFlowProvider } from '@xyflow/svelte'
  import FlowCanvas from './lib/components/FlowCanvas.svelte'
  import ParametersView from './lib/components/ParametersView.svelte'
  import PipelineCanvas from './lib/components/PipelineCanvas.svelte'
  import Sidebar from './lib/components/layout/Sidebar.svelte'
  import SidebarButtons from './lib/components/layout/SidebarButtons.svelte'
  import JobsTable from './lib/components/layout/JobsTable.svelte'
  import ButtonToggleDarkMode from './lib/components/layout/ButtonToggleDarkMode.svelte'
  import ExecutionBadge from './lib/components/layout/ExecutionBadge.svelte'
  import { sideBarState } from './lib/stores/sidebar.svelte'
  import ButtonToggleMenu from './lib/components/layout/ButtonToggleMenu.svelte'
  import ToastsWrapper from './lib/components/ToastsWrapper.svelte'
  import { settingsState } from './lib/stores/settingsStore.svelte'
  import { graphHistoryState } from './lib/stores/graphStack.svelte'
  import { viewModeState } from './lib/stores/viewModeStore.svelte'

  let isCoralMode = $derived(settingsState.isCoralMode)
  let viewMode = $derived(viewModeState.value)
  let executionLocation = $derived(settingsState.execution.location)
  let backendKind = $derived(settingsState.execution.backendKind)

  // Undo: Ctrl/Cmd+Z — Redo: Ctrl/Cmd+Shift+Z or Ctrl+Y
  // Skip when focus is inside a text field so normal editing shortcuts are unaffected.
  const handleKeyDown = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey
    if (!mod) return
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return
    const key = e.key.toLowerCase()
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault()
      graphHistoryState.undo()
    } else if ((key === 'z' && e.shiftKey) || key === 'y') {
      e.preventDefault()
      graphHistoryState.redo()
    }
  }

  let isExpanded = $derived(sideBarState.isExpanded)
  let sidebarWrapperElem = $state<HTMLDivElement>()
  let sidebarPositionHolderElem = $state<HTMLDivElement>()
  var style = window.getComputedStyle(document.body)
  const sidebarWrapperWidth = style.getPropertyValue('--sidebar-wrapper-width')
  $effect(() => {
    if (!sidebarWrapperElem || !sidebarPositionHolderElem) return

    if (isExpanded) {
      sidebarWrapperElem.style.position = 'static'
      sidebarWrapperElem.style.width = '25vw'
      sidebarPositionHolderElem.style.display = 'none'
    } else {
      sidebarWrapperElem.style.position = 'absolute'
      sidebarWrapperElem.style.width = sidebarWrapperWidth
      sidebarPositionHolderElem.style.display = 'block'
    }
  })
</script>

<svelte:window onkeydown={handleKeyDown} />

<main>
  <ToastsWrapper></ToastsWrapper>
  <SvelteFlowProvider>
    <div id="app-container">
      {#if isCoralMode && viewMode === 'single'}
        <ButtonToggleMenu />
        <div id="sidebar-wrapper" bind:this={sidebarWrapperElem}>
          <Sidebar />
        </div>
        <div
          id="sidebar-position-holder"
          bind:this={sidebarPositionHolderElem}
        ></div>
      {/if}
      <div id="sidebar-buttons-wrapper">
        <SidebarButtons />
      </div>
      <div class="main-content">
        <div class="top-left-overlay">
          <JobsTable />
        </div>
        <div class="top-right-overlay">
          <ExecutionBadge location={executionLocation} {backendKind} />
          <button
            class="view-toggle"
            onclick={() => viewModeState.toggle()}
            title={viewMode === 'pipeline'
              ? 'Open single stage view'
              : 'Go to pipeline view'}
          >
            {viewMode === 'pipeline' ? 'Single stage' : 'Pipeline'}
          </button>
          <ButtonToggleDarkMode />
        </div>
        <div class="flow-wrapper">
          {#if viewMode === 'pipeline'}
            <PipelineCanvas />
          {:else if isCoralMode}
            <FlowCanvas />
          {:else}
            <ParametersView />
          {/if}
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
    /* position: relative - makes it the anchor for the absolutely-positioned overlays. */
    position: relative;
    overflow: hidden;
  }

  .top-left-overlay {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 10;
    pointer-events: auto;
  }

  .top-right-overlay {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 10;
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1rem;
  }

  .flow-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .view-toggle {
    background: var(--primary-color);
    color: var(--ternary-color);
    border: 1px solid var(--ternary-color);
    border-radius: 8px;
    padding: 0.4rem 0.7rem;
    font-size: 0.8rem;
    font-weight: bold;
    cursor: pointer;
  }

  .view-toggle:hover {
    border-color: var(--border-color-hover);
  }
</style>
