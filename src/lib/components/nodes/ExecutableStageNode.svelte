<script module lang="ts">
  import type { Node as FlowNode } from '@xyflow/svelte'
  import type { ExecutableStageData } from '../../types/pipelineTypes'
  export type ExecutableStageNodeType = FlowNode<
    ExecutableStageData,
    'executableStage'
  >
</script>

<script lang="ts">
  import { Handle, Position, type NodeProps } from '@xyflow/svelte'
  import { pipelineState } from '../../stores/pipeline.svelte'
  import { isValidSlurmTime, SLURM_TIME_HINT } from '../../utils/slurmTime'
  import { parseParametersFileWithFormat } from '../../utils/parameterFileFormat'
  import { toastState } from '../../stores/toastsStore.svelte'

  let { id, data }: NodeProps<ExecutableStageNodeType> = $props()

  let paramsInput: HTMLInputElement | undefined = $state()
  let timeInvalid = $derived(
    !!data.config.timeLimit && !isValidSlurmTime(data.config.timeLimit)
  )

  const onLoadParams = async () => {
    const file = paramsInput?.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const { data: parameters } = parseParametersFileWithFormat(
        text,
        file.name
      )
      pipelineState.setStageParameters(id, {
        parameters,
        parametersFileName: file.name,
      })
      toastState.add({ message: `Loaded parameters from ${file.name}` })
    } catch (error) {
      toastState.add({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to parse parameters file',
        type: 'error',
      })
    }
  }
</script>

<Handle type="target" position={Position.Left} />

<div class="stage-node executable">
  <header>
    <span class="badge">exe</span>
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

  <label class="field">
    Binary path
    <input
      type="text"
      value={data.executablePath}
      oninput={(e) =>
        pipelineState.updateStageData(id, {
          executablePath: (e.currentTarget as HTMLInputElement).value,
        })}
    />
  </label>

  <div class="params-row">
    <span class="params-name" class:missing={!data.parameters}>
      {data.parameters ? data.parametersFileName : 'no parameters'}
    </span>
    <button class="load" onclick={() => paramsInput?.click()}
      >Load params…</button
    >
  </div>
  <input
    bind:this={paramsInput}
    type="file"
    accept=".json,.prm"
    style="display: none"
    onchange={onLoadParams}
  />

  <label class="field">
    Time limit
    <input
      type="text"
      class:invalid={timeInvalid}
      value={data.config.timeLimit ?? ''}
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
  .executable {
    border-left: 4px solid #b08900;
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .badge {
    font-size: 0.7rem;
    font-weight: bold;
    color: #b08900;
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
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  input[type='text'] {
    padding: 0.3rem;
    border: 1px solid var(--ternary-color);
    border-radius: 6px;
    background: var(--primary-color);
    color: inherit;
    width: 100%;
    box-sizing: border-box;
  }
  .params-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem;
  }
  .params-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .params-name.missing {
    color: var(--error-color, #e53935);
    font-style: italic;
  }
  .load {
    border: 1px solid var(--ternary-color);
    background: var(--primary-color);
    border-radius: 6px;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
    color: inherit;
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
