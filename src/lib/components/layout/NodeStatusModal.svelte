<script lang="ts">
  import Modal, { getModal } from './Modal.svelte'
  import Button from './Button.svelte'
  import SuccessIcon from '../icons/SuccessIcon.svelte'
  import ErrorIcon from '../icons/ErrorIcon.svelte'
  import { getNodesExecutionStatus } from '../../utils/sshMessages'
  import { ExecNodeStatus } from '../../types/executionStatus'

  interface Props {
    modalId: string
    statusMap: Map<number, string[]>
    jobIdInternal: number | undefined
    title?: string
    onClose?: () => void
  }

  let {
    modalId,
    statusMap,
    jobIdInternal,
    title = 'Nodes Execution Status',
    onClose,
  }: Props = $props()

  // Internal state for polling updates
  let internalStatusMap = $state(new Map<number, string[]>())

  // Sync internal state when prop changes (only when modal opens with new data)
  $effect(() => {
    if (statusMap.size > 0) {
      internalStatusMap = new Map(statusMap) // shallow copy to update indipendently from parent prop
    }
  })

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

  // Check if all nodes have a terminal status (succeeded or failed)
  const allNodesTerminal = $derived.by(() => {
    if (internalStatusMap.size === 0) return false
    for (const statuses of internalStatusMap.values()) {
      const status = getDisplayStatus(statuses)
      if (
        status !== StatusToDisplay[ExecNodeStatus.SUCCEEDED] &&
        status !== StatusToDisplay[ExecNodeStatus.FAILED]
      ) {
        return false
      }
    }
    return true
  })

  // Polling effect - stops when all nodes are terminal or modal closes
  // effect runs when modal component is mounted and when reactive dependencies jobIdInternal or allNodesTerminal changes
  $effect(() => {
    console.log(
      'Internal jobId',
      jobIdInternal,
      'are all nodes terminal?',
      allNodesTerminal
    )
    // early return if jobIdInternal is not set or all nodes have terminal status
    if (jobIdInternal === undefined || allNodesTerminal) return

    const interval = setInterval(async () => {
      try {
        console.log('Polling for internal jobId', jobIdInternal)
        const result = await getNodesExecutionStatus(jobIdInternal)
        console.log('Polling result', $state.snapshot(result))
        internalStatusMap = result
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 5000)

    // cleanup function (stopping polling) called when the effect re-runs and when modal component is destroyed
    return () => clearInterval(interval)
  })

  const handleClose = () => {
    getModal(modalId).close()
  }
</script>

<Modal id={modalId} size="sm" {onClose}>
  <div class="status-modal">
    <h2>{title}</h2>
    <div class="status-list">
      {#each internalStatusMap as [nodeId, statuses] (nodeId)}
        {@const displayStatus = getDisplayStatus(statuses)}
        <div class="status-row">
          <span>{nodeId}</span>
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
    border-bottom: 1px solid #333;
  }
  .status-badge {
    display: flex;
    align-items: center;
    gap: 0.4em;
  }
  .failed {
    color: #ff4444;
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
