<script lang="ts">
  import { sideBarState } from '../../stores/sidebar.svelte'

  const toggleExpandSidebar = () => sideBarState.toggle()
</script>

<div id="button-sidebar-expansion-wrapper">
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
</div>

<style>
  #button-sidebar-expansion-wrapper {
    position: absolute;
    z-index: 101;
    top: 0;
    left: 0;
    min-width: var(--sidebar-wrapper-min-width);
    width: var(--sidebar-wrapper-width);
    height: 5vh;
  }

  #button-sidebar-expansion {
    position: absolute;
    z-index: 102;
    top: 0;
    left: 0;
    margin: 0.5rem;
    background-color: var(--background-color-secondary);
    border: 1px solid grey;
    border-radius: 5px;
    cursor: pointer;
  }
  #button-sidebar-expansion:hover {
    border-color: var(--border-color-hover);
  }
</style>
