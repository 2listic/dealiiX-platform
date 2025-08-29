<script>
  import { settinigsState, SSH_PATH } from '../stores/settingsStore.svelte'
  import { getModal } from './layout/Modal.svelte'

  let { modalId } = $props()

  let sshPath = $state(settinigsState.getKey(SSH_PATH))
  let formElement

  const validateAndSave = async () => {
    if (formElement.checkValidity()) {
      settinigsState.setKey(SSH_PATH, sshPath)
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
        <label for="ssh-path">Absolute path to the local private SSH key</label>
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
