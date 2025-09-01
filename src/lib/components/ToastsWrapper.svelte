<script lang="ts">
  import Toast from './Toast.svelte'

  import { toastState } from '../stores/toastsStore.svelte'

  let toasts = $derived(toastState.current)
</script>

{#if toasts}
  <section>
    {#each toasts as toast (toast.id)}
      <Toast
        type={toast.type}
        dismissible={toast.dismissible}
        dismiss={() => toastState.dismiss(toast.id)}
        message={toast.message}
      ></Toast>
    {/each}
  </section>
{/if}

<style>
  section {
    position: fixed;
    top: 0;
    left: 30%;
    width: 40%;
    display: flex;
    margin-top: 1rem;
    justify-content: center;
    flex-direction: column;
    z-index: 9999;
  }
</style>
