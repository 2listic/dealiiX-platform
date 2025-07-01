<script>
  import FlowCanvas from './lib/components/FlowCanvas.svelte'
  import { SvelteFlowProvider } from '@xyflow/svelte'
</script>

<main>
  
  <div class="card">
    <h1 >Electron + Vite + Svelte + Flow</h1>
  </div>

  <SvelteFlowProvider>
    <div style:width="100vw" style:height="80vh">
      <FlowCanvas />
    </div>
  </SvelteFlowProvider>
</main>