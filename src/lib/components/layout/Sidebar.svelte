<script lang="ts">
  import { getImportedNodes, setImportedNodes } from '../../stores/nodes.svelte'
  import { useDnD } from '../DnDProvider.svelte'
  import defaultNodes from '../../data/defaultNodes.json'
  import { nodeColors, type NodeData } from '../../types/nodeTypes'
  import { fade } from 'svelte/transition'
  import { sideBarState } from '../../stores/sidebar.svelte'

  let isMouseOver = $state(false)
  let leaveTimeout

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

  const handleMouseEnter = () => {
    leaveTimeout = setTimeout(() => {
      isMouseOver = true
    }, 400)
  }

  const handleMouseLeave = () => {
    clearTimeout(leaveTimeout)
    isMouseOver = false
  }
</script>

<aside onmouseenter={handleMouseEnter} onmouseleave={handleMouseLeave}>
  <div class="nodes-container">
    {#if availableNodesByType}
      <!-- TODO: move into separate function -->
      {#each Object.entries(availableNodesByType) as [nodeTypeName, arrNodesByType] (nodeTypeName)}
        {#each arrNodesByType as Array<NodeData> as node (node)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            style="--borderColor: {returnNodeColor(nodeTypeName)}"
            class="node"
            ondragstart={(event) => onDragStart(event, returnNodeType(node))}
            draggable={true}
          >
            {#if isMouseOver || sideBarState.isExpanded}
              <span transition:fade|global={{ duration: 250 }}
                >{returnNodeType(node)}</span
              >
            {/if}
          </div>
        {/each}
      {/each}
    {/if}
  </div>
</aside>

<style>
  aside {
    height: 100vh;
    background: var(--background-color-secondary);
    font-size: 1rem;
  }

  .nodes-container {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    padding-top: 10em;
    overflow-y: auto; /* Vertical scrollbar only when overflowing */
    overflow-x: hidden;
    gap: 1rem;
    padding: 3.5rem 1rem 2rem 1rem;
  }

  .node {
    padding: 0.5rem 1rem;
    margin: 0 1rem;
    border-radius: 5px;
    cursor: grab;
    border: 2px solid var(--borderColor, gray);
    background-color: var(--background-secondary-color);
  }

  .node:hover {
    border-color: var(--border-color-hover);
  }
</style>
