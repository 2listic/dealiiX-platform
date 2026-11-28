<script lang="ts">
  import { toastState } from '../stores/toastsStore.svelte'
  import { workflowService } from '../stores/workflowService.svelte'
  import ParametersView from './ParametersView.svelte'
  import Button from './layout/Button.svelte'
  import Modal, { getModal } from './layout/Modal.svelte'

  let { modalId }: { modalId: string } = $props()
  let configuration =
    $state<ReturnType<typeof workflowService.getConfiguration>>()
  let busy = $state(false)

  export async function open() {
    if (busy) return
    configuration = workflowService.getConfiguration()
    getModal(modalId)?.open()
    if (workflowService.enabled && !configuration) await openProfile()
  }

  async function openProfile() {
    try {
      busy = true
      await window.electron.workflow.openConfiguration()
    } catch (error) {
      showError(error)
    } finally {
      busy = false
    }
  }

  async function syncRegistry() {
    try {
      busy = true
      await workflowService.refreshRegistry()
      configuration = workflowService.getConfiguration()
      toastState.add({ message: 'Backend registry synced', type: 'success' })
    } catch (error) {
      showError(error)
    } finally {
      busy = false
    }
  }

  async function saveConfiguration() {
    if (!configuration) return
    try {
      busy = true
      await workflowService.configure(
        $state.snapshot(configuration.parameters),
        configuration.digest
      )
      getModal(modalId)?.close()
      toastState.add({
        message: 'Backend configuration saved',
        type: 'success',
      })
    } catch (error) {
      showError(error)
    } finally {
      busy = false
    }
  }

  function showError(error: unknown) {
    toastState.add({
      message: error instanceof Error ? error.message : String(error),
      type: 'error',
    })
  }
</script>

<Modal id={modalId} size={configuration ? 'lg' : 'md'}>
  <h2>Backend configuration</h2>
  {#if configuration}
    {@const draft = configuration}
    <ParametersView
      parameters={draft.parameters}
      onChange={(parameters) => (draft.parameters = parameters)}
      onEdit={() => {}}
    />
    <div class="actions">
      <Button onclick={syncRegistry} disabled={busy}>Reload</Button>
      <Button variant="action" onclick={saveConfiguration} disabled={busy}
        >Save</Button
      >
    </div>
  {:else if workflowService.enabled}
    <p>After saving the backend profile, refresh the editor’s registry.</p>
    <div class="actions">
      <Button onclick={openProfile} disabled={busy}>Open profile</Button>
      <Button variant="action" onclick={syncRegistry} disabled={busy}>
        Validate &amp; Sync
      </Button>
    </div>
  {:else}
    <p>Launch the desktop with a backend command and configuration profile.</p>
  {/if}
</Modal>

<style>
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1rem;
  }
</style>
