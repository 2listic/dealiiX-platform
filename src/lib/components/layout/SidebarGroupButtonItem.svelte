<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    label,
    onclick,
    icon,
  }: {
    label: string
    onclick?: () => void
    icon?: Snippet
  } = $props()
</script>

<button class="popover-item" {onclick}>
  {#if icon}
    <span class="popover-item-icon">
      {@render icon()}
    </span>
  {/if}
  <span>{label}</span>
</button>

<style>
  .popover-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--ternary-color);
    font-size: 0.85rem;
    cursor: pointer;
    white-space: nowrap;
    width: 100%;
    text-align: left;
  }

  .popover-item:hover {
    border: 1px solid var(--border-color-hover);
    border-radius: 5px;
  }

  .popover-item-icon {
    display: flex;
    align-items: center;
    width: 20px;
    height: 20px;
  }
</style>
