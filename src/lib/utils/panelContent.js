let timeOut

export const setPanelContent = (content) => {
  if (timeOut) clearTimeout(timeOut)
  const panel = document.getElementById('ssh-response')
  panel.textContent = content
  timeOut = setTimeout(() => {
    panel.textContent = '-'
  }, 5000)
}
