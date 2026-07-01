<script lang="ts">
  import {
    SvelteFlow,
    Background,
    Controls,
    Panel,
    type NodeTypes,
    type Connection,
    type Edge,
  } from '@xyflow/svelte'
  import '@xyflow/svelte/dist/base.css'
  import {
    getNodes,
    getEdges,
    setNodes,
    setEdges,
    getEdgesSnapshot,
    pipelineState,
  } from '../stores/pipeline.svelte'
  import {
    getNodesSnapshot as getGraphNodesSnapshot,
    getEdgesSnapshot as getGraphEdgesSnapshot,
  } from '../stores/nodes.svelte'
  import { buildGraphPayload } from '../utils/sshMessages'
  import { runPipelineRemote } from '../orchestration/pipelineOrchestrator'
  import { resolveExecutionOrder } from '../orchestration/executionOrder'
  import { settingsState } from '../stores/settingsStore.svelte'
  import { colorModeState } from '../stores/colorModeStore.svelte'
  import { toastState } from '../stores/toastsStore.svelte'
  import { jobsState } from '../stores/jobsStore.svelte'
  import { currentProjectState } from '../stores/currentProjectStore.svelte'
  import Button from './layout/Button.svelte'
  import CoralStageNode from './nodes/CoralStageNode.svelte'
  import ExecutableStageNode from './nodes/ExecutableStageNode.svelte'

  const nodeTypes: NodeTypes = {
    coralStage: CoralStageNode as unknown as NodeTypes[string],
    executableStage: ExecutableStageNode as unknown as NodeTypes[string],
  }

  let coralGraphInput: HTMLInputElement | undefined = $state()

  let isRemote = $derived(settingsState.execution.location === 'remote')
  let validation = $derived(pipelineState.validation)

  /**
   * Rejects connections that would create a self-loop, duplicate an existing edge,
   * or introduce a cycle (which would make the pipeline unschedulable).
   * TODO: cache by (source, target, edgesHash) if this becomes measurable on large pipelines.
   */
  const isValidConnection = (connection: Connection | Edge): boolean => {
    const { source, target } = connection
    // console.log('[isValidConnection]', { source, target })
    if (!source || !target || source === target) {
      console.warn(
        `Source stage ${source} and target stage ${target} are invalid: self-loop or missing endpoint`
      )
      return false
    }

    const edges = getEdgesSnapshot()
    if (edges.some((e) => e.source === source && e.target === target)) {
      console.warn(
        `Source stage ${source} and target stage ${target} are invalid: duplicate edge`
      )
      return false
    }

    const pipeline = pipelineState.toPipeline()
    const candidate = {
      ...pipeline,
      edges: [...pipeline.edges, { source, target }],
    }
    try {
      resolveExecutionOrder(candidate)
      return true
    } catch {
      console.warn(
        `Source stage ${source} and target stage ${target} are invalid: would introduce a cycle`
      )
      return false
    }
  }

  const handleAddCoralFromFile = async () => {
    const file = coralGraphInput?.files?.[0]
    if (!file) return
    try {
      const graph = JSON.parse(await file.text())
      if (!graph || typeof graph !== 'object' || !('workflow' in graph)) {
        toastState.add({
          message:
            'This file does not look like a CORAL graph (no "workflow").',
          type: 'error',
        })
        return
      }
      const name = file.name.replace(/\.json$/i, '')
      // Capture the coral install paths at stage creation (symmetric to the
      // executable path capture) so the stage is a self-contained execution
      // request — the submit primitive no longer reads settingsState.
      pipelineState.addCoralStage({
        name,
        graph,
        coralBinaryPath: settingsState.remote.coralBinaryPath,
        coralPluginPath: settingsState.remote.coralPluginPath,
      })
    } catch (error) {
      toastState.add({
        message:
          error instanceof Error ? error.message : 'Failed to read graph file',
        type: 'error',
      })
    } finally {
      if (coralGraphInput) coralGraphInput.value = ''
    }
  }

  const handleAddCoralFromCanvas = () => {
    const graph = buildGraphPayload(
      getGraphNodesSnapshot(),
      getGraphEdgesSnapshot(),
      false
    )
    pipelineState.addCoralStage({
      name: currentProjectState.name || 'canvas graph',
      graph,
      coralBinaryPath: settingsState.remote.coralBinaryPath,
      coralPluginPath: settingsState.remote.coralPluginPath,
    })
  }

  const handleAddExecutable = () => {
    pipelineState.addExecutableStage({
      name: 'executable',
      executablePath: settingsState.remote.executablePath,
      parametersFileName:
        settingsState.remote.parametersFileName || 'parameters.json',
    })
  }

  const handleRun = () => {
    if (!validation.runnable) {
      toastState.add({
        message: `Cannot run: ${validation.issues.join('; ')}`,
        type: 'error',
      })
      return
    }
    const pipeline = pipelineState.toPipeline()

    // Expose the pipeline snapshot for inspection.
    console.log('[pipeline canvas]', JSON.parse(JSON.stringify(pipeline)))

    // Toasts and jobsState.update() are side effects of the caller, reported
    // through the progress callbacks.
    runPipelineRemote(pipeline, (event) => {
      if (event.type === 'info' || event.type === 'success') {
        toastState.add({ message: event.message, type: event.type })
      } else if (event.type === 'error') {
        toastState.add({ message: event.message, type: 'error' })
      } else if (event.type === 'stageTerminal') {
        jobsState.update()
      }
    }).catch((error) => {
      toastState.add({
        message: error instanceof Error ? error.message : 'Pipeline run failed',
        type: 'error',
      })
    })
  }
</script>

<div class="pipeline-canvas" data-testid="pipeline-canvas">
  <SvelteFlow
    bind:nodes={getNodes, setNodes}
    bind:edges={getEdges, setEdges}
    {nodeTypes}
    {isValidConnection}
    colorMode={colorModeState.value}
    fitView
  >
    <Background />
    <Controls />
    <Panel position="bottom-right">
      <div class="toolbar">
        {#if !isRemote}
          <div class="banner">
            Pipelines run in remote mode only — switch in Settings.
          </div>
        {/if}
        <div class="add-buttons">
          <Button size="small" onclick={() => coralGraphInput?.click()}>
            + Coral (file)
          </Button>
          <Button size="small" onclick={handleAddCoralFromCanvas}
            >+ Coral (canvas)</Button
          >
          <Button size="small" onclick={handleAddExecutable}
            >+ Executable</Button
          >
        </div>
        <div class="actions">
          <Button
            size="small"
            variant="action"
            disabled={!isRemote || !validation.runnable}
            onclick={handleRun}
          >
            Run pipeline
          </Button>
        </div>
        {#if validation.issues.length > 0}
          <ul class="issues">
            {#each validation.issues as issue (issue)}
              <li>{issue}</li>
            {/each}
          </ul>
        {/if}
      </div>
    </Panel>
  </SvelteFlow>

  <input
    bind:this={coralGraphInput}
    type="file"
    accept=".json"
    style="display: none"
    onchange={handleAddCoralFromFile}
  />
</div>

<style>
  .pipeline-canvas {
    width: 100%;
    height: 100%;
  }
  .toolbar {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: var(--primary-color);
    border: 1px solid var(--ternary-color);
    border-radius: 10px;
    padding: 0.6rem;
    max-width: 320px;
  }
  .add-buttons,
  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .banner {
    color: var(--error-color, #e53935);
    font-size: 0.8rem;
  }
  .issues {
    margin: 0;
    padding-left: 1.1rem;
    font-size: 0.75rem;
    color: var(--ternary-color);
  }
</style>
