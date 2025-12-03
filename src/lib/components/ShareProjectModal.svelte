<script lang="ts">
  import { searchUsers, shareProject } from '../requests/projects'
  import { toastState } from '../stores/toastsStore.svelte'
  import Button from './layout/Button.svelte'
  import Modal, { getModal } from './layout/Modal.svelte'

  interface User {
    id: number
    username: string
    email: string
  }

  interface Props {
    projectId: number
    projectName: string
    modalId: string
    getAlreadySharedUserIds: () => number[]
    onShare: () => void
  }

  let {
    projectId,
    projectName,
    modalId,
    getAlreadySharedUserIds,
    onShare,
  }: Props = $props()

  let availableUsers = $state<User[]>([])
  let selectedUserId = $state<number | null>(null)
  let selectedPermission = $state<string>('read')
  let loadingUsers = $state(false)

  export const open = async () => {
    getModal(modalId)?.open()
    await fetchUsers()
  }

  const fetchUsers = async () => {
    loadingUsers = true
    try {
      const response = await searchUsers()
      availableUsers = response.users || []

      // Filter out users who already have access
      const sharedUserIds = getAlreadySharedUserIds()
      const sharedUserIdsSet = new Set(sharedUserIds)
      availableUsers = availableUsers.filter(
        (user) => !sharedUserIdsSet.has(user.id)
      )
    } catch (error) {
      console.error('Error fetching users:', error)
      toastState.add({
        message: error.message || 'Failed to fetch users',
        type: 'error',
      })
    } finally {
      loadingUsers = false
    }
  }

  const handleShare = async () => {
    if (!selectedUserId) {
      toastState.add({
        message: 'Please select a user to share with',
        type: 'error',
      })
      return
    }

    try {
      await shareProject(projectId, selectedUserId, selectedPermission)
      getModal(modalId)?.close()
      toastState.add({
        message: 'Project shared successfully',
        type: 'success',
      })
      selectedUserId = null
      selectedPermission = 'read'
      onShare()
    } catch (error) {
      console.error('Error sharing project:', error)
      toastState.add({
        message: error.message || 'Failed to share project',
        type: 'error',
      })
    }
  }

  const handleCancel = () => {
    getModal(modalId)?.close()
    selectedUserId = null
    selectedPermission = 'read'
  }
</script>

<Modal id={modalId} closeOnBackdrop={true} size="sm">
  <div class="share-modal">
    <h3>Share Project: {projectName}</h3>

    {#if loadingUsers}
      <p>Loading users...</p>
    {:else if availableUsers.length === 0}
      <p class="no-users">No users available to share with</p>
    {:else}
      <div class="form-group">
        <label for="user-select">Select User:</label>
        <select
          id="user-select"
          class="modal-select"
          bind:value={selectedUserId}
        >
          <option value={null}>-- Select a user --</option>
          {#each availableUsers as user (user.id)}
            <option value={user.id}>{user.username} ({user.email})</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label for="permission-select">Permission Level:</label>
        <select
          id="permission-select"
          class="modal-select"
          bind:value={selectedPermission}
        >
          <option value="read">Read</option>
          <option value="write">Write</option>
        </select>
      </div>

      <div class="modal-actions">
        <Button size="small" onclick={handleCancel}>Cancel</Button>
        <Button
          variant="action"
          size="small"
          onclick={handleShare}
          disabled={!selectedUserId}
        >
          Share Project
        </Button>
      </div>
    {/if}
  </div>
</Modal>

<style>
  .share-modal h3 {
    font-size: 1.1rem;
    margin-bottom: 1.5rem;
  }

  .no-users {
    margin: 1rem 0;
  }

  .form-group {
    margin-bottom: 1.5rem;
    text-align: left;
  }

  .form-group label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }

  .modal-select {
    padding: 0.5rem;
    border: 1px solid var(--ternary-color);
    border-radius: 4px;
    font-size: 0.9rem;
    cursor: pointer;
    width: 100%;
  }

  .modal-select:focus {
    outline: 2px solid var(--primary-color);
    outline-offset: 1px;
  }

  .modal-actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 1.5rem;
  }
</style>
