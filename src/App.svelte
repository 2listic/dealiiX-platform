<script>
  import { SvelteFlowProvider } from '@xyflow/svelte'
  import FlowCanvas from './lib/components/FlowCanvas.svelte'
  import DnDProvider from './lib/components/DnDProvider.svelte'
</script>

<main>
  <SvelteFlowProvider>
    <DnDProvider>
      <FlowCanvas />
    </DnDProvider>
  </SvelteFlowProvider>
</main>
