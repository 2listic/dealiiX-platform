<script lang="ts">
  import {
    getAvailableNodes,
    getStoredNetworkNodes,
  } from '../../stores/nodes.svelte'
  import { dndNodeDataState } from '../../stores/dndStore.svelte'
  import {
    nodeColors,
    NodeType,
    returnNodeName,
    type NodeData,
  } from '../../types/nodeTypes'
  import { fade } from 'svelte/transition'
  import { sideBarState } from '../../stores/sidebar.svelte'

  let isMouseOver = $state(false)
  const showNodeNames = $derived(isMouseOver || sideBarState.isExpanded)

  const availableNodes = $derived(getAvailableNodes())
  const storedNetworkNodes = $derived(getStoredNetworkNodes())

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
            {#if showNodeNames}
              <span transition:fade|global={{ duration: 250 }}>
                {returnNodeName(node)}
              </span>
            {/if}
          </div>
        {/if}
      {/each}
    {/if}
    {#if storedNetworkNodes}
      <div class="separator"></div>
      {#each storedNetworkNodes as Array<NodeData> as node (node)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          style="--borderColor: {returnNodeColor(node.node_type)}"
          class="node"
          ondragstart={(event) => onDragStart(event, node)}
          draggable={true}
        >
          {#if showNodeNames}
            <span transition:fade|global={{ duration: 250 }}>
              {returnNodeName(node)}
            </span>
          {/if}
        </div>
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

  .separator {
    width: 100%;
    height: 0.5rem;
    transition: height 0.25s ease;
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
