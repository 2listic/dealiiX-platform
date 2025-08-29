let timeOut

/**
 * Sets the content of the Svelte upper-left panel and clears it after 5 seconds.
 * If param isError is set to true, it also consoles error the content
 * @param {string} content the text to put as content
 * @param {boolean} isError the text is an error message. Default is false
 */
export const setPanelContent = (content, isError = false) => {
  if (timeOut) clearTimeout(timeOut)
  const panel = document.getElementById('ssh-response')
  panel.textContent = content
  if (isError) console.error(content)
  timeOut = setTimeout(() => {
    panel.textContent = '-'
  }, 5000)
}
