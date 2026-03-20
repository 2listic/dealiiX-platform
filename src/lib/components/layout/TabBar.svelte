<script lang="ts">
  type Tab = 'node-editor' | 'parameters'

  interface Props {
    activeTab: Tab
    onchange: (_tab: Tab) => void
  }

  let { activeTab, onchange }: Props = $props()

  const tabs: { key: Tab; label: string }[] = [
    { key: 'node-editor', label: 'Node Editor' },
    { key: 'parameters', label: 'Parameters' },
  ]
</script>

<div class="tab-bar">
  {#each tabs as tab, i (i)}
    <button
      class="tab-button"
      class:active={activeTab === tab.key}
      onclick={() => onchange(tab.key)}
    >
      {tab.label}
    </button>
  {/each}
</div>

<style>
  .tab-bar {
    display: flex;
    flex: 0 0 auto;
    background: var(--primary-color);
    border-top: 1px solid var(--xy-edge-stroke, #ccc);
  }

  .tab-button {
    padding: 0.75rem 1.5rem;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: clamp(0.9rem, 1.2vw, 1.1rem);
    color: var(--ternary-color);
    border-top: 0.2rem solid transparent;
  }

  .tab-button:hover {
    background: var(--background-color-secondary);
  }

  .tab-button.active {
    color: var(--ternary-color);
    border-top: 0.2rem solid var(--ternary-color);
    /* font-weight: 600; */
  }
</style>
