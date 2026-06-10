<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    title,
    icon,
    items,
    disabled = false,
  }: {
    title: string
    icon: Snippet
    items: Snippet
    disabled?: boolean
  } = $props()

  let isOpen = $state(false)
  let popoverEl: HTMLDivElement | undefined = $state()

  const toggle = () => {
    if (disabled) return
    isOpen = !isOpen
  }

  const handleClickOutside = (event: MouseEvent) => {
    if (popoverEl && !popoverEl.contains(event.target as Node)) {
      isOpen = false
    }
  }

  $effect(() => {
    if (isOpen) {
      document.addEventListener('click', handleClickOutside, true)
      return () =>
        document.removeEventListener('click', handleClickOutside, true)
    }
  })
</script>

<div class="popover-wrapper" bind:this={popoverEl}>
  <div class="button-container">
    <button
      class="element-label"
      class:disabled
      onclick={toggle}
      {title}
      {disabled}
    >
      {@render icon()}
    </button>
    <span class="button-text">{title}</span>
  </div>
  {#if isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="popover"
      role="menu"
      tabindex="-1"
      onclick={() => (isOpen = false)}
    >
      {@render items()}
    </div>
  {/if}
</div>

<style>
  .popover-wrapper {
    position: relative;
  }

  .button-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.3rem 0.3rem;
  }

  .element-label {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--btn-size);
    height: var(--btn-size);
    background-color: var(--background-color-secondary);
    border: 1px solid grey;
    border-radius: 10px;
    cursor: pointer;
    margin: 0.5rem 0.2rem;
    color: inherit;
  }

  .element-label:hover:not(.disabled) {
    border-color: var(--border-color-hover);
  }

  .element-label.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .button-text {
    font-size: 0.8rem;
    color: var(--ternary-color);
    text-align: center;
    font-weight: bold;
    line-height: 1.2;
    max-width: calc(var(--btn-size) + 15px);
    word-wrap: break-word;
  }

  .popover {
    position: absolute;
    left: calc(100% + 4px);
    top: 0;
    background: var(--primary-color);
    border: 1px solid grey;
    border-radius: 8px;
    padding: 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    z-index: 200;
    min-width: 140px;
    box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.3);
  }
</style>
