<script lang="ts">
  import Modal, { getModal } from './Modal.svelte'
  import Button from './Button.svelte'
  import { getNodesExecutionStatus } from '../../utils/sshMessages'

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

  const getDisplayStatus = (statuses: string[]): string => {
    if (statuses.includes('failed')) return 'failed'
    if (statuses.includes('succeeded')) return 'succeeded'
    if (statuses.includes('running')) return 'running'
    return 'unknown'
  }

  // Check if all nodes have a terminal status (succeeded or failed)
  const allNodesTerminal = $derived.by(() => {
    console.log('allNodesTerminal', $state.snapshot(internalStatusMap))
    if (internalStatusMap.size === 0) return false
    for (const statuses of internalStatusMap.values()) {
      const status = getDisplayStatus(statuses)
      if (status !== 'succeeded' && status !== 'failed') {
        return false
      }
    }
    return true
  })

  // Polling effect - stops when all nodes are terminal or modal closes
  // effect runs when modal component is mounted and when reactive dependencies jobIdInternal or allNodesTerminal changes
  $effect(() => {
    console.log('Polling effect', jobIdInternal, allNodesTerminal)
    // early return if jobIdInternal is not set or all nodes have terminal status
    if (jobIdInternal === undefined || allNodesTerminal) return

    const interval = setInterval(async () => {
      try {
        console.log('Polling for job status', jobIdInternal)
        const result = await getNodesExecutionStatus(jobIdInternal)
        console.log('Polling result', $state.snapshot(result))
        internalStatusMap = result
        console.log('internalStatusMap', $state.snapshot(internalStatusMap))
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 5000)

    // cleanup function (stopping polling) called when the effect re-runs and when modal component is destroyed
    return () => clearInterval(interval)
  })

  const handleClose = () => {
    onClose?.()
    getModal(modalId).close()
  }
</script>

<Modal id={modalId} size="sm">
  <div class="status-modal">
    <h2>{title}</h2>
    <div class="status-list">
      {#each internalStatusMap as [nodeId, statuses] (nodeId)}
        <div class="status-row">
          <span>{nodeId}</span>
          <span class:failed={getDisplayStatus(statuses) === 'failed'}>
            {getDisplayStatus(statuses)}
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
  .actions {
    display: flex;
    justify-content: center;
    margin-top: 1vh;
  }
  .failed {
    color: #ff4444;
  }
</style>
