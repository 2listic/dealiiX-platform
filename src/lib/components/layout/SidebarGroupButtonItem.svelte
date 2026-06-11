<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    label,
    onclick,
    icon,
    disabled = false,
  }: {
    label: string
    onclick?: () => void
    icon?: Snippet
    disabled?: boolean
  } = $props()
</script>

<button class="popover-item" class:disabled {onclick} {disabled}>
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

  .popover-item:hover:not(.disabled) {
    border: 1px solid var(--border-color-hover);
    border-radius: 5px;
  }

  .popover-item.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .popover-item-icon {
    display: flex;
    align-items: center;
    width: 20px;
    height: 20px;
  }
</style>
