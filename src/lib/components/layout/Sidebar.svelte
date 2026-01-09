<script lang="ts">
  import { getAvailableNodes, setRegistry } from '../../stores/nodes.svelte'
  import { dndNodeDataState } from '../../stores/dndStore.svelte'
  import defaultNodesJson from '../../data/defaultNodes.json'
  import {
    nodeColors,
    NodeType,
    returnNodeName,
    type NodeData,
    type RegisteredNodes,
  } from '../../types/nodeTypes'
  import { fade } from 'svelte/transition'
  import { sideBarState } from '../../stores/sidebar.svelte'

  const defaultNodes = defaultNodesJson as RegisteredNodes

  let isMouseOver = $state(false)

  if (defaultNodes) {
    setRegistry(defaultNodes)
  }
  const availableNodes = $derived(getAvailableNodes())

  const onDragStart = (event: DragEvent, node: NodeData) => {
    if (!event.dataTransfer) {
      return null
    }
    dndNodeDataState.current = node
    event.dataTransfer.effectAllowed = 'move'
  }

  const returnNodeColor = (nodeTypeName) => {
    return nodeColors[nodeTypeName]
  }
</script>

<aside
  onmouseenter={() => (isMouseOver = true)}
  onmouseleave={() => (isMouseOver = false)}
>
  <div class="nodes-container">
    {#if availableNodes}
      {#each availableNodes as Array<NodeData> as node (node)}
        {#if node.node_type != NodeType.ABSTRACT}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            style="--borderColor: {returnNodeColor(node.node_type)}"
            class="node"
            ondragstart={(event) => onDragStart(event, node)}
            draggable={true}
          >
            {#if isMouseOver || sideBarState.isExpanded}
              <span transition:fade|global={{ duration: 250 }}>
                {returnNodeName(node)}
              </span>
            {/if}
          </div>
        {/if}
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
  }

  .node:hover {
    border-color: var(--border-color-hover);
  }
</style>
