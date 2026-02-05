<script lang="ts">
  import Modal, { getModal } from './Modal.svelte'
  import Button from './Button.svelte'

  interface Props {
    modalId: string
    statusMap: Map<number, string[]>
    title?: string
    onClose?: () => void
  }

  let {
    modalId,
    statusMap,
    title = 'Nodes Execution Status',
    onClose,
  }: Props = $props()

  const getDisplayStatus = (statuses: string[]): string => {
    if (statuses.includes('failed')) return 'failed'
    if (statuses.includes('succeeded')) return 'succeeded'
    if (statuses.includes('running')) return 'running'
    return 'unknown'
  }

  const handleClose = () => {
    onClose?.()
    getModal(modalId).close()
  }
</script>

<Modal id={modalId} size="sm">
  <div class="status-modal">
    <h2>{title}</h2>
    <div class="status-list">
      {#each statusMap as [nodeId, statuses] (nodeId)}
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
