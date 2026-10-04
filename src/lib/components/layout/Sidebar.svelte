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
    groupNodesByFamily,
    groupNodesByOperation,
    nodePaletteChildName,
    nodePaletteNodeName,
    type NodePaletteGroup,
  } from '../../utils/nodePalette'
  import { createOverloadNodeDefinition } from '../../utils/overloadResolution'
  import { fade } from 'svelte/transition'
  import { sideBarState } from '../../stores/sidebar.svelte'
  import { toastState } from '../../stores/toastsStore.svelte'

  let isMouseOver = $state(false)
  const showNodeNames = $derived(isMouseOver || sideBarState.isExpanded)

  type CollapseMode = 'auto' | 'on' | 'off'
  let groupCollapseModes = $state<Record<string, CollapseMode>>({})

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
        node.overload_group,
        node.description,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    }) ?? []
  )
  const availableNodeGroups = $derived(
    groupNodesByOperation(filteredAvailableNodes)
  )

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

  const isCollapsibleGroup = (group: NodePaletteGroup): boolean =>
    Boolean(group.family || group.operation || group.overloadGroup)

  const collapseMode = (group: NodePaletteGroup): CollapseMode =>
    groupCollapseModes[group.key] ?? 'auto'

  const collapseModeLabel = (mode: CollapseMode): string => {
    if (mode === 'on') return 'Sempre chiusa'
    if (mode === 'off') return 'Sempre aperta'
    return 'Automatica: aperta al passaggio del mouse'
  }

  const toggleCollapseMode = (group: NodePaletteGroup) => {
    const current = collapseMode(group)
    groupCollapseModes[group.key] =
      current === 'auto' ? 'on' : current === 'on' ? 'off' : 'auto'
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
      <div class="separator"></div>
    {/if}
    {#if availableNodes}
      {#if showNodeNames}
        <span class="section-label" transition:fade|global={{ duration: 250 }}
          >Registry Nodes</span
        >
        <input
          class="search-input"
          data-testid="sidebar-search"
          type="text"
          placeholder="Filter by type..."
          bind:value={searchQuery}
          transition:fade|global={{ duration: 250 }}
        />
      {/if}
      {#each availableNodeGroups as group (group.key)}
        {@const collapsible = isCollapsibleGroup(group)}
        {@const mode = collapseMode(group)}
        <div
          class="node-group"
          class:family-group={Boolean(group.family)}
          class:collapsible-group={collapsible}
          class:collapse-on={mode === 'on'}
          class:collapse-off={mode === 'off'}
          class:family-filtered={Boolean(searchQuery.trim())}
        >
          {#if showNodeNames && (group.nodes.length > 1 || group.family || group.operation || group.overloadGroup)}
            <div class="family-heading">
              <span
                class="operation-label"
                data-operation={group.operation ?? undefined}
                data-family={group.family ?? undefined}
                data-overload-group={group.overloadGroup ?? undefined}
                transition:fade|global={{ duration: 250 }}
                >{group.displayName}</span
              >
              {#if collapsible}
                <button
                  type="button"
                  class="collapse-toggle"
                  class:collapse-toggle-on={mode === 'on'}
                  class:collapse-toggle-off={mode === 'off'}
                  title={`${collapseModeLabel(mode)}. Clicca per cambiare`}
                  aria-label={`${group.displayName}: ${collapseModeLabel(mode)}. Clicca per cambiare`}
                  onclick={(event) => {
                    event.stopPropagation()
                    toggleCollapseMode(group)
                  }}
                  onmousedown={(event) => event.stopPropagation()}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    {#if mode === 'on'}
                      <path d="m8 5 5 5-5 5" />
                    {:else if mode === 'off'}
                      <path d="m5 8 5 5 5-5" />
                    {:else}
                      <circle cx="10" cy="10" r="6.5" />
                      <text
                        class="auto-label"
                        x="10"
                        y="13.5"
                        text-anchor="middle">A</text
                      >
                    {/if}
                  </svg>
                </button>
              {/if}
            </div>
          {/if}
          <div
            class:family-nodes={Boolean(group.family)}
            class:collapsible-nodes={collapsible}
          >
            {#if group.family}
              {#each groupNodesByFamily(group.nodes) as family (family.key)}
                <div class="class-family">
                  <span class="class-family-label">{family.displayName}</span>
                  {#each family.subgroups as subgroup (subgroup.key)}
                    <div class="subfamily-group">
                      {#if subgroup.displayName}
                        <span class="subfamily-label"
                          >{subgroup.displayName}</span
                        >
                      {/if}
                      <div class="subfamily-nodes">
                        {#each subgroup.nodes as node (node.type)}
                          <!-- svelte-ignore a11y_no_static_element_interactions -->
                          <div
                            style="--borderColor: {returnNodeColor(
                              node.node_type
                            )}"
                            class="node"
                            data-testid="sidebar-node"
                            data-node-type={node.node_type}
                            data-family={group.family}
                            data-class-family={family.displayName}
                            data-subfamily={subgroup.displayName}
                            ondragstart={(event) =>
                              onDragStart(event, node, returnNodeName(node))}
                            draggable={true}
                          >
                            {#if showNodeNames}
                              <span transition:fade|global={{ duration: 250 }}>
                                {nodePaletteChildName(node)}
                              </span>
                            {/if}
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/each}
                </div>
              {/each}
            {:else if group.operation || group.overloadGroup}
              {@const overloadNode =
                group.nodes.length > 1
                  ? createOverloadNodeDefinition(group.nodes)
                  : group.nodes[0]}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                style="--borderColor: {returnNodeColor(overloadNode.node_type)}"
                class="node"
                data-testid="sidebar-node"
                data-node-type={overloadNode.node_type}
                data-operation={group.operation ?? undefined}
                data-overload-group={group.overloadGroup ?? undefined}
                ondragstart={(event) =>
                  onDragStart(
                    event,
                    overloadNode,
                    returnNodeName(overloadNode)
                  )}
                draggable={true}
              >
                {#if showNodeNames}
                  <span transition:fade|global={{ duration: 250 }}>
                    {group.displayName}
                  </span>
                {/if}
              </div>
            {:else}
              {#each group.nodes as node (node.type)}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  style="--borderColor: {returnNodeColor(node.node_type)}"
                  class="node"
                  data-testid="sidebar-node"
                  data-node-type={node.node_type}
                  data-operation={group.operation ?? undefined}
                  ondragstart={(event) =>
                    onDragStart(event, node, returnNodeName(node))}
                  draggable={true}
                >
                  {#if showNodeNames}
                    <span transition:fade|global={{ duration: 250 }}>
                      {nodePaletteNodeName(node, group.nodes.length > 1)}
                    </span>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
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

  .operation-label {
    min-width: 0;
    margin-top: 0.4rem;
    font-weight: 600;
  }

  .family-heading {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.35rem;
  }

  .family-heading .operation-label {
    flex: 1;
  }

  .node-group {
    display: contents;
  }

  .family-group {
    display: flex;
    width: 100%;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-start;
    gap: 0.5rem;
    text-align: left;
  }

  .family-group .operation-label {
    cursor: default;
    padding-left: 0.25rem;
    text-align: left;
  }

  .collapse-toggle {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: var(--ternary-color);
    cursor: pointer;
  }

  .collapse-toggle:hover,
  .collapse-toggle:focus-visible {
    border-color: var(--border-color-hover);
    outline: none;
  }

  .collapse-toggle svg {
    width: 1rem;
    height: 1rem;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
  }

  .collapse-toggle .auto-label {
    fill: currentColor;
    stroke: none;
    font-family: sans-serif;
    font-size: 0.55rem;
    font-weight: 700;
  }

  .subfamily-group {
    display: flex;
    width: 100%;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 0.5rem;
  }

  .class-family {
    display: flex;
    width: 100%;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 0.5rem;
  }

  .class-family-label {
    width: 100%;
    padding-left: 0.25rem;
    font-weight: 600;
    text-align: left;
  }

  .subfamily-label {
    width: 100%;
    font-weight: 600;
    padding-left: 1rem;
    text-align: left;
  }

  .subfamily-nodes {
    display: flex;
    width: 100%;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 0.75rem;
    padding-left: 2rem;
  }

  .collapsible-nodes {
    display: flex;
    width: 100%;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem;
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
    transition:
      max-height 0.25s ease,
      opacity 0.2s ease;
  }

  .collapsible-group:hover:not(.collapse-on) .collapsible-nodes,
  .collapsible-group.collapse-off .collapsible-nodes,
  .collapsible-group.family-filtered .collapsible-nodes {
    /* Let the outer palette grow and scroll instead of clipping long families. */
    max-height: 100000px;
    opacity: 1;
    pointer-events: auto;
    overflow: visible;
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
