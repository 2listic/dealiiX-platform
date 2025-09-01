<script>
  import { fade } from 'svelte/transition'
  import CloseIcon from './icons/CloseIcon.svelte'
  import ErrorIcon from './icons/ErrorIcon.svelte'
  import InfoIcon from './icons/InfoIcon.svelte'
  import SuccessIcon from './icons/SuccessIcon.svelte'

  let { type = 'error', dismissible = true, dismiss, message } = $props()
</script>

<article class={type} role="alert" transition:fade>
  <div style="width: 2rem">
    {#if type === 'success'}
      <SuccessIcon width="2rem" />
    {:else if type === 'error'}
      <ErrorIcon width="2rem" />
    {:else}
      <InfoIcon width="2rem" />
    {/if}
  </div>

  <div>
    {message}
  </div>

  {#if dismissible}
    <button class="close" onclick={() => dismiss()}>
      <CloseIcon width="0.8em" />
    </button>
  {/if}
</article>

<style>
  article {
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 0.2rem;
    display: flex;
    gap: 1.5rem;
    align-items: center;
    margin: 0 auto 0.5rem auto;
    width: 20rem;
  }
  .error {
    background: IndianRed;
  }
  .success {
    background: MediumSeaGreen;
  }
  .info {
    background: SkyBlue;
  }
  button {
    color: white;
    background: transparent;
    border: 0 none;
    padding: 0;
    margin: 0 0 0 auto;
    line-height: 1;
    font-size: 1rem;
    cursor: pointer;
  }
</style>
