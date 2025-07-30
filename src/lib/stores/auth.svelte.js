/**
 * using property accessors as show here:
 * https://joyofcode.xyz/how-to-share-state-in-svelte-5#using-property-accessors-to-read-and-write-to-reactive-values
 *  */

let token = $state(localStorage.getItem('access_token'))

export const auth = {
  get token() {
    // auth.token will return the current value of token
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get
    return token
  },
  setToken(newToken) {
    token = newToken
    localStorage.setItem('access_token', newToken)
  },
  clearToken() {
    token = null
    localStorage.removeItem('access_token')
  },
}
