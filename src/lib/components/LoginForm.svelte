<script>
  let { onSubmit, onSuccess } = $props()

  let username = $state()
  let password = $state()

  const validateAndSubmit = () => {
    console.log(username, password)
    const data = { username, password }
    console.log('validate')
    // TODO: add validation logic
    onSubmit(data)
    onSuccess()
  }
</script>

<div>
  <h2>Login</h2>
  <div class="inputs-container">
    <label for="login-username">Username</label>
    <input
      id="login-username"
      type="text"
      bind:value={username}
      placeholder="Username"
    />
    <label for="login-password">Password</label>
    <input
      id="login-password"
      type="password"
      bind:value={password}
      placeholder="Password"
    />
  </div>
  <div class="button-container">
    <button onclick={validateAndSubmit}>Submit</button>
  </div>
</div>

<style>
  .inputs-container {
    display: flex;
    flex-direction: column;
    gap: 1vh;
  }

  .button-container {
    margin-top: 2vh;
  }
</style>
