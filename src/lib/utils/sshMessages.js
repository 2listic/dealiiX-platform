import { concatState } from '../stores/concatState.svelte'
import { toastState } from '../stores/toastsStore.svelte'
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
  toastState.add({ message: 'Command was sent' })
}

const executeWithKey = async () => {
  console.log('command', concatState.command)
  // @ts-ignore
  const result = await window.electron.invoke('execute-ssh-with-key', {
    // command: 'sbatch --wrap="echo Hello from $(hostname)" --output=hello.out',
    // command: 'sbatch --wrap="cat /root/graph.json" --output=hello.out'
    command: 'sbatch --wrap="/app/build/dealii_backend.g /root/graph.json"',
  })
  console.log('SSH Connection Result:', result)
  setPanelContent(result)
  toastState.add({ message: 'Command was sent' })
}

const exportGraph = async (nodes, edges) => {
  try {
    // @ts-ignore
    const result = await window.electron.invoke('export-graph-ssh', {
      nodes: nodes,
      edges: edges,
    })
    console.log('SSH Connection Result:', result)
    toastState.add({ message: result })
  } catch (error) {
    toastState.add({
      message: error,
      type: 'error',
    })
  }
}

export { executeWithPassword, executeWithKey, exportGraph }
