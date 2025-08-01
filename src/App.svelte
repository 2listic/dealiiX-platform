<script>
  import { SvelteFlowProvider } from '@xyflow/svelte'
  import FlowCanvas from './lib/components/FlowCanvas.svelte'
  import DnDProvider from './lib/components/DnDProvider.svelte'
  import Sidebar from './lib/components/layout/Sidebar.svelte'
  import SidebarButtons from './lib/components/layout/SidebarButtons.svelte'
</script>

<main>
  <SvelteFlowProvider>
    <DnDProvider>
      <div class="flow-container">
        <div class="sidebar-buttons-wrapper">
          <SidebarButtons />
        </div>
        <div class="sidebar-wrapper">
          <Sidebar />
        </div>
        <div class="flow-wrapper">
          <FlowCanvas />
        </div>
      </div>
    </DnDProvider>
  </SvelteFlowProvider>
</main>

<style>
  .flow-container {
    display: flex;
    flex-direction: row;
    height: 100vh;
    width: 100vw;
  }

  .sidebar-buttons-wrapper {
    flex: 1; /* Takes 1 part of the remaining space */
    max-width: 80px;
  }

  .sidebar-wrapper {
    cursor: pointer;
    min-width: 50px;
    width: 3vw; /* Set a fixed collapsed width */
    transition: width 0.8s 0.3s ease-in-out;
  }

  .sidebar-wrapper:hover {
    width: 30vw; /* Set expanded width */
  }

  .flow-wrapper {
    flex: 12; /* Takes 12 parts of the remaining space */
    min-height: 0; /* Allows flex item to shrink below content size */
    height: 100vh;
  }
</style>
