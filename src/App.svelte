<script>
  import Counter from './lib/components/Counter.svelte'
  import FlowCanvas from './lib/components/FlowCanvas.svelte';
  import { SvelteFlowProvider } from '@xyflow/svelte';
  import { executeSSHCommandWithPassword, connectToSSH } from './lib/utils/ssh.js';
</script>

<main>
  <h1 style="text-align: center">Electron + Vite + Svelte + Flow</h1>

  <div class="card">
    <Counter />
    <button onclick={executeSSHCommandWithPassword}>Execute SSH Command with password</button>
    <button onclick={connectToSSH}>Connect to SSH with key</button>
  </div>

  <SvelteFlowProvider>
    <div style:width="100vw" style:height="70vh">
      <FlowCanvas />
    </div>
  </SvelteFlowProvider>
</main>