<script>
  import { SvelteFlowProvider } from '@xyflow/svelte'
  import FlowCanvas from './lib/components/FlowCanvas.svelte'
  import DnDProvider from './lib/components/DnDProvider.svelte'
</script>

<main>
  <SvelteFlowProvider>
    <div style:width="100vw" style:height="100vh">
      <DnDProvider>
        <FlowCanvas />
      </DnDProvider>
    </div>
  </SvelteFlowProvider>
</main>