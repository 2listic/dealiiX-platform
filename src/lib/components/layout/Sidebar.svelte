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
    type NodeType,
    type NodeDefinitions,
    type SubGraphNodeDefinition,
  } from '../../types/nodeTypes'
  import { returnNodeName } from '../../utils/canvasNodeUtils'
  import {
    groupNodesByClass,
    type NodePaletteGroup,
  } from '../../utils/nodePalette'
  import { createOverloadNodeDefinition } from '../../utils/overloadResolution'
  import { fade } from 'svelte/transition'
  import { sideBarState } from '../../stores/sidebar.svelte'
  import { toastState } from '../../stores/toastsStore.svelte'

  let isMouseOver = $state(false)
  const showNodeNames = $derived(isMouseOver || sideBarState.isExpanded)

  const availableNodes = $derived(getAvailableNodes())
  const storedNetworkNodes = $derived(getStoredNetworkNodes())

  let searchQuery = $state('')
  const filteredAvailableNodes = $derived(
    availableNodes?.filter((node) => {
      if (HIDDEN_SIDEBAR_NODE_TYPES.includes(node.node_type)) return false
      const query = searchQuery.toLowerCase()
      return [
        node.type,
        node.operation,
        node.display_name,
        node.variant_name,
        node.class_name,
        node.method_name,
        node.overload_group,
        node.description,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    }) ?? []
  )
  const availableNodeItems = $derived(groupNodesByClass(filteredAvailableNodes))

  const classMethodLabel = (
    className: string,
    group: NodePaletteGroup
  ): string => `${className} -> ${group.methodName ?? group.displayName}`

  const onDragStart = (
    event: DragEvent,
    node: NodeDefinitions,
    defaultName?: string
  ) => {
    if (!event.dataTransfer) {
      return
    }
    dndNodeDataState.current = defaultName
      ? ({ ...node, name: defaultName } as NodeDefinitions)
      : node
    event.dataTransfer.effectAllowed = 'move'
  }

  const returnNodeColor = (nodeTypeName: NodeType) => {
    return nodeColors[nodeTypeName as keyof typeof nodeColors] ?? 'gray'
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
  data-testid="sidebar"
  onmouseenter={() => (isMouseOver = true)}
  onmouseleave={() => (isMouseOver = false)}
>
  <div
    class="nodes-container"
    style:overflow-y={showNodeNames ? 'auto' : 'hidden'}
  >
    {#if storedNetworkNodes && storedNetworkNodes.length > 0}
      {#each storedNetworkNodes as Array<SubGraphNodeDefinition> as node (node)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          style="--borderColor: {returnNodeColor(node.node_type)}"
          class="node"
          data-testid="sidebar-node"
          data-node-type={node.node_type}
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
    {#if availableNodes}
      {#if showNodeNames}
        <input
          class="search-input"
          data-testid="sidebar-search"
          type="text"
          placeholder="Filter by type..."
          bind:value={searchQuery}
          transition:fade|global={{ duration: 250 }}
        />
      {/if}
      {#each availableNodeItems as item (item.key)}
        {#if item.kind === 'class'}
          <section
            class="class-group"
            data-testid="sidebar-node-class"
            data-class-name={item.displayName}
          >
            {#if showNodeNames}
              <div
                class="class-label"
                transition:fade|global={{ duration: 250 }}
              >
                {item.displayName}
              </div>
            {/if}
            {#each item.groups as group (group.key)}
              {@const methodLabel = classMethodLabel(item.displayName, group)}
              {@const paletteNode =
                group.nodes.length > 1
                  ? createOverloadNodeDefinition(
                      group.nodes,
                      group.key,
                      methodLabel
                    )
                  : group.nodes[0]}
              <div class="node-group">
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  style="--borderColor: {returnNodeColor(
                    paletteNode.node_type
                  )}"
                  class="node"
                  data-testid="sidebar-node"
                  data-node-type={paletteNode.node_type}
                  data-operation={group.operation ?? undefined}
                  data-overload-group={group.overloadGroup ?? undefined}
                  ondragstart={(event) =>
                    onDragStart(event, paletteNode, methodLabel)}
                  draggable={true}
                >
                  {#if showNodeNames}
                    <span transition:fade|global={{ duration: 250 }}>
                      {methodLabel}
                    </span>
                  {/if}
                </div>
              </div>
            {/each}
          </section>
        {:else}
          {@const group = item.group}
          {@const paletteNode =
            group.nodes.length > 1
              ? createOverloadNodeDefinition(
                  group.nodes,
                  group.key,
                  group.displayName
                )
              : group.nodes[0]}
          <div class="node-group">
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              style="--borderColor: {returnNodeColor(paletteNode.node_type)}"
              class="node"
              data-testid="sidebar-node"
              data-node-type={paletteNode.node_type}
              data-operation={group.operation ?? undefined}
              data-overload-group={group.overloadGroup ?? undefined}
              ondragstart={(event) =>
                onDragStart(event, paletteNode, group.displayName)}
              draggable={true}
            >
              {#if showNodeNames}
                <span transition:fade|global={{ duration: 250 }}>
                  {group.displayName}
                </span>
              {/if}
            </div>
          </div>
        {/if}
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

  .node-group {
    display: contents;
  }

  .class-group {
    display: flex;
    width: 100%;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-start;
    gap: 0.75rem;
    padding: 0.35rem 0 0.75rem;
    border-top: 1px solid
      color-mix(in srgb, var(--ternary-color) 35%, transparent);
  }

  .class-label {
    width: 100%;
    padding-left: 0.25rem;
    color: var(--ternary-color);
    font-weight: 600;
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

  .node {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    margin: 0;
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
