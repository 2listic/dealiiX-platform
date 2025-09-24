import { concatState } from '../stores/concatState.svelte'
import { jobsState } from '../stores/jobsStore.svelte'
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
    if (!jobId) throw new Error('Job ID not found')
    const sacctCommand = `sacct -j ${jobId} -n -X -P -o State`
    await jobPolling(jobId, sacctCommand, 3 * 1000, 60 * 10)
  } catch (error) {
    toastState.add({
      message: error,
      type: 'error',
    })
  }
}

const jobPolling = async (jobId, command, interval, timeout) => {
  const start = Date.now()
  while (true) {
    try {
      // @ts-ignore
      const result = await window.electron.invoke('execute-ssh-with-key', {
        command: command,
      })
      console.log(result)
      const cleaned = result.trim()
      if (cleaned && (cleaned === 'COMPLETED' || cleaned === 'FAILED')) {
        toastState.add({
          message: `Job id ${jobId}: ${cleaned}`,
          type: cleaned === 'COMPLETED' ? 'success' : 'error',
        })
        return
      }
    } catch (e) {
      throw new Error(`Job ${jobId} polling error: ${e}`)
    }
    const now = Date.now()
    if (timeout && now - start > timeout) {
      throw new Error(`Job ${jobId} polling timed out after ${timeout} ms`)
    }
    // Wait before the next attempt
    await delay(interval)
  }
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms))

const getJobsState = async () => {
  const command = 'sacct -X -P -o JobID,State,Start,End'
  try {
    // @ts-ignore
    const result = await window.electron.invoke('execute-ssh-with-key', {
      command: command,
    })
    const resultArrays = result.split('\n').map((line) => line.split('|'))
    jobsState.current = resultArrays
  } catch (error) {
    toastState.add({
      message: error,
      type: 'error',
    })
  }
}

export { executeWithPassword, executeWithKey, exportAndEvalGraph, getJobsState }
