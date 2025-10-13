<script lang="ts">
  type ButtonVariant = 'default' | 'action' | 'delete'
  type ButtonType = 'button' | 'submit' | 'reset'

  let {
    variant = 'default',
    type = 'button',
    onclick,
    disabled = false,
    children,
  }: {
    variant?: ButtonVariant
    type?: ButtonType
    onclick?: () => any
    disabled?: boolean
    children?: () => any
  } = $props()
</script>

<button {type} class="btn btn-{variant}" {onclick} {disabled}>
  {@render children?.()}
</button>

<style>
  .btn {
    cursor: pointer;
    border-radius: 8px;
    padding: 1vh 1.5vh;
    font-size: 1rem;
    border: 1px solid;
    transition: all 0.2s ease;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-default {
    background-color: var(--secondary-color);
    border-color: var(--ternary-color);
    color: #383838;
  }

  .btn-default:hover:not(:disabled) {
    border-color: var(--border-color-hover);
  }

  .btn-action {
    background-color: var(--button-action-bg);
    border-color: var(--button-action-bg);
    color: white;
  }

  .btn-action:hover:not(:disabled) {
    background-color: var(--button-action-hover);
  }

  .btn-delete {
    background-color: var(--button-delete-bg);
    border-color: var(--button-delete-bg);
    color: white;
  }

  .btn-delete:hover:not(:disabled) {
    background-color: var(--button-delete-hover);
  }
</style>
