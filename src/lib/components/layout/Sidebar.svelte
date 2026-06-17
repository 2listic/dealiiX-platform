<script lang="ts">
  import {
    getAvailableNodes,
    getStoredNetworkNodes,
    removeNetworkNode,
  } from '../../stores/registryStore.svelte'
  import { dndNodeDataState } from '../../stores/dndStore.svelte'
  import {
    HIDDEN_SIDEBAR_NODE_TYPES,
    nodeColors,
    type SubGraphNodeDefinition,
    type StandardNodeDefinition,
  } from '../../types/nodeTypes'
  import { returnNodeName } from '../../utils/canvasNodeUtils'
  import { fade } from 'svelte/transition'
  import { sideBarState } from '../../stores/sidebar.svelte'
  import { toastState } from '../../stores/toastsStore.svelte'

  let isMouseOver = $state(false)
  const showNodeNames = $derived(isMouseOver || sideBarState.isExpanded)

  const availableNodes = $derived(getAvailableNodes())
  const storedNetworkNodes = $derived(getStoredNetworkNodes())

  let searchQuery = $state('')
  const filteredAvailableNodes = $derived(
    availableNodes?.filter(
      (node) =>
        !HIDDEN_SIDEBAR_NODE_TYPES.includes(node.node_type) &&
        node.type.toLowerCase().includes(searchQuery.toLowerCase())
    ) ?? []
  )

  const onDragStart = (
    event: DragEvent,
    node: StandardNodeDefinition | SubGraphNodeDefinition
  ) => {
    if (!event.dataTransfer) {
      return
    }
    dndNodeDataState.current = node
    event.dataTransfer.effectAllowed = 'move'
  }

  const returnNodeColor = (nodeTypeName: keyof typeof nodeColors) => {
    return nodeColors[nodeTypeName]
  }

  const handleDelete = async (networkNodeName: string) => {
    try {
      await removeNetworkNode(networkNodeName)
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : `Failed to delete node ${networkNodeName}`
      toastState.add({ message: msg, type: 'error' })
      console.error(`Failed to delete node ${networkNodeName}`, msg)
    }
  }
</script>

<aside
  onmouseenter={() => (isMouseOver = true)}
  onmouseleave={() => (isMouseOver = false)}
>
  <div
    class="nodes-container"
    style:overflow-y={showNodeNames ? 'auto' : 'hidden'}
  >
    {#if storedNetworkNodes && storedNetworkNodes.length > 0}
      {#if showNodeNames}
        <span class="section-label" transition:fade|global={{ duration: 250 }}
          >Network Nodes</span
        >
      {/if}
      {#each storedNetworkNodes as Array<SubGraphNodeDefinition> as node (node)}
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
      <div class="separator"></div>
    {/if}
    {#if availableNodes}
      {#if showNodeNames}
        <span class="section-label" transition:fade|global={{ duration: 250 }}
          >Registry Nodes</span
        >
        <input
          class="search-input"
          type="text"
          placeholder="Filter by type..."
          bind:value={searchQuery}
          transition:fade|global={{ duration: 250 }}
        />
      {/if}
      {#each filteredAvailableNodes as Array<StandardNodeDefinition> as node (node)}
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
    display: flex;
    flex-direction: column;
    background: var(--background-color-secondary);
    font-size: 1rem;
  }

  .nodes-container {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    align-content: flex-start;
    padding-top: 10em;
    overflow-x: hidden;
    gap: 1rem;
    padding: 3.5rem 1rem 2rem 1rem;
    scrollbar-width: thin;
  }

  .section-label {
    width: 100%;
    font-weight: 600;
    text-transform: uppercase;
    text-align: left;
  }

  .search-input {
    width: 100%;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--ternary-color);
    border-radius: 4px;
    background: var(--background-color-secondary);
    color: var(--ternary-color);
    font-size: inherit;
    outline: none;
  }

  .search-input:focus {
    border-color: var(--border-color-hover);
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
    fill: var(--button-delete-bg);
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
