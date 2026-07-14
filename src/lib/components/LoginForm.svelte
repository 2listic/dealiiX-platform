<script lang="ts">
  import { login } from '../requests/authentication'
  import { toastState } from '../stores/toastsStore.svelte'
  import Button from './layout/Button.svelte'
  import { getModal } from './layout/Modal.svelte'

  let { modalId } = $props()

  let username = $state('')
  let password = $state('')
  let formElement: HTMLFormElement

  const validateAndSubmit = async () => {
    if (formElement.checkValidity()) {
      const data = { username, password }
      try {
        await login(data)
      } catch (error) {
        console.error('Login failed:', error)
        password = ''
        toastState.add({
          message: 'Login was not succesfull. Please try again',
          type: 'error',
        })
        return
      }
      getModal(modalId)?.close()
      toastState.add({ message: 'Logged in' })
    } else {
      formElement.reportValidity()
    }
  }
</script>

<div style="padding: 1rem">
  <form
    data-testid="login-form"
    bind:this={formElement}
    onsubmit={(event) => {
      event.preventDefault()
      validateAndSubmit()
    }}
  >
    <h2>Login</h2>
    <div class="inputs-container">
      <div class="input-container">
        <label for="login-username">Username</label>
        <input
          id="login-username"
          class="input-field"
          type="text"
          bind:value={username}
          placeholder="Enter your Username"
          required
        />
      </div>
      <div class="input-container">
        <label for="login-password">Password</label>
        <input
          id="login-password"
          class="input-field"
          type="password"
          bind:value={password}
          placeholder="Password"
          minlength="6"
          required
        />
      </div>
    </div>
    <div class="button-container">
      <Button variant="action" type="submit">Submit</Button>
    </div>
  </form>
</div>

<style>
  h2 {
    margin: 0 0 1.5rem 0;
    text-align: center;
  }

  .inputs-container {
    display: flex;
    flex-direction: row;
    gap: 2vh;
    padding: 1vh 0;
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
</style>
