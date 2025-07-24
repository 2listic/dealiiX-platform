<script lang="ts">
  import { getImportedNodes, setImportedNodes } from '../../states/store.svelte'
  import { useDnD } from '../DnDProvider.svelte'
  import defaultNodes from '../../data/defaultNodes.json'
  import { nodeColors, type NodeData } from '../../types/nodeTypes'

  if (defaultNodes) {
    // TODO: add stantilization checks (i.e. empty object) and move into separate function
    setImportedNodes(defaultNodes)
  }
  const availableNodesByType = $derived(getImportedNodes())

  const type = useDnD()

  const onDragStart = (event: DragEvent, nodeType: string) => {
    if (!event.dataTransfer) {
      return null
    }
    type.current = nodeType
    event.dataTransfer.effectAllowed = 'move'
  }

  const returnNodeType = (node) => {
    return 'method_name' in node ? node.method_name : node.type
  }
  const returnNodeColor = (nodeTypeName) => {
    return nodeColors[nodeTypeName]
  }
</script>

<aside>
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
    font-size: 1rem;
  }

  .nodes-container {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    overflow-y: auto; /* Vertical scrollbar only when overflowing */
    gap: 1rem;
    padding: 2rem 1rem;
  }

  .node {
    padding: 0.5rem 1rem;
    border-radius: 5px;
    cursor: grab;
    border: 1px solid var(--borderColor, gray);
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    /* transition: background-color 0.2s ease; */
    background-color: white;
  }

  .node:hover {
    /* background-color: white; */
    border-color: #646cff;
  }
</style>
