<script module>
  import type { NodeData } from '../../types/nodeTypes'
  export type TriangulationRefineGlobalType = Node<NodeData, MethodName.TRIANGULATION2_REFINEGLOBAL>;
</script>
 
<script lang="ts">
  import {
    Handle,
    Position,
    type NodeProps,
    type Node,
  } from '@xyflow/svelte'
  import { ConnectionType, MethodName, NodeType, Type } from '../../types/nodeTypes'
 
  let { data }: NodeProps<TriangulationRefineGlobalType> = $props()
  
  data.arguments = [
    { 
      connection_type: ConnectionType.PASSTHROUGH,
      name: 'self',
      type: Type.TRIANGULATION22,
      type_hash: 'cb40d6a582660ec8'
    },
    {
      connection_type: ConnectionType.INPUT,
      name: 'n_refinements',
      type: Type.UNSIGNED,
      type_hash: 'b826a7e2a606584c'
    }
  ]
  data.inputs = [ 0, 1 ]
  data.method_name = MethodName.TRIANGULATION2_REFINEGLOBAL
  data.node_type = NodeType.VOID_METHOD
  data.outputs = [ 0 ]
  data.type = Type.VOID_TRIANGULATION22_UNSIGNED
  data.type_hash = `cb40d6a582660ec8${MethodName.TRIANGULATION2_REFINEGLOBAL}`
  // TODO: validate all inputs are connected
  data.is_valid = true
</script>
 
<div class="custom-node">
  <Handle id="input-0" type="target" position={Position.Left} style="top: 40%;" />
  <Handle id="input-1" type="target" position={Position.Left} style="top: 70%;" />
  <Handle id="output-0" type="source" position={Position.Right} style="top: 40%;"/>

  <div class="label">triangulation&lt;2&gt;::refine_global</div>

   <div class="inputs">
    <div class="input-column">
      <div class="input-label">Input 0 / Output 0 </div>
      <div class="input-type">{data.arguments[0].type}</div>
      <!-- <span class="input-value">{topText || 'not connected'}</span> -->
      <div class="input-label">Input 1 </div>
      <div class="input-type">{data.arguments[1].type}</div>
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
  }
  
  .input-column {
    display: flex;
    flex-direction: column;
    margin-bottom: 0.5vh;
  }

  .input-label {
    font-weight: bold;
    margin-top: 1vh;
  }

  .input-type {
    font-family: monospace;
  }
</style>