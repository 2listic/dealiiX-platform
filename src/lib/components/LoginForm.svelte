<script>
  let { onSubmit, onSuccess } = $props()

  let username = $state()
  let password = $state()
  let errorMessage = $state()
  let formElement

  const validateAndSubmit = async () => {
    errorMessage = ''
    if (formElement.checkValidity()) {
      const data = { username, password }
      try {
        await onSubmit(data)
      } catch (error) {
        console.error('Login failed:', error)
        errorMessage = 'Login was not succesfull. Please try again'
        return
      }
      onSuccess()
    } else {
      formElement.reportValidity()
    }
  }
</script>

<form bind:this={formElement}>
  <h2>Login</h2>
  <div class="inputs-container">
    <label for="login-username">Username</label>
    <input
      id="login-username"
      type="email"
      bind:value={username}
      placeholder="Username"
      required
    />
    <label for="login-password">Password</label>
    <input
      id="login-password"
      type="password"
      bind:value={password}
      placeholder="Password"
      minlength="6"
      required
    />
  </div>
  <div class="button-container">
    <button type="button" onclick={validateAndSubmit}>Submit</button>
  </div>
  <div class="error-message">{errorMessage}</div>
</form>

<style>
  .inputs-container {
    display: flex;
    flex-direction: column;
    gap: 1vh;
  }

  .button-container {
    margin-top: 2vh;
  }

  #login-username:invalid {
    border-color: red;
  }

  #login-password:invalid {
    border-color: red;
  }

  .error-message {
    /* font-size: 2rem; */
    margin-top: 2vh;
  }
</style>
