<script module>
  import type { ConcatNodeData } from '../../types/nodeTypes'
  export type ConcatNodeType = Node<ConcatNodeData, 'concat'>;
  </script>
 
<script lang="ts">
  import {
    Handle,
    Position,
    useNodes,
    useEdges,
    type NodeProps,
    type Node,
  } from '@xyflow/svelte'
  import { concatState } from '../../states/concatState.svelte'
  import { inOutTypes } from '../../utils/enums'

  let { id, data }: NodeProps<ConcatNodeType> = $props()
  data.inputs = [inOutTypes.STRING, inOutTypes.STRING]
  data.outputs = []
 
  const nodes = useNodes()
  const edges = useEdges()

  const getTextFromNode = (nodeData: any): string => {
    return nodeData?.data?.value || ''
  }

  const getConnectedNodeText = (targetHandle: string, allEdges: any[], allNodes: Node[]) => {
    // Find edges that connect to this node's specific handle
    const connectedEdge = allEdges.find(edge => 
      edge.target === id && edge.targetHandle === targetHandle
    )
    
    if (!connectedEdge) return ''
    
    // Find the source node
    const sourceNode = allNodes.find(node => node.id === connectedEdge.source)
    
    return getTextFromNode(sourceNode)
  }
  
  let topText = $derived(getConnectedNodeText('input-0', edges.current, nodes.current))
  let bottomText = $derived(getConnectedNodeText('input-1', edges.current, nodes.current))
  let command = $derived(topText && bottomText ? topText + ' && ' + bottomText : topText + bottomText)
  // Then use an effect to update the state when the derived value changes
  $effect(() => {
    data.value = command
    concatState.command = command
  })
</script>
 
<div class="custom-node">
  <Handle id="input-0" type="target" position={Position.Left} style="top: 30%;" />
  <Handle id="input-1" type="target" position={Position.Left} style="top: 70%;" />
  
  <div class="label">Concatenation:</div>
  
  <div class="inputs">
    <div class="input-row">
      <span class="input-label">Input 0:</span>
      <span class="input-value">{topText || 'not connected'}</span>
    </div>
    <div class="input-row">
      <span class="input-label">Input 1:</span>
      <span class="input-value">{bottomText || 'not connected'}</span>
    </div>
  </div>
  
  <div class="result">
    <span class="result-label">Result:</span>
    <span id="concatenated-text" class="result-value">{command}</span>
  </div>
</div>
 
<style>
  .custom-node {
    padding: 15px;
    border-radius: 5px;
    background: #EFEFEF;
    border: 2px solid #5e9cf1;
    min-width: 200px;
  }
  
  .label {
    font-weight: bold;
    margin-bottom: 10px;
  }
  
  .inputs {
    margin-bottom: 10px;
  }
  
  .input-row {
    margin-bottom: 5px;
  }
  
  .input-label, .result-label {
    font-weight: bold;
    margin-right: 5px;
  }
  
  .input-value, .result-value {
    font-family: monospace;
  }
  
  .result {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed #999;
  }
</style>