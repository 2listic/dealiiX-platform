<script module>
  export type ConcatNodeType = Node<{}, 'concat'>;
</script>
 
<script lang="ts">
  import {
    Handle,
    Position,
    useNodeConnections,
    useNodesData,
    type NodeProps,
    type Node,
  } from '@xyflow/svelte';

  let props: NodeProps = $props();
  let { id, data }: NodeProps<ConcatNodeType> = props;
 
  const connectionTop = useNodeConnections({
    handleId: 'top-input',
    handleType: 'target',
  });
  
  const connectionBottom = useNodeConnections({
    handleId: 'bottom-input',
    handleType: 'target',
  });
 
  const topNodesData = useNodesData(
    connectionTop.current.map((connection) => connection.source),
  );
  
  const bottomNodesData = useNodesData(
    connectionBottom.current.map((connection) => connection.source),
  );

  const getTextFromNode = (nodeData: any): string => {
    return nodeData?.data?.text || '';
  };
  
  const topText = $derived(topNodesData.current.length > 0 
    ? getTextFromNode(topNodesData.current[0]) 
    : '');
    
  const bottomText = $derived(bottomNodesData.current.length > 0 
    ? getTextFromNode(bottomNodesData.current[0]) 
    : '');
  
//   const topText = $derived(topNodesData.current.length > 0 ? topNodesData.current[0]?.data?.text || '' : '');
//   const bottomText = $derived(bottomNodesData.current.length > 0 ? bottomNodesData.current[0]?.data?.text || '' : '');
  const concatenatedText = $derived(topText + " && " + bottomText);
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