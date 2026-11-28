import { setServiceRegistry } from './registryStore.svelte'
import { toastState } from './toastsStore.svelte'
import { currentProjectState } from './currentProjectStore.svelte'
import { graphStackState } from './graphStack.svelte'
import { setEdges, setNodes, updateLastNodeId } from './nodes.svelte'
import { parameterNodeEditorState } from './parameterNodeEditor.svelte'
import { canvasRunState } from './canvasRun.svelte'
import type { ParameterTree } from '../types/parameterTypes'
import {
  executionVersion,
  WorkflowRequestError,
  type ExecutionReply,
  type ExecutionRequest,
  type RegistryDocument,
  type RunStatus,
  type WorkflowDocument,
} from '../types/executionService'

type RequestWithoutVersion<T> = T extends unknown ? Omit<T, 'version'> : never
type Request = RequestWithoutVersion<ExecutionRequest>

let enabled = $state(false)
let registry = $state<RegistryDocument>()
let runs = $state<Record<string, RunStatus>>({})

export const workflowService = {
  get enabled() {
    return enabled
  },
  get runs() {
    return Object.values(runs).reverse()
  },
  getRun(runId: string) {
    return runs[runId]
  },
  get operations() {
    return registry?.__backend.operations ?? []
  },

  async initialize(): Promise<() => void> {
    const bridge = window.electron?.workflow
    if (!bridge) return () => {}
    enabled = await bridge.enabled()
    if (enabled) setServiceRegistry({})
    const unsubscribe = bridge.subscribe((reply) => {
      if ('result' in reply && reply.operation === 'status')
        record(reply.result)
    })
    try {
      if (enabled) await workflowService.refreshRegistry()
    } catch (error) {
      showError(error)
    }
    return unsubscribe
  },

  adoptBackend(document: RegistryDocument | null, backendChanged: boolean) {
    if (backendChanged) {
      runs = {}
      canvasRunState.clear()
      parameterNodeEditorState.close()
      currentProjectState.clear()
      setNodes([])
      setEdges([])
      updateLastNodeId()
      graphStackState.reset()
    }
    enabled = document !== null
    if (document) acceptRegistry(document)
    else if (backendChanged) {
      registry = undefined
      setServiceRegistry({})
    }
  },

  async refreshRegistry() {
    const reply = await exchange({ operation: 'describe' })
    if (reply.operation !== 'describe')
      throw new Error('Expected the backend registry')
    acceptRegistry(reply.result)
  },

  getConfiguration() {
    const backend = registry?.__backend
    if (!backend?.configuration || !backend.operations?.includes('configure'))
      return
    return {
      parameters: $state.snapshot(backend.configuration),
      digest: backend.configuration_digest,
    }
  },

  async configure(configuration: ParameterTree, configuration_digest: string) {
    const reply = await exchange({
      operation: 'configure',
      configuration,
      configuration_digest,
    })
    if (reply.operation !== 'configure')
      throw new Error('Expected the updated backend registry')
    acceptRegistry(reply.result)
  },

  async openGraph(): Promise<WorkflowDocument | null> {
    const text = await window.electron.workflow.openWorkflow()
    if (text === null) return null
    const document = JSON.parse(text)
    if (!workflowService.operations.includes('migrate')) return document
    const reply = await exchange({ operation: 'migrate', document })
    if (reply.operation !== 'migrate')
      throw new Error('Expected a workflow document')
    return reply.result.network
  },

  async validate(network: WorkflowDocument): Promise<void> {
    const reply = await graphRequest('validate', network)
    if (reply.operation !== 'validate')
      throw new Error('Expected the validation result')
  },

  async submit(network: WorkflowDocument): Promise<RunStatus> {
    const reply = await graphRequest('submit', network)
    if (reply.operation !== 'submit')
      throw new Error('Expected the submitted run')
    record(reply.result)
    return reply.result
  },

  async updateRun(
    operation: 'cancel' | 'pause' | 'resume' | 'replay',
    run_id: string
  ): Promise<RunStatus> {
    const reply = await exchange({ operation, run_id })
    if (reply.operation !== operation)
      throw new Error('Expected the run status')
    record(reply.result)
    return reply.result
  },

  async outputs(run_id: string): Promise<Record<string, string[]>> {
    const reply = await exchange({ operation: 'outputs', run_id })
    if (reply.operation !== 'outputs')
      throw new Error('Expected the run outputs')
    return reply.result.outputs
  },

  async refreshRuns(): Promise<void> {
    await Promise.all(
      Object.keys(runs).map(async (run_id) => {
        const reply = await exchange({ operation: 'status', run_id })
        if (reply.operation === 'status') record(reply.result)
      })
    )
  },

  async logs(run_id: string): Promise<string> {
    const reply = await exchange({ operation: 'logs', run_id })
    return reply.operation === 'logs'
      ? Object.entries(reply.result.logs)
          .map(([node, log]) => `${node}\n${log}`)
          .join('\n')
      : ''
  },
}

/** Show an operation that still belongs to the previous execution path.
 * @param message - The responsibility that needs a contract-backed implementation.
 */
export function obsolete(message: string): void {
  toastState.add({ message: `[TODO] ${message}`, type: 'warning' })
}

// ── Private helpers ──

function acceptRegistry(document: RegistryDocument) {
  if (
    registry &&
    (registry.__backend.id !== document.__backend.id ||
      registry.__backend.configuration_digest !==
        document.__backend.configuration_digest)
  ) {
    runs = {}
    canvasRunState.clear()
  }
  registry = document
  const skipped = setServiceRegistry(document)
  if (skipped.length)
    toastState.add({
      message: `Skipped ${skipped.length} invalid registry entries`,
      type: 'warning',
    })
}

function graphRequest(
  operation: 'validate' | 'submit',
  network: WorkflowDocument
) {
  if (!registry)
    throw new Error('Sync the backend registry before using the workflow')
  const { configuration_digest, registry_digest } = registry.__backend
  return exchange({ operation, network, configuration_digest, registry_digest })
}

async function exchange(
  request: Request
): Promise<Extract<ExecutionReply, { result: unknown }>> {
  const reply = await window.electron.workflow.exchange({
    ...request,
    version: executionVersion,
  })
  if ('error' in reply) throw new WorkflowRequestError(reply.error)
  return reply
}

function record(run: RunStatus) {
  const previous = runs[run.run_id]
  if (previous?.cancellation_requested && run.scheduling) {
    run = { ...run, scheduling: undefined, cancellation_requested: true }
  } else if (
    previous?.scheduling &&
    run.scheduling &&
    previous.scheduling.revision > run.scheduling.revision
  ) {
    run = { ...run, scheduling: previous.scheduling }
  }
  runs[run.run_id] = run
}

function showError(error: unknown) {
  toastState.add({
    message: error instanceof Error ? error.message : String(error),
    type: 'error',
  })
}
