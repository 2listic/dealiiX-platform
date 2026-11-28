import {
  WorkflowRequestError,
  type ExecutionDiagnostic,
  type NodeRunStatus,
  type RunStatus,
} from '../types/executionService'

type Activity = {
  graph: number
  runId?: string
  diagnostic?: ExecutionDiagnostic
}

let activity = $state<Activity>()
let lastAttempt = 0

export const canvasRunState = {
  async track(
    graph: number,
    operation: 'submit' | 'validate',
    request: () => Promise<RunStatus | void>
  ): Promise<void> {
    const attempt = ++lastAttempt
    const previousRun =
      operation === 'validate' && activity?.graph === graph
        ? activity.runId
        : undefined
    if (operation === 'submit') activity = undefined
    try {
      const run = await request()
      if (attempt !== lastAttempt) return
      const runId = run?.run_id ?? previousRun
      activity = runId ? { graph, runId } : undefined
    } catch (error) {
      if (attempt === lastAttempt) {
        const diagnostic =
          error instanceof WorkflowRequestError ? error.diagnostic : undefined
        activity =
          previousRun || diagnostic?.qualified_id
            ? { graph, runId: previousRun, diagnostic }
            : undefined
      }
      throw error
    }
  },

  adoptReplay(graph: number, source: string, runId: string) {
    if (activity?.graph === graph && activity.runId === source)
      activity = { graph, runId }
  },

  node(
    graph: number,
    qualifiedId: string,
    getRun: (_runId: string) => RunStatus | undefined
  ): NodeRunStatus | undefined {
    if (activity?.graph !== graph) return
    const error = activity.diagnostic
    if (error?.qualified_id === qualifiedId)
      return { qualified_id: qualifiedId, state: 'failed', error }
    return activity.runId
      ? getRun(activity.runId)?.nodes[qualifiedId]
      : undefined
  },

  clear() {
    lastAttempt++
    activity = undefined
  },
}
