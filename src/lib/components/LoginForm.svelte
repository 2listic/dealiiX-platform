<script>
  import { login } from '../requests/authentication'
  import { getModal } from './layout/Modal.svelte'

  let { modalId } = $props()

  let username = $state()
  let password = $state()
  let errorMessage = $state()
  let formElement

  const validateAndSubmit = async () => {
    errorMessage = ''
    if (formElement.checkValidity()) {
      const data = { username, password }
      try {
        await login(data)
      } catch (error) {
        console.error('Login failed:', error)
        password = ''
        errorMessage = 'Login was not succesfull. Please try again'
        return
      }
      getModal(modalId).close()
    } else {
      formElement.reportValidity()
    }
  }
</script>

<div style="padding: 0 1rem">
  <form bind:this={formElement}>
    <h2>Login</h2>
    <div class="inputs-container">
      <div class="input-container">
        <label for="login-username">Username</label>
        <input
          id="login-username"
          class="input-field"
          type="email"
          bind:value={username}
          placeholder="Enter your email"
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
      <button type="button" class="button-submit" onclick={validateAndSubmit}
        >Submit</button
      >
    </div>
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
