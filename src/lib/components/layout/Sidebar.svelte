<script lang="ts">
  import {
    addNetworkNode,
    getAvailableNodes,
    getStoredNetworkNodes,
    removeNetworkNode,
  } from '../../stores/nodes.svelte'
  import { dndNodeDataState } from '../../stores/dndStore.svelte'
  import {
    HIDDEN_SIDEBAR_NODE_TYPES,
    nodeColors,
    returnNodeName,
    type NetworkNodeOfTypeNetwork,
    type NodeData,
  } from '../../types/nodeTypes'
  import { fade } from 'svelte/transition'
  import { sideBarState } from '../../stores/sidebar.svelte'
  import { toastState } from '../../stores/toastsStore.svelte'

  let isMouseOver = $state(false)
  const showNodeNames = $derived(isMouseOver || sideBarState.isExpanded)

  const availableNodes = $derived(getAvailableNodes())
  const storedNetworkNodes = $derived(getStoredNetworkNodes())

  const onDragStart = (
    event: DragEvent,
    node: NodeData | NetworkNodeOfTypeNetwork
  ) => {
    if (!event.dataTransfer) {
      return null
    }
    dndNodeDataState.current = node
    event.dataTransfer.effectAllowed = 'move'
  }

  const returnNodeColor = (nodeTypeName) => {
    return nodeColors[nodeTypeName]
  }

  const handleDelete = async (networkNodeName) => {
    try {
      await removeNetworkNode(networkNodeName)
    } catch (e) {
      toastState.add({
        message: e.message || `Failed to delete node ${addNetworkNode}`,
        type: 'error',
      })
      console.error(`Failed to delete node ${addNetworkNode}`, e.message)
    }
  }
</script>

<aside
  onmouseenter={() => (isMouseOver = true)}
  onmouseleave={() => (isMouseOver = false)}
>
  <div class="nodes-container">
    {#if availableNodes}
      {#each availableNodes as Array<NodeData> as node (node)}
        {#if !HIDDEN_SIDEBAR_NODE_TYPES.includes(node.node_type)}
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
      {#each storedNetworkNodes as Array<NetworkNodeOfTypeNetwork> as node (node)}
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
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <svg
              class="close"
              onclick={() => handleDelete(node.name)}
              viewBox="0 0 12 12"
            >
              <circle cx="6" cy="6" r="6" />
              <line x1="3" y1="3" x2="9" y2="9" />
              <line x1="9" y1="3" x2="3" y2="9" />
            </svg>
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
    position: relative;
    padding: 0.5rem 1rem;
    margin: 0 1rem;
    border-radius: 5px;
    cursor: grab;
    border: 2px solid var(--borderColor, gray);
  }

  .node:hover {
    border-color: var(--border-color-hover);
  }

  .close {
    position: absolute;
    top: -10px;
    right: -10px;
    width: 20px;
    height: 20px;
    cursor: pointer;
    fill: #f44;
    transition: transform 0.3s ease;
  }

  .close:hover {
    transform: scale(1.5);
  }

  .close line {
    stroke: #fff;
    stroke-width: 2;
  }
</style>
