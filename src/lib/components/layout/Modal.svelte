<script module lang="ts">
  /**
   * @fileoverview Modal component registry and public API helpers (Svelte 5).
   *
   * This component registers each modal instance by a unique `id` so it can be
   * controlled imperatively from elsewhere in your app via `getModal(id)`.
   * Original example here: https://svelte.dev/playground/b95ce66b0ef34064a34afc5c0249f313
   *
   * Usage example:
   *   import Modal, { getModal } from '$lib/components/layout/Modal.svelte';
   *
   *   // In a component or module where you want to control the modal:
   *   const modal = getModal('modal-id')
   *   modal?.open()
   *
   *   // In your markup:
   *   // <Modal id="modal-id" closeOnBackdrop=true>
   *   //   <h2>Modal title</h2>
   *   //   <!-- ... -->
   *   // </Modal>
   */

  /** Tracks the DOM element for the modal that is currently on top (last opened). */
  let onTop: HTMLDivElement | null = null

  /** Global in-memory registry of modal APIs keyed by modal `id`. */
  const modals: Record<string, ModalAPI> = {}

  type ModalAPI = {
    /**
     * Open the modal.
     */
    open: () => void
    /**
     * Close the modal.
     */
    close: () => void
    /**
     * Whether the modal is currently visible.
     */
    isVisible: () => boolean
  }

  /**
   * Retrieve the imperative API for a modal by `id`.
   *
   * @param id Unique id used by the modal instance.
   * @returns The modal API if the instance is registered, otherwise `undefined`.
   *
   * @example
   * const modalApi = getModal('modal-id');
   * modalApi?.open();
   */
  export function getModal(id: string): ModalAPI | undefined {
    return modals[id]
  }
</script>

<script lang="ts">
  import { onDestroy } from 'svelte'
  import { fade, scale } from 'svelte/transition'

  /** Root element of this modal instance (bound via `bind:this`). */
  let topDiv = $state<HTMLDivElement>()
  /** Internal reactive visibility state for this instance. */
  let visible = $state(false)
  /** Previous topmost modal root, restored on close. */
  let prevOnTop: HTMLDivElement | null = null

  interface Props {
    /** Unique identifier used to register this modal in the global registry. */
    id: string

    /**
     * Optional renderable content snippet for the modal body.
     * Provide via the `children` prop, or use Svelte 5 snippets/slots as desired.
     */
    children?: import('svelte').Snippet

    /**
     * Whether clicking the backdrop closes the modal.
     * @default true
     */
    closeOnBackdrop?: boolean

    /**
     * Modal width size. Default is width adapts to content.
     * @optional
     */
    size?: 'sm' | 'md' | 'lg'
  }

  /** Destructure props with default values. */
  let { id, children, closeOnBackdrop = true, size }: Props = $props()

  function keyPress(ev: KeyboardEvent) {
    // only respond if the current modal is the top one (and pressing ESC)
    if (ev.key === 'Escape' && onTop === topDiv) {
      close()
    }
  }

  function open() {
    if (visible) return
    prevOnTop = onTop
    onTop = topDiv ?? null

    window.addEventListener('keydown', keyPress)

    // prevent scrolling of the main window on larger screens
    document.body.style.overflow = 'hidden'

    visible = true
  }

  function close() {
    if (!visible) return

    window.removeEventListener('keydown', keyPress)
    onTop = prevOnTop

    if (onTop === null) document.body.style.overflow = ''

    visible = false
  }

  function isVisible() {
    return visible
  }

  /**
   * Backdrop click handler: closes the modal when `closeOnBackdrop` is true.
   */
  function handleBackdropClick() {
    if (closeOnBackdrop) {
      close()
    }
  }

  /**
   * Register this instance in the global registry and expose its API.
   * This makes it accessible via `getModal(id)`.
   */
  modals[id] = { open, close, isVisible }

  /**
   * Cleanup on component destroy:
   * - Unregister from the registry.
   * - Detach event listeners.
   */
  onDestroy(() => {
    delete modals[id]
    window.removeEventListener('keydown', keyPress)
  })
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if visible}
  <div
    {id}
    class="modal-backdrop"
    class:visible
    bind:this={topDiv}
    onclick={handleBackdropClick}
    transition:fade={{ duration: 150 }}
  >
    <div
      id="modal"
      class={size ?? ''}
      transition:scale={{ duration: 200, start: 0.95 }}
      onclick={(e) => e.stopPropagation()}
    >
      <svg id="close" onclick={() => close()} viewBox="0 0 12 12">
        <circle cx="6" cy="6" r="6" />
        <line x1="3" y1="3" x2="9" y2="9" />
        <line x1="9" y1="3" x2="3" y2="9" />
      </svg>
      <div id="modal-content">
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    /* visibility: hidden; */
    display: none;
    z-index: 9998;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #4448;
    align-items: center;
    justify-content: center;
  }

  .modal-backdrop.visible {
    /* visibility: visible !important; */
    display: flex;
  }

  #modal {
    position: relative;
    border-radius: 6px;
    background: var(--background-color-secondary);
    border: 1px solid var(--primary-color);
    /* filter: drop-shadow(1px 1px var(--primary-color)); */
    padding: 1em;
    min-width: 300px;
    /*min-height: 50vh; */
  }

  #modal.sm {
    width: 30vw;
  }

  #modal.md {
    width: 50vw;
  }

  #modal.lg {
    width: 80vw;
  }

  #close {
    position: absolute;
    top: -12px;
    right: -12px;
    width: 24px;
    height: 24px;
    cursor: pointer;
    fill: #f44;
    transition: transform 0.3s ease;
  }

  #close:hover {
    transform: scale(1.5);
  }

  #close line {
    stroke: #fff;
    stroke-width: 2;
  }

  #modal-content {
    max-width: calc(100vw - 20px);
    max-height: calc(100vh - 20px);
    overflow: auto;
  }
</style>
