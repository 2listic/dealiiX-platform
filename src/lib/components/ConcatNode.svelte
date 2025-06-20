<script module>
  export type ConcatNodeType = Node<{}, 'concat'>;
</script>
 
<script lang="ts">
  import {
    Handle,
    Position,
    useNodes,
    useEdges,
    type NodeProps,
    type Node,
  } from '@xyflow/svelte';

  let props: NodeProps = $props();
  let { id, data }: NodeProps<ConcatNodeType> = props;
 
  const nodes = useNodes();
  const edges = useEdges();

  const getTextFromNode = (nodeData: any): string => {
    return nodeData?.data?.text || '';
  };

  const getConnectedNodeText = (targetHandle: string, allEdges: any[], allNodes: Node[]) => {
    // Find edges that connect to this node's specific handle
    const connectedEdge = allEdges.find(edge => 
      edge.target === id && edge.targetHandle === targetHandle
    );
    
    if (!connectedEdge) return '';
    
    // Find the source node
    const sourceNode = allNodes.find(node => node.id === connectedEdge.source);
    
    return getTextFromNode(sourceNode);
  };
  
  const topText = $derived(getConnectedNodeText('top-input', edges.current, nodes.current));
  const bottomText = $derived(getConnectedNodeText('bottom-input', edges.current, nodes.current));
  const concatenatedText = $derived(topText && bottomText ? topText + " && " + bottomText : topText + bottomText);
</script>
 
<div class="custom-node">
  <Handle id="top-input" type="target" position={Position.Left} style="top: 30%;" />
  <Handle id="bottom-input" type="target" position={Position.Left} style="top: 70%;" />
  
  <div class="label">Concatenation:</div>
  
  <div class="inputs">
    <div class="input-row">
      <span class="input-label">Input 1:</span>
      <span class="input-value">{topText || 'not connected'}</span>
    </div>
    <div class="input-row">
      <span class="input-label">Input 2:</span>
      <span class="input-value">{bottomText || 'not connected'}</span>
    </div>
  </div>
  
  <div class="result">
    <span class="result-label">Result:</span>
    <span class="result-value">{concatenatedText}</span>
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