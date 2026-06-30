<script module lang="ts">
  import type { Node as FlowNode } from '@xyflow/svelte'
  import type { CoralStageData } from '../../types/pipelineTypes'
  export type CoralStageNodeType = FlowNode<CoralStageData, 'coralStage'>
</script>

<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte'
  import { pipelineState } from '../../stores/pipeline.svelte'
  import { isValidSlurmTime, SLURM_TIME_HINT } from '../../utils/slurmTime'

  let { id, data }: NodeProps<CoralStageNodeType> = $props()

  let total = $derived(data.config.nodes * data.config.tasksPerNode)
  let timeInvalid = $derived(!isValidSlurmTime(data.config.timeLimit))
</script>

<Handle type="target" position={Position.Left} />

<div class="stage-node coral">
  <header>
    <span class="badge">coral</span>
    <input
      class="name"
      value={data.name}
      oninput={(e) =>
        pipelineState.updateStageData(id, {
          name: (e.currentTarget as HTMLInputElement).value,
        })}
    />
    <button
      class="remove"
      title="Remove stage"
      aria-label="Remove stage"
      onclick={() => pipelineState.removeStage(id)}>✕</button
    >
  </header>

  <label class="mpi-row">
    <input
      type="checkbox"
      checked={data.config.useMpi}
      onchange={(e) =>
        pipelineState.updateStageConfig(id, {
          useMpi: (e.currentTarget as HTMLInputElement).checked,
        })}
    />
    Use MPI
  </label>

  {#if data.config.useMpi}
    <div class="row">
      <label class="field">
        Nodes
        <input
          type="number"
          min="1"
          value={data.config.nodes}
          oninput={(e) =>
            pipelineState.updateStageConfig(id, {
              nodes: (e.currentTarget as HTMLInputElement).valueAsNumber || 1,
            })}
        />
      </label>
      <label class="field">
        Tasks/node
        <input
          type="number"
          min="1"
          value={data.config.tasksPerNode}
          oninput={(e) =>
            pipelineState.updateStageConfig(id, {
              tasksPerNode:
                (e.currentTarget as HTMLInputElement).valueAsNumber || 1,
            })}
        />
      </label>
      <span class="total">= {total}</span>
    </div>
  {/if}

  <label class="field">
    Time limit
    <input
      type="text"
      class:invalid={timeInvalid}
      value={data.config.timeLimit}
      oninput={(e) =>
        pipelineState.updateStageConfig(id, {
          timeLimit: (e.currentTarget as HTMLInputElement).value,
        })}
    />
    {#if timeInvalid}<span class="hint">{SLURM_TIME_HINT}</span>{/if}
  </label>
</div>

<Handle type="source" position={Position.Right} />

<style>
  .stage-node {
    width: 240px;
    background: var(--secondary-color);
    border: 1px solid var(--ternary-color);
    border-radius: 10px;
    padding: 0.6rem;
    font-size: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .coral {
    border-left: 4px solid var(--button-action-bg);
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .badge {
    font-size: 0.7rem;
    font-weight: bold;
    color: var(--button-action-bg);
    text-transform: uppercase;
  }
  .name {
    flex: 1;
    min-width: 0;
    font-weight: bold;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 0.2rem 0.3rem;
    color: inherit;
  }
  .name:hover,
  .name:focus {
    border-color: var(--ternary-color);
  }
  .remove {
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--ternary-color);
    font-size: 0.9rem;
  }
  .mpi-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .row {
    display: flex;
    align-items: flex-end;
    gap: 0.4rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    flex: 1;
    min-width: 0;
  }
  input[type='number'],
  input[type='text'] {
    padding: 0.3rem;
    border: 1px solid var(--ternary-color);
    border-radius: 6px;
    background: var(--primary-color);
    color: inherit;
    width: 100%;
    box-sizing: border-box;
  }
  .total {
    font-weight: bold;
    padding-bottom: 0.4rem;
    white-space: nowrap;
  }
  .invalid {
    border-color: var(--error-color, #e53935);
  }
  .hint {
    color: var(--error-color, #e53935);
    font-size: 0.7rem;
  }
</style>
