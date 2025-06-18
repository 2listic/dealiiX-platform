<script>

  import svelteLogo from './assets/svelte.svg'
  import viteLogo from '/vite.svg'
  import Counter from './lib/components/Counter.svelte'
  import FlowCanvas from './lib/components/FlowCanvas.svelte';
  import { SvelteFlowProvider } from '@xyflow/svelte';
  import { executeSSHCommandWithPassword, connectToSSH } from './lib/utils/ssh.js';
</script>

<main>
  <div>
    <a href="https://vite.dev" target="_blank" rel="noreferrer">
      <img src={viteLogo} class="logo" alt="Vite Logo" />
    </a>
    <a href="https://svelte.dev" target="_blank" rel="noreferrer">
      <img src={svelteLogo} class="logo svelte" alt="Svelte Logo" />
    </a>
  </div>
  <h1>Vite + Svelte + Flow</h1>

  <div class="card">
    <Counter />
    <button onclick={executeSSHCommandWithPassword}>Execute SSH Command with password</button>
    <button onclick={connectToSSH}>Connect to SSH with key</button>
  </div>

  <SvelteFlowProvider>
    <div style:width="100vw" style:height="50vh">
      <FlowCanvas />
    </div>
  </SvelteFlowProvider>
</main>

<style>
  .logo {
    height: 6em;
    padding: 1.5em;
    will-change: filter;
    transition: filter 300ms;
  }
  .logo:hover {
    filter: drop-shadow(0 0 2em #646cffaa);
  }
  .logo.svelte:hover {
    filter: drop-shadow(0 0 2em #ff3e00aa);
  }
  .read-the-docs {
    color: #888;
  }
</style>
