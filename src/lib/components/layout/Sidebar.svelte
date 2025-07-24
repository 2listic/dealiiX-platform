<script lang="ts">
  import { getImportedNodes, setImportedNodes } from '../../states/store.svelte'
  import { useDnD } from '../DnDProvider.svelte'
  import defaultNodes from '../../data/defaultNodes.json'
  import { nodeColors, type NodeData } from '../../types/nodeTypes'

  if (defaultNodes) {
    // TODO: add stantilization checks (i.e. empty object) and move into separate function
    setImportedNodes(defaultNodes)
  }
  const availableNodesByType = getImportedNodes()

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
    const importedNodes = await readJsonFile(file) // TODO: add sanitization checks
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

  const returnNodeType = (node) => {
    return 'method_name' in node ? node.method_name : node.type
  }
  const returnNodeColor = (nodeTypeName) => {
    return nodeColors[nodeTypeName]
  }
</script>

<aside>
  <div>
    <div class="label">
      Upload an import file to load the nodes to be drag in the canvas below.
    </div>
    <input type="file" onchange={onFileChange} accept=".json" />
  </div>
  <div class="nodes-container">
    {#if availableNodesByType}
      <!-- TODO: move into separate function -->
      {#each Object.entries(availableNodesByType) as [nodeTypeName, arrNodesByType] (nodeTypeName)}
        {#each arrNodesByType as Array<NodeData> as node (node)}
          <div
            style="--borderColor: {returnNodeColor(nodeTypeName)}"
            role="option"
            aria-selected="false"
            tabindex="0"
            class="node"
            ondragstart={(event) => onDragStart(event, returnNodeType(node))}
            draggable={true}
          >
            {returnNodeType(node)}
          </div>
        {/each}
      {/each}
    {/if}
  </div>
</aside>

<style>
  aside {
    height: 100vh;
    background: #efefef;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }

  .label {
    font-size: 0.9rem;
  }

  .nodes-container {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    overflow-y: auto; /* Vertical scrollbar only when overflowing */
    gap: 1rem;
    padding: 1rem;
    margin-top: 1rem;
  }

  .node {
    padding: 0.5rem 1rem;
    font-weight: bold;
    border-radius: 5px;
    cursor: grab;
    border: 2px solid var(--borderColor, gray);
    /* background-color: white; */
  }
</style>
