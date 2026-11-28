import type { BackendIdentity, Network, NodeCapabilities } from './nodeTypes'
import type { ParameterTree } from './parameterTypes'

export const executionVersion = '1.1' as const

export type WorkflowDocument = Pick<Network, 'backend' | 'workflow'> &
  Partial<Pick<Network, 'author' | 'date_time_utc'>> & { version?: 1 | '1.1' }

export type RegistryDocument = Record<string, unknown> & {
  __backend: BackendIdentity & {
    configuration?: ParameterTree
    capabilities?: NodeCapabilities
    configuration_digest: string
    registry_digest: string
  }
}

export type ExecutionDiagnostic = {
  code: string
  message: string
  qualified_id?: string
}

export class WorkflowRequestError extends Error {
  constructor(public readonly diagnostic: ExecutionDiagnostic) {
    super(`${diagnostic.code}: ${diagnostic.message}`)
  }
}

export type Phase = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
export type NodeRunStatus = {
  qualified_id: string
  state: Phase
  waiting_for?: string
  reused?: boolean
  error?: ExecutionDiagnostic
}

export type RunStatus = {
  run_id: string
  state: Phase
  source_run_id?: string
  cancellation_requested?: boolean
  error?: ExecutionDiagnostic
  nodes: Record<string, NodeRunStatus>
}

export type ExecutionRequest = { version: typeof executionVersion } & (
  | { operation: 'describe' }
  | { operation: 'migrate'; document: Record<string, unknown> }
  | {
      operation: 'artifact'
      run_id: string
      qualified_id: string
      name: string
      offset: number
    }
  | {
      operation: 'configure'
      configuration: ParameterTree
      configuration_digest: string
    }
  | {
      operation: 'validate' | 'submit'
      network: WorkflowDocument
      configuration_digest: string
      registry_digest: string
    }
  | {
      operation: 'status' | 'logs' | 'outputs' | 'cancel' | 'replay'
      run_id: string
    }
)

type ExecutionResults = {
  describe: RegistryDocument
  configure: RegistryDocument
  validate: { valid: true }
  submit: RunStatus
  status: RunStatus
  cancel: RunStatus
  replay: RunStatus
  migrate: { network: WorkflowDocument; changes: string[] }
  artifact: {
    name: string
    media_type: string
    data: string
    next_offset: number | null
  }
  logs: { run_id: string; logs: Record<string, string> }
  outputs: { run_id: string; outputs: Record<string, string[]> }
}

export type ExecutionReply = { version: typeof executionVersion } & (
  | { error: ExecutionDiagnostic; operation?: keyof ExecutionResults }
  | {
      [K in keyof ExecutionResults]: {
        operation: K
        result: ExecutionResults[K]
      }
    }[keyof ExecutionResults]
)
