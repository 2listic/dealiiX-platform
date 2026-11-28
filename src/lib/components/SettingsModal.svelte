<script lang="ts">
  import { confirmAction } from '../stores/confirmation.svelte'
  import { frontendSettingsState } from '../stores/frontendSettings.svelte'
  import { graphStackState } from '../stores/graphStack.svelte'
  import { getNodesSnapshot } from '../stores/nodes.svelte'
  import { toastState } from '../stores/toastsStore.svelte'
  import { workflowService } from '../stores/workflowService.svelte'
  import type { ParameterTree } from '../types/parameterTypes'
  import type { SettingsDraft, SettingsTarget } from '../types/settingsFile'
  import ParametersView from './ParametersView.svelte'
  import Button from './layout/Button.svelte'
  import Modal, { getModal } from './layout/Modal.svelte'

  let { modalId, scope }: { modalId: string; scope: 'backend' | 'frontend' } =
    $props()
  const title = $derived(
    scope === 'backend' ? 'Backend Settings' : 'Frontend Settings'
  )
  let parameters = $state<ParameterTree>()
  let backendRevision = ''
  let importedTarget: SettingsTarget | undefined
  let published = false
  let busy = $state(false)
  let error = $state('')

  export async function open(draft?: SettingsDraft) {
    if (busy) return
    getModal(modalId)?.open()
    await loadConfiguration()
    if (draft && parameters) applyDraft(draft)
  }

  async function loadConfiguration() {
    parameters = undefined
    importedTarget = undefined
    error = ''
    busy = true
    try {
      if (scope === 'frontend') {
        parameters = await frontendSettingsState.getConfiguration()
      } else if (!workflowService.enabled) {
        error = 'Select a root backend in Frontend Settings.'
      } else {
        const supported = workflowService.getConfiguration()
        if (supported) {
          parameters = supported.parameters
          backendRevision = supported.digest
          published = true
        } else {
          const profile = await window.electron.workflow.readConfiguration()
          parameters = profile.parameters
          backendRevision = profile.revision
          published = false
        }
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause)
    } finally {
      busy = false
    }
  }

  async function saveConfiguration() {
    if (!parameters || busy) return
    busy = true
    error = ''
    try {
      const draft = $state.snapshot(parameters)
      if (scope === 'frontend') {
        if (
          frontendSettingsState.changesBackend(draft) &&
          (getNodesSnapshot().length || graphStackState.canGoBack)
        ) {
          if (
            !(await confirmAction({
              title: 'Switch root backend?',
              message:
                'The current graph will close when the new root backend is ready.',
              confirmText: 'Switch backend',
              cancelText: 'Keep editing',
              confirmVariant: 'action',
            }))
          )
            return
        }
        await frontendSettingsState.save(draft)
      } else if (published) {
        await workflowService.configure(draft, backendRevision, importedTarget)
      } else {
        const registry = await window.electron.workflow.saveConfiguration(
          draft,
          backendRevision,
          importedTarget
        )
        workflowService.adoptBackend(registry, false)
      }
      getModal(modalId)?.close()
      toastState.add({
        message:
          scope === 'backend'
            ? 'Backend configuration saved'
            : 'Frontend settings saved',
        type: 'success',
      })
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause)
    } finally {
      busy = false
    }
  }

  function applyDraft(draft: SettingsDraft) {
    parameters = draft.parameters
    importedTarget = draft.target
  }

  async function importConfiguration() {
    if (!parameters || busy) return
    error = ''
    busy = true
    try {
      if (scope === 'backend') {
        const draft = await window.electron.workflow.importConfiguration()
        if (draft) applyDraft(draft)
      } else {
        const configuration =
          await window.electron.frontendSettings.importConfiguration()
        if (configuration) applyDraft({ parameters: configuration })
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause)
    } finally {
      busy = false
    }
  }
</script>

<Modal id={modalId} size={parameters ? 'lg' : 'md'} closeOnBackdrop={!busy}>
  <h2>{title}</h2>
  {#if parameters}
    <fieldset disabled={busy}>
      <ParametersView
        {parameters}
        onChange={(draft) => (parameters = draft)}
        onEdit={() => {}}
      />
    </fieldset>
  {/if}
  {#if error}
    <p role="alert">{error}</p>
  {:else if busy && !parameters}
    <p role="status">Loading settings…</p>
  {/if}
  <div class="actions">
    <Button onclick={() => getModal(modalId)?.close()} disabled={busy}
      >Close</Button
    >
    {#if parameters}
      <Button onclick={importConfiguration} disabled={busy}
        >Import from file</Button
      >
      <Button variant="action" onclick={saveConfiguration} disabled={busy}
        >Save</Button
      >
    {/if}
  </div>
</Modal>

<style>
  fieldset {
    border: 0;
    min-width: 0;
    padding: 0;
    margin: 0;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1rem;
  }
</style>
