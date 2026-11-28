<script lang="ts">
  import Button from './Button.svelte'
  import Modal, { getModal } from './Modal.svelte'
  import { workflowService } from '../../stores/workflowService.svelte'
  import type {
    WorkflowEntry,
    WorkflowDocument,
    WorkflowLocation,
    WorkflowSource,
  } from '../../types/executionService'

  const modalId = 'workflow-archive-modal'
  let mode = $state<'open' | 'save'>('open')
  let locations = $state<WorkflowLocation[]>([])
  let location = $state('')
  let name = $state('')
  let entries = $state<WorkflowEntry[]>([])
  let pending = $state(false)
  let error = $state('')
  let digest = ''
  let sequence = 0
  let source: WorkflowSource | undefined

  let {
    onOpen,
    onSave,
    getNetwork,
  }: {
    onOpen: (
      _network: WorkflowDocument,
      _source: WorkflowSource
    ) => Promise<void>
    onSave: (_source: WorkflowSource) => void
    getNetwork: () => WorkflowDocument
  } = $props()

  export function open(
    action: 'open' | 'save',
    defaultName: string,
    current?: WorkflowSource
  ) {
    const archive = workflowService.archive
    if (!archive) return
    sequence++
    mode = action
    digest = archive.configuration_digest
    source = current?.configuration_digest === digest ? current : undefined
    locations = archive.locations.filter(
      (item) => action === 'open' || item.writable
    )
    location =
      locations.find((item) => item.id === source?.location_id)?.id ??
      locations[0]?.id ??
      ''
    name = action === 'save' ? (source?.name ?? defaultName) : ''
    pending = false
    error = ''
    entries = []
    getModal(modalId)?.open()
    if (mode === 'open') void loadEntries()
  }

  async function loadEntries() {
    const request = ++sequence
    pending = true
    error = ''
    entries = []
    name = ''
    try {
      const result = await workflowService.listWorkflows(location, digest)
      if (request === sequence) entries = result
    } catch (reason) {
      if (request === sequence)
        error = reason instanceof Error ? reason.message : String(reason)
    } finally {
      if (request === sequence) pending = false
    }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    if (pending || !location || !name) return
    const request = ++sequence
    pending = true
    error = ''
    try {
      if (mode === 'open') {
        const result = await workflowService.readWorkflow(
          location,
          digest,
          name
        )
        if (request === sequence) await onOpen(result.network, result.source)
      } else {
        const filename = name.endsWith('.json') ? name : name + '.json'
        const expected =
          source?.location_id === location && source.name === filename
            ? source.revision
            : null
        const saved = await workflowService.writeWorkflow(
          location,
          digest,
          filename,
          getNetwork(),
          expected
        )
        if (request === sequence) onSave(saved)
      }
      if (request === sequence) getModal(modalId)?.close()
    } catch (reason) {
      if (request === sequence)
        error = reason instanceof Error ? reason.message : String(reason)
    } finally {
      if (request === sequence) pending = false
    }
  }
</script>

<Modal
  id={modalId}
  size="sm"
  closeOnBackdrop={false}
  onClose={() => {
    sequence++
  }}
>
  <form class="archive" onsubmit={submit}>
    <h2>{mode === 'open' ? 'Import Remote Graph' : 'Save Remote Graph'}</h2>
    <label>
      Collection
      <select
        bind:value={location}
        disabled={pending}
        onchange={() => {
          if (mode === 'open') void loadEntries()
        }}
      >
        {#each locations as item (item.id)}
          <option value={item.id}>{item.label}</option>
        {/each}
      </select>
    </label>
    {#if mode === 'open'}
      <label>
        Workflow
        <select
          size="6"
          bind:value={name}
          disabled={pending || !entries.length}
        >
          {#each entries as entry (entry.name)}
            <option value={entry.name}>{entry.name}</option>
          {/each}
        </select>
      </label>
      {#if !pending && !error && !entries.length}
        <p>No workflow files in this collection.</p>
      {/if}
    {:else}
      <label>
        File name
        <input bind:value={name} maxlength="128" required disabled={pending} />
      </label>
    {/if}
    {#if error}
      <p role="alert">{error}</p>
    {/if}
    <div class="archive-actions">
      <Button
        type="button"
        onclick={() => getModal(modalId)?.close()}
        disabled={pending}>Cancel</Button
      >
      <Button
        type="submit"
        variant="action"
        disabled={pending || !name || !location}
      >
        {mode === 'open' ? 'Open' : 'Save'}
      </Button>
    </div>
  </form>
</Modal>

<style>
  .archive {
    display: grid;
    gap: 1rem;
    padding: 1rem;
  }

  .archive label {
    display: grid;
    gap: 0.35rem;
  }

  .archive select,
  .archive input {
    width: 100%;
    padding: 0.4rem;
    color: inherit;
    background: var(--background-color);
  }

  .archive-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
