<script lang="ts">
  import { setImportedData } from '../../states/store.svelte'
  import { MethodName, Type } from '../../types/nodeTypes'
  import { useDnD } from '../DnDProvider.svelte'
 
  const type = useDnD()
 
  const onDragStart = (event: DragEvent, nodeType: string) => {
    if (!event.dataTransfer) {
      return null
    }
 
    type.current = nodeType
 
    event.dataTransfer.effectAllowed = 'move'
  }

  let json = $state()
	
	async function onChange(e) {
	  const file = e.target.files[0]
	  if (file == null) {
	    json = null
	    return
	  }
		
	  json = await readJsonFile(file)
	  console.log(json)
	  setImportedData(json)
	}

	function readJsonFile(file) {
	  const reader = new FileReader()
	  return new Promise((resolve, reject) => {
	    reader.onload = () => resolve(JSON.parse(reader.result as string))
	    reader.onerror = reject
	    reader.readAsText(file)
	  })
	}
</script>

<aside>
  <div class= "nodes-container">
    <div class="label">Upload an import file to load the nodes to be drag in the canvas below.</div>
    <input type=file onchange={onChange} accept=".json"/>
  </div>
  <div class="nodes-container">
    <div role="option" aria-selected="false" tabindex="0"
      class="node"
      ondragstart={(event) => onDragStart(event, Type.UNSIGNED)}
      draggable={true}
    >
      Unsigned
    </div>
    <div role="option" aria-selected="false" tabindex="0"
      class="node"
      ondragstart={(event) => onDragStart(event, Type.TRIANGULATION22)}
      draggable={true}
    >
      Triangulation&lt;2, 2&gt;
    </div>
    <div role="option" aria-selected="false" tabindex="0"
      class="node"
      ondragstart={(event) => onDragStart(event, MethodName.TRIANGULATION2_REFINEGLOBAL)}
      draggable={true}
    >
      triangulation&lt;2&gt;::refine_global
    </div>
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
    /* margin: 1rem 1rem 0 0; */
    font-size: 0.9rem;
  }
 
  .nodes-container {
    display: flex;
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