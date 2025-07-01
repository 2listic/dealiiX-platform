import { concatState } from '../states/concatState.svelte'

const executeWithPassword = async () => {
  // @ts-ignore
  const result = await window.electron.invoke('execute-ssh-command-with-password', {
    host: 'localhost',
    username: 'root',
    password: 'root',
    command: 'echo "Hello from Electron!"'
  })
  console.log('SSH Command Result:', result)
  let panel = document.getElementById('ssh-response')
  panel.textContent = result
}

const executeWithKey = async () => {
  console.log('command', concatState.command)
  // @ts-ignore
  const result = await window.electron.invoke('execute-ssh-with-key', {
    command: concatState.command
  })
  console.log('SSH Connection Result:', result)
  let panel = document.getElementById('ssh-response')
  panel.textContent = result
}

const exportGraph = async (nodes, edges) => {
  // @ts-ignore
  const result = await window.electron.invoke('export-graph-ssh', {
    nodes: nodes,
    edges: edges
  })
  console.log('SSH Connection Result:', result)
  let panel = document.getElementById('ssh-response')
  panel.textContent = result
}

export { executeWithPassword, executeWithKey, exportGraph }