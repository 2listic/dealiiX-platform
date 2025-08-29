import { concatState } from '../stores/concatState.svelte'
import { setPanelContent } from './panelContent.js'

const executeWithPassword = async () => {
  // @ts-ignore
  const result = await window.electron.invoke(
    'execute-ssh-command-with-password',
    {
      host: 'localhost',
      username: 'root',
      password: 'root',
      command: 'echo "Hello from Electron!"',
    }
  )
  console.log('SSH Command Result:', result)
  setPanelContent(result)
}

const executeWithKey = async () => {
  console.log('command', concatState.command)
  // @ts-ignore
  const result = await window.electron.invoke('execute-ssh-with-key', {
    command: concatState.command,
  })
  console.log('SSH Connection Result:', result)
  setPanelContent(result)
}

const exportGraph = async (nodes, edges) => {
  try {
    // @ts-ignore
    const result = await window.electron.invoke('export-graph-ssh', {
      nodes: nodes,
      edges: edges,
    })
    console.log('SSH Connection Result:', result)
    setPanelContent(result)
  } catch (error) {
    setPanelContent(error, true)
  }
}

export { executeWithPassword, executeWithKey, exportGraph }
