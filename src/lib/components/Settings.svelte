<script>
  import { settinigsState, SSH_PATH } from '../stores/settingsStore.svelte'
  import { getModal } from './layout/Modal.svelte'

  let { modalId } = $props()

  let sshPath = $state()
  let errorMessage = $state()
  let formElement

  const validateAndSave = async () => {
    errorMessage = ''
    if (formElement.checkValidity()) {
      // const settingsData = { sshPath }
      // consider to remove try/catch logic if not needed here
      try {
        settinigsState.setKey(SSH_PATH, sshPath)
      } catch (error) {
        console.error('Saving failed:', error)
        errorMessage = 'Saving was not succesfull. Please try again'
        return
      }
      getModal(modalId).close()
    } else {
      formElement.reportValidity()
    }
  }
</script>

<div style="padding: 0 1rem">
  <form
    bind:this={formElement}
    onsubmit={(e) => {
      e.preventDefault()
      validateAndSave()
    }}
  >
    <h2>Settings</h2>
    <div class="inputs-container">
      <div class="input-container">
        <label for="ssh-path">Path to private ssh key</label>
        <input
          id="ssh-path"
          class="input-field"
          type="text"
          bind:value={sshPath}
          placeholder="SSH path"
          required
        />
      </div>
    </div>
    <div class="button-container">
      <button type="button" class="button-submit" onclick={validateAndSave}
        >Save</button
      >
    </div>
    <!-- delete this if not needed plus any related code -->
    <div class="error-message">{errorMessage}</div>
  </form>
</div>

<style>
  .inputs-container {
    display: flex;
    flex-direction: row;
    gap: 2vh;
  }

  .input-container {
    display: flex;
    flex-direction: column;
    gap: 1vh;
  }

  .button-container {
    margin-top: 2vh;
  }

  .input-field {
    padding: 1vh;
    border: 1px solid var(--ternary-color);
    border-radius: 8px;
    font-size: 1rem;
    background: var(--secondary-color);
  }

  .input-field:invalid {
    border-color: red;
  }

  .error-message {
    margin-top: 2vh;
    min-height: 25px;
  }

  .button-submit {
    cursor: pointer;
    border: 1px solid var(--ternary-color);
    border-radius: 8px;
    padding: 1vh;
    font-size: 1rem;
    background-color: var(--secondary-color);
  }

  .button-submit:hover {
    border-color: var(--border-color-hover);
  }
</style>
