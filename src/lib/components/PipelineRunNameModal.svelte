<script lang="ts">
  import Modal, { getModal } from './layout/Modal.svelte'
  import Button from './layout/Button.svelte'

  interface Props {
    modalId: string
    /** Called with the trimmed (possibly empty) name when the user confirms. */
    onConfirm: (_name: string) => void
  }

  let { modalId, onConfirm }: Props = $props()

  let name = $state('')

  const handleConfirm = () => {
    // Capture before close(): Modal's onClose fires synchronously and resets `name`.
    const trimmedName = name.trim()
    getModal(modalId)?.close()
    onConfirm(trimmedName)
  }

  const handleCancel = () => {
    getModal(modalId)?.close()
  }
</script>

<Modal id={modalId} size="sm" onClose={() => (name = '')}>
  <form
    class="pipeline-run-name"
    onsubmit={(event) => {
      event.preventDefault()
      handleConfirm()
    }}
  >
    <h2>Run pipeline</h2>
    <div class="input-container">
      <label for="pipeline-run-name">Run name (optional)</label>
      <input
        id="pipeline-run-name"
        type="text"
        bind:value={name}
        class="input-field"
        placeholder="e.g. poisson-convergence"
      />
      <span class="hint-message">
        Used to name the run's output folder; left blank keeps the default
        timestamp name
      </span>
    </div>
    <div class="button-container">
      <Button type="button" size="small" onclick={handleCancel}>Cancel</Button>
      <Button type="submit" variant="action" size="small">Run</Button>
    </div>
  </form>
</Modal>

<style>
  .pipeline-run-name {
    padding: 1rem;
  }

  .pipeline-run-name h2 {
    margin: 0 0 1.5rem 0;
    text-align: center;
  }

  .input-container {
    display: flex;
    flex-direction: column;
    gap: 1vh;
  }

  .input-container label {
    font-weight: bold;
  }

  .input-field {
    padding: 1vh;
    border: 1px solid var(--ternary-color);
    border-radius: 8px;
    font-size: 1rem;
    background: var(--secondary-color);
  }

  .hint-message {
    color: var(--ternary-color);
  }

  .button-container {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 1.5rem;
  }
</style>
