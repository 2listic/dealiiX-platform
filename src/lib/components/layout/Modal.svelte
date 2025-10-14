<script module lang="ts">
  /**
   * Modal component
   * Props:
   * id (mandatory)
   * closeOnBackdropClick (optional, default: true)
   * children (optional) - the actual hmtl content
   * Description:
   * Open a modal by calling `open` on the modal object returned by `getModal` called with the modal's `id`.
   * You can pass a closing callback function to the `open` function, which will be called when the modal is closed.
   * Original example here: https://svelte.dev/playground/b95ce66b0ef34064a34afc5c0249f313
   * */

  //keeping track of which open modal is on top
  let onTop: HTMLDivElement | null = null

  //all modals get registered here for easy future access
  const modals: Record<string, ModalAPI> = {}

  type ModalAPI = {
    open: (callback?: (retVal?: any) => void) => void // eslint-disable-line
    close: (retVal?: any) => void // eslint-disable-line
    isVisible: () => boolean
  }

  export function getModal(id: string): ModalAPI | undefined {
    return modals[id]
  }
</script>

<script lang="ts">
  import { onDestroy } from 'svelte'

  let topDiv = $state<HTMLDivElement>()
  let visible = $state(false)
  let prevOnTop: HTMLDivElement | null = null
  let closeCallback: ((retVal: any) => void) | undefined // eslint-disable-line

  interface Props {
    id: string
    children?: import('svelte').Snippet
    closeOnBackdrop?: boolean
  }

  let { id, children, closeOnBackdrop = true }: Props = $props()

  function keyPress(ev: KeyboardEvent) {
    //only respond if the current modal is the top one (and pressing ESC)
    if (ev.key === 'Escape' && onTop === topDiv) {
      close(null)
    }
  }

  /**  API **/
  // eslint-disable-next-line
  function open(callback?: (retVal?: any) => void) {
    if (visible) return

    closeCallback = callback
    prevOnTop = onTop
    onTop = topDiv ?? null

    window.addEventListener('keydown', keyPress)

    //this prevents scrolling of the main window on larger screens
    document.body.style.overflow = 'hidden'

    visible = true

    // Move modal to end of body for proper z-index stacking
    if (topDiv) {
      document.body.appendChild(topDiv)
    }
  }

  function close(retVal?: any) {
    if (!visible) return

    window.removeEventListener('keydown', keyPress)
    onTop = prevOnTop

    if (onTop === null) document.body.style.overflow = ''

    visible = false
    if (closeCallback) closeCallback(retVal)
  }

  function isVisible() {
    return visible
  }

  function handleBackdropClick() {
    if (closeOnBackdrop) {
      close(null)
    }
  }

  // Expose the API
  modals[id] = { open, close, isVisible }

  onDestroy(() => {
    delete modals[id]
    window.removeEventListener('keydown', keyPress)
  })
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  id="topModal"
  class:visible
  bind:this={topDiv}
  onclick={handleBackdropClick}
>
  <div id="modal" onclick={(e) => e.stopPropagation()}>
    <svg id="close" onclick={() => close(null)} viewBox="0 0 12 12">
      <circle cx="6" cy="6" r="6" />
      <line x1="3" y1="3" x2="9" y2="9" />
      <line x1="9" y1="3" x2="3" y2="9" />
    </svg>
    <div id="modal-content">
      {@render children?.()}
    </div>
  </div>
</div>

<style>
  #topModal {
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

  #topModal.visible {
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
    /* min-width: 50vw;
    min-height: 50vh; */
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
