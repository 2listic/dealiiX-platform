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

  const toggleExpandSidebar = () => sideBarState.toggle()
</script>

<aside onmouseenter={handleMouseEnter} onmouseleave={handleMouseLeave}>
  <button
    id="button-sidebar-expansion"
    title="Toggle between fixed and collapsible menu"
    onclick={toggleExpandSidebar}
  >
    {#if sideBarState.isExpanded}
      <svg
        width="20px"
        height="20px"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M13 5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44772 11 5C11 5.55228 11.4477 6 12 6C12.5523 6 13 5.55228 13 5Z"
          stroke="#000000"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13C12.5523 13 13 12.5523 13 12Z"
          stroke="#000000"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M13 19C13 18.4477 12.5523 18 12 18C11.4477 18 11 18.4477 11 19C11 19.5523 11.4477 20 12 20C12.5523 20 13 19.5523 13 19Z"
          stroke="#000000"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    {:else}
      <svg
        width="20px"
        height="20px"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4 17H20M4 12H20M4 7H20"
          stroke="#000000"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    {/if}
  </button>
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

  #button-sidebar-expansion {
    position: absolute;
    top: 0;
    left: 0;
    margin: 5px;
    background-color: var(--background-color-secondary);
    border: 1px solid grey;
    border-radius: 5px;
    cursor: pointer;
  }
  #button-sidebar-expansion:hover {
    border-color: var(--border-color-hover);
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
