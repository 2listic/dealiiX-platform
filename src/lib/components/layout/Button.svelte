<script lang="ts">
  type ButtonVariant = 'default' | 'action' | 'delete'
  type ButtonType = 'button' | 'submit' | 'reset'
  type ButtonSize = 'small' | 'medium' | 'large'

  let {
    variant = 'default',
    type = 'button',
    size = 'medium',
    onclick,
    disabled = false,
    children,
  }: {
    variant?: ButtonVariant
    type?: ButtonType
    size?: ButtonSize
    onclick?: () => any
    disabled?: boolean
    children?: () => any
  } = $props()
</script>

<button {type} class="btn btn-{variant} btn-{size}" {onclick} {disabled}>
  {@render children?.()}
</button>

<style>
  .btn {
    cursor: pointer;
    border-radius: 8px;
    font-size: 1rem;
    border: 1px solid;
    transition: all 0.2s ease;
  }

  .btn-small {
    padding: 0.5vh 1vh;
    font-size: 0.8rem;
  }

  .btn-medium {
    padding: 1vh 1.5vh;
    font-size: 1rem;
  }

  .btn-large {
    padding: 1.5vh 2vh;
    font-size: 1.2rem;
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
