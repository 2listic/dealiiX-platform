<script lang="ts">
  import {
    SvelteFlow,
    Background,
    type NodeTypes,
    type Connection,
    type Edge,
    MiniMap,
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
  import { resolveExecutionOrder } from '../orchestration/executionOrder'
  import { colorModeState } from '../stores/colorModeStore.svelte'
  import CoralStageNode from './nodes/CoralStageNode.svelte'
  import ExecutableStageNode from './nodes/ExecutableStageNode.svelte'

  const nodeTypes: NodeTypes = {
    coralStage: CoralStageNode as unknown as NodeTypes[string],
    executableStage: ExecutableStageNode as unknown as NodeTypes[string],
  }

  /**
   * Rejects connections that would create a self-loop, duplicate an existing edge,
   * or introduce a cycle (which would make the pipeline unschedulable).
   * TODO: cache by (source, target, edgesHash) if this becomes measurable on large pipelines.
   */
  const isValidConnection = (connection: Connection | Edge): boolean => {
    const { source, target } = connection
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
      nodes: pipeline.nodes,
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
    <MiniMap />
    <Background />
  </SvelteFlow>
</div>

<style>
  .pipeline-canvas {
    width: 100%;
    height: 100%;
  }
</style>
