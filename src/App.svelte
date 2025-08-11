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
      <div class="app-container">
        <div class="sidebar-wrapper">
          <Sidebar />
        </div>
        <!-- TODO: set min-width and width as parameters here and in .sidebar-wrapper -->
        <!-- this element takes same space of sidebar with absolute positioning  -->
        <div style="min-width: 50px; width: 3vw;"></div>
        <div class="sidebar-buttons-wrapper">
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
  .app-container {
    height: 100vh;
    width: 100vw;
    display: flex;
    flex-direction: row;
  }
  .sidebar-wrapper {
    position: absolute;
    left: 0;
    top: 0;
    z-index: 100;
    cursor: pointer;
    min-width: 50px;
    width: 3vw; /* Set a fixed collapsed width */
    transition: width 0.4s 0.1s ease-in-out;
  }

  .sidebar-wrapper:hover {
    width: 25vw; /* Set expanded width */
  }

  .sidebar-buttons-wrapper {
    flex: 1; /* Takes 1 part of the remaining space */
    max-width: 80px;
  }

  .flow-wrapper {
    flex: 12; /* Takes 12 parts of the remaining space */
    height: 100vh;
  }
</style>
