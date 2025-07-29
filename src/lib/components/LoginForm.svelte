<script>
  let { onSubmit, onSuccess } = $props()

  let username = $state()
  let password = $state()
  let formElement

  const validateAndSubmit = () => {
    if (formElement.checkValidity()) {
      const data = { username, password }
      onSubmit(data)
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
</style>
