<script>
// @ts-nocheck

  import svelteLogo from './assets/svelte.svg'
  import viteLogo from '/vite.svg'
  import Counter from './lib/Counter.svelte'
  import Flow from './lib/Flow.svelte'
  
  // import { onMount } from 'svelte';
  
  const executeSSHCommandWithPassword = async () => {
    // @ts-ignore
    const result = await window.electron.invoke('execute-ssh-command-with-password', {
      host: 'localhost',
      username: 'root',
      password: 'root',
      command: 'echo "Hello from Electron!"'
    });
    console.log('SSH Command Result:', result);
  }

  const connectToSSH = async () => {
    // @ts-ignore
    const result = await window.electron.invoke('connect-ssh');
    console.log('SSH Connection Result:', result);
  }
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
    <button on:click={executeSSHCommandWithPassword}>Execute SSH Command with password</button>
    <button on:click={connectToSSH}>Connect to SSH with key</button>
  </div>

  <Flow />
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
