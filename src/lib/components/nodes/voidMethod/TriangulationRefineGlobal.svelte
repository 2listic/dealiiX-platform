<script module>
  import type { NodeData } from '../../../types/nodeTypes'
  export type TriangulationRefineGlobalType = Node<NodeData, MethodName.TRIANGULATION2_REFINEGLOBAL>;
</script>
 
<script lang="ts">
  import {
    Handle,
    Position,
    type NodeProps,
    type Node,
  } from '@xyflow/svelte'
  import { ConnectionType, MethodName, NodeType, Type } from '../../../types/nodeTypes'
 
  let { data }: NodeProps<TriangulationRefineGlobalType> = $props()
  
  data.arguments = [
    { 
      connectionType: ConnectionType.PASSTHROUGH,
      name: 'self',
      type: Type.TRIANGULATION22,
      typeHash: 'cb40d6a582660ec8'
    },
    {
      connectionType: ConnectionType.INPUT,
      name: 'n_refinements',
      type: Type.UNSIGNED,
      typeHash: 'b826a7e2a606584c'
    }
  ]
  data.inputs = [ 0, 1 ]
  data.nodeType = NodeType.VOID_METHOD
  data.outputs = [ 0 ]
  data.type = Type.VOID_TRIANGULATION22_UNSIGNED
  data.typeHash = `cb40d6a582660ec8${MethodName.TRIANGULATION2_REFINEGLOBAL}`
  data.isValid = true
</script>
 
<div class="custom-node">
  <Handle id="input-0" type="target" position={Position.Left} style="top: 50%;" />
  <Handle id="input-1" type="target" position={Position.Left} style="top: 70%;" />
  <Handle id="output-0" type="source" position={Position.Right} />

  <div class="label">triangulation&lt;2&gt;::refine_global</div>

   <div class="inputs">
    <div class="input-row">
      <span class="input-label">Input 0: </span>
      <span class="input-type">{data.arguments[0].type}</span>
      <!-- <span class="input-value">{topText || 'not connected'}</span> -->
    </div>
    <div class="input-row">
      <span class="input-label">Input 1: </span>
      <span class="input-type">{data.arguments[1].type}</span>
      <!-- <span class="input-value">{bottomText || 'not connected'}</span> -->
    </div>
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
  
  .input-row {
    margin-bottom: 0.5vh;
  }

  .input-label {
    font-weight: bold;
  }

  .input-type {
    font-family: monospace;
  }
</style>