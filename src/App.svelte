<script>
  import { SvelteFlowProvider } from '@xyflow/svelte'
  import FlowCanvas from './lib/components/FlowCanvas.svelte'
  import DnDProvider from './lib/components/DnDProvider.svelte'
  import Sidebar from './lib/components/layout/Sidebar.svelte'
</script>

<main>
  <SvelteFlowProvider>
    <DnDProvider>
      <div class="flow-container">
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
  }

  .sidebar-wrapper {
    flex: 1; /* Takes 1 part of the remaining space */
  }
  .flow-wrapper {
    flex: 4; /* Takes 4 parts of the remaining space */
    min-height: 0; /* Allows flex item to shrink below content size */
    height: 100vh;
  }
</style>
