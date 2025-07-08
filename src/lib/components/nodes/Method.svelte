<script module>
  import type { NodeData } from '../../types/nodeTypes'
  export type Triangulation2RefineGlobalType = Node<NodeData, MethodName.TRIANGULATION2_REFINEGLOBAL>
  export type GridoutWriteWtk2 = Node<NodeData, MethodName.GRIDOUT_WRITEVTK2>
  export type MethodType = Triangulation2RefineGlobalType | GridoutWriteWtk2
</script>
 
<script lang="ts">
  import {
    Handle,
    Position,
    type NodeProps,
    type Node,
  } from '@xyflow/svelte'
  import { ConnectionType, Inputs, MethodName, NodeType, Outputs, Type } from '../../types/nodeTypes'
 
  let { data, type }: NodeProps<Triangulation2RefineGlobalType> = $props()
  
  //TODO: dinamically fill data and html based on import json
  switch (type) {
  case MethodName.TRIANGULATION2_REFINEGLOBAL:
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
    data.inputs = [ Inputs.ZERO, Inputs.ONE ]
    data.method_name = MethodName.TRIANGULATION2_REFINEGLOBAL
    data.node_type = NodeType.VOID_METHOD
    data.outputs = [ Outputs.ZERO ]
    data.type = Type.VOID_TRIANGULATION22_UNSIGNED
    data.type_hash = `cb40d6a582660ec8${MethodName.TRIANGULATION2_REFINEGLOBAL}`
    break
  case MethodName.GRIDOUT_WRITEVTK2:
    data.arguments = [
      { 
        connection_type: ConnectionType.INPUT,
        name: 'grid_out',
        type: Type.GRID_OUT,
        type_hash: 'd109334b934b9a76'
      },
      { 
        connection_type: ConnectionType.INPUT,
        name: 'triangulation',
        type: Type.TRIANGULATION22,
        type_hash: 'c95847e89853e6da'
      },
      {
        connection_type: ConnectionType.PASSTHROUGH,
        name: 'output_file',
        type: Type.STD_OUTSTREAM,
        type_hash: '296106717126417c'
      },
    ]
    data.inputs = [ Inputs.ZERO, Inputs.ONE, Inputs.TWO ]
    data.method_name = MethodName.GRIDOUT_WRITEVTK2
    data.node_type = NodeType.VOID_CONST_METHOD
    data.outputs = [ Outputs.ZERO ]
    data.type = Type.VOID_GRIDOUT_TRIANGULATION22CONST_STDOUTSTREAMCONST
    data.type_hash = `83fc561e6bc6214f${MethodName.GRIDOUT_WRITEVTK2}`
  }
  // TODO: validate all inputs are connected
  data.is_valid = true
</script>
 
<div class="custom-node">
  {#if type === MethodName.TRIANGULATION2_REFINEGLOBAL}
    <Handle id="input-0" type="target" position={Position.Left} style="top: 40%;" />
    <Handle id="input-1" type="target" position={Position.Left} style="top: 70%;" />
    <Handle id="output-0" type="source" position={Position.Right} style="top: 40%;"/>
  {:else if type === MethodName.GRIDOUT_WRITEVTK2}
    <Handle id="input-0" type="target" position={Position.Left} style="top: 30%;" />
    <Handle id="input-1" type="target" position={Position.Left} style="top: 55%;" />
    <Handle id="input-2" type="target" position={Position.Left} style="top: 78%;" />
    <Handle id="output-0" type="source" position={Position.Right} style="top: 78%;"/>
  {/if}


  <div class="label">{type}</div>

   <div class="inputs">
    <div class="input-column">
      {#if type === MethodName.TRIANGULATION2_REFINEGLOBAL}
        <div class="input-label">Input 0 / Output 0 </div>
        <div class="input-type">{data.arguments[0].type}</div>
        <!-- <span class="input-value">{topText || 'not connected'}</span> -->
        <div class="input-label">Input 1 </div>
        <div class="input-type">{data.arguments[1].type}</div>
        <!-- <span class="input-value">{bottomText || 'not connected'}</span> -->
      {:else if type === MethodName.GRIDOUT_WRITEVTK2}
        <div class="input-label">Input 0 </div>
        <div class="input-type">{data.arguments[0].type}</div>
        <!-- <span class="input-value">{topText || 'not connected'}</span> -->
        <div class="input-label">Input 1 </div>
        <div class="input-type">{data.arguments[1].type}</div>
        <!-- <span class="input-value">{topText || 'not connected'}</span> -->
        <div class="input-label">Input 2 / Output 0 </div>
        <div class="input-type">{data.arguments[2].type}</div>
        <!-- <span class="input-value">{topText || 'not connected'}</span> -->
      {/if}
    </div>
  </div>
</div>
<style>
  .custom-node {
    padding: 15px;
    border-radius: 5px;
    background: #EFEFEF;
    border: 2px solid orange;
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