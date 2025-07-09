<script lang="ts">
  import { setImportedNodes } from '../../states/store.svelte'
  import { useDnD } from '../DnDProvider.svelte'
  import defaultNodes from '../../data/defaultNodes.json'
  import type { ImportedNodes } from '../../types/nodeTypes'
 
  let importedNodes: ImportedNodes | {} = $state(defaultNodes)
  setImportedNodes(defaultNodes)

  const type = useDnD()
 
  const onDragStart = (event: DragEvent, nodeType: string) => {
    if (!event.dataTransfer) {
      return null
    }
    type.current = nodeType
    event.dataTransfer.effectAllowed = 'move'
  }

	
	const onFileChange = async (e) => {
	  const file = e.target.files[0]
	  if (file == null) {
	    return
	  }
	  importedNodes = await readJsonFile(file)
	  setImportedNodes(importedNodes)
	}

	const readJsonFile = (file) => {
	  const reader = new FileReader()
	  return new Promise((resolve, reject) => {
	    reader.onload = () => resolve(JSON.parse(reader.result as string))
	    reader.onerror = reject
	    reader.readAsText(file)
	  })
	}

  const returnNodeType = (node) => node.node_type.includes('method') ? node.method_name : node.type
    
</script>

<aside>
  <div class= "nodes-container">
    <div class="label">Upload an import file to load the nodes to be drag in the canvas below.</div>
    <input type=file onchange={onFileChange} accept=".json"/>
  </div>
  <div class="nodes-container">
    {#if importedNodes}
      {#each Object.keys(importedNodes) as nodeId (nodeId)}
        <div role="option" aria-selected="false" tabindex="0"
        class="node"
        ondragstart={(event) => onDragStart(event, returnNodeType(importedNodes[nodeId]))}
        draggable={true}
        >
          {returnNodeType(importedNodes[nodeId])}
        </div>
      {/each}
    {/if}
  </div>
</aside>
 
<style>
  aside {
    width: 100%;
    background: #EFEFEF;
    padding: 1rem;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
 
  .label {
    font-size: 0.9rem;
  }
 
  .nodes-container {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin-top: 1rem;
  }
 
  .node {
    border: 1px solid #111;
    padding: 0.5rem 1rem;
    font-weight: 700;
    border-radius: 5px;
    cursor: grab;
  }
</style>