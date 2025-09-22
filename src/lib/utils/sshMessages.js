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
    command: 'whoami && ls -a',
  })
  console.log('SSH Connection Result:', result)
  setPanelContent(result)
  toastState.add({ message: 'Command was sent' })
}

const exportAndEvalGraph = async (nodes, edges) => {
  try {
    // @ts-ignore
    const resultExport = await window.electron.invoke('export-graph-ssh', {
      nodes: nodes,
      edges: edges,
    })
    console.log('SSH Connection Result:', resultExport)

    // @ts-ignore
    const resultExecute = await window.electron.invoke('execute-ssh-with-key', {
      // command: 'sbatch --wrap="echo Hello from $(hostname)" --output=hello.out',
      // command: 'sbatch --wrap="cat /root/graph.json" --output=hello.out'
      command: 'sbatch --wrap="/app/build/dealii_backend.g /root/graph.json"',
    })
    console.log('SSH Connection Result:', resultExecute)
    toastState.add({ message: resultExecute })

    const jobId = resultExecute.match(/\d+/)[0]
    const sacctCommand = `sacct -j ${jobId} -n -X -P -o State`
    const finalResult = await pollInvoke({
      channel: 'execute-ssh-with-key',
      arg: {
        command: sacctCommand,
      },
      checkResult: isFinished,
      postProcess: (result) => result.trim(),
      interval: 30000, // Check once per 30 seconds
      timeout: 60_000 * 10, // Give up after 10 minutes
    })
    toastState.add({
      message: `Job id ${jobId}: ${finalResult}`,
      type: finalResult === 'COMPLETED' ? 'success' : 'error',
    })
  } catch (error) {
    toastState.add({
      message: error,
      type: 'error',
    })
  }
}

const isFinished = (result) => {
  // const cleaned = result.replace(/\s+/g, '') // remove all empty or new line characters
  const cleaned = result.trim()
  return cleaned && (cleaned === 'COMPLETED' || cleaned === 'FAILED')
}

/**
 * It repeatedly invokes a specified Electron IPC channel, checking the result
 * against a condition function. It continues polling at regular intervals until
 * either the condition is met or a timeout occurs.
 */
async function pollInvoke({
  channel, // IPC channel name you’ll invoke in the main process
  arg = {}, // Argument to pass to the invoke call
  checkResult, // Function(result) => true when you’re done
  postProcess, // Optional function to call to manipulate the final result or for side effects
  interval = 60_000, // How long (ms) to wait between attempts - default is 1 minute
  timeout = 60_000 * 60 * 24, // Optional hard limit (ms); set 0 for “no limit” - default is 1 day
}) {
  const start = Date.now()
  while (true) {
    try {
      // @ts-ignore
      const result = await window.electron.invoke(channel, arg)
      console.log(result)
      if (checkResult(result)) {
        return postProcess ? postProcess(result) : result // Success – stop polling
      }
    } catch (e) {
      throw new Error(`pollInvoke error: ${e}`)
    }
    if (timeout && Date.now() - start > timeout) {
      throw new Error(`Polling timed out after ${timeout} ms`)
    }
    // Wait before the next attempt
    await new Promise((res) => setTimeout(res, interval))
  }
}

export { executeWithPassword, executeWithKey, exportAndEvalGraph }
