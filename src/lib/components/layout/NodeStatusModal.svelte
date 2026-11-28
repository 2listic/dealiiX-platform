<script lang="ts">
  import Modal, { getModal } from './Modal.svelte'
  import Button from './Button.svelte'
  import SuccessIcon from '../icons/SuccessIcon.svelte'
  import ErrorIcon from '../icons/ErrorIcon.svelte'
  import { ExecNodeStatus } from '../../types/jobTypes'

  interface Props {
    modalId: string
    statusMap: Map<string, string[]>
    isJobTerminal?: boolean
    title?: string
    onClose?: () => void
  }

  let {
    modalId,
    statusMap,
    isJobTerminal = false,
    title = 'Nodes Execution Status',
    onClose,
  }: Props = $props()

  const StatusToDisplay = {
    [ExecNodeStatus.FAILED]: 'Failed',
    [ExecNodeStatus.SUCCEEDED]: 'Succeeded',
    [ExecNodeStatus.RUNNING]: 'running...',
    UNKNOWN: 'unknown',
  } as const

  const getDisplayStatus = (statuses: string[]): string => {
    if (statuses.includes(ExecNodeStatus.FAILED))
      return StatusToDisplay[ExecNodeStatus.FAILED]
    if (statuses.includes(ExecNodeStatus.SUCCEEDED))
      return StatusToDisplay[ExecNodeStatus.SUCCEEDED]
    if (statuses.includes(ExecNodeStatus.RUNNING))
      return StatusToDisplay[ExecNodeStatus.RUNNING]
    return StatusToDisplay.UNKNOWN
  }

  // Split qualified Id over underscore to get array of Ids
  const formatNodeId = (nodeId: string): string[] => {
    return nodeId.split('_')
  }

  // Check if at least one node has failed
  const anyNodeFailed = $derived.by(() => {
    if (statusMap.size === 0) return false
    for (const statuses of statusMap.values()) {
      const status = getDisplayStatus(statuses)
      if (status === StatusToDisplay[ExecNodeStatus.FAILED]) {
        return true
      }
    }
    return false
  })

  const handleClose = () => {
    getModal(modalId)?.close()
  }
</script>

<Modal id={modalId} size="sm" {onClose}>
  <div class="status-modal">
    <h2>{title}</h2>
    <div class="status-list">
      {#each statusMap as [nodeId, statuses] (nodeId)}
        {@const displayStatus = getDisplayStatus(statuses)}
        {@const idParts = formatNodeId(nodeId)}
        <div class="status-row">
          <span class="node-id">
            {#each idParts as part, i (i)}
              <span class="id-part">{part}</span>
              {#if i < idParts.length - 1}
                <span class="id-separator">→</span>
              {/if}
            {/each}
          </span>
          {#if !(displayStatus === StatusToDisplay[ExecNodeStatus.RUNNING] && anyNodeFailed)}
            <span
              class="status-badge"
              class:failed={displayStatus ===
                StatusToDisplay[ExecNodeStatus.FAILED]}
              class:running={displayStatus ===
                StatusToDisplay[ExecNodeStatus.RUNNING]}
            >
              {#if displayStatus === StatusToDisplay[ExecNodeStatus.SUCCEEDED]}
                <SuccessIcon width="16px" />
              {:else if displayStatus === StatusToDisplay[ExecNodeStatus.FAILED]}
                <ErrorIcon width="16px" />
              {/if}
              {displayStatus}
            </span>
          {/if}
        </div>
      {:else}
        <div class="empty-state">
          <div class="empty-state-copy">
            {#if isJobTerminal}
              <strong>No node ever started</strong>
            {:else}
              <strong>No nodes have reported yet</strong>
            {/if}
          </div>
        </div>
      {/each}
    </div>
    <div class="actions">
      <Button size="small" onclick={handleClose}>Close</Button>
    </div>
  </div>
</Modal>

<style>
  .status-modal {
    padding: 1vh;
  }
  .status-modal h2 {
    margin: 0 0 1vh 0;
    text-align: center;
  }
  .status-list {
    max-height: 50vh;
    overflow-y: auto;
    padding: 0 4vh;
  }
  .status-row {
    display: flex;
    justify-content: space-between;
    padding: 0.3vh 0.5vh;
    border-bottom: 1px solid var(--border-color);
  }
  .node-id {
    display: flex;
    align-items: center;
    gap: 0.5em;
  }
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2vh 0;
  }
  .empty-state-copy {
    max-width: 28rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }
  /* .id-part {
    font-weight: 500;
  }
  .id-separator {
    font-size: 0.9em;
    padding: 0 0.1em;
  } */
  .status-badge {
    display: flex;
    align-items: center;
    gap: 0.4em;
  }
  .failed {
    color: var(--button-delete-bg);
  }
  .running {
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
  .actions {
    display: flex;
    justify-content: center;
    margin-top: 1vh;
  }
</style>
