<script lang="ts">
  interface Props {
    /** Current state; one-way, so a host can decline a change by resetting the box. */
    checked: boolean
    onchange?: (_event: Event) => void
    /** Text shown before the switch; clicking it toggles too. */
    label?: string
    /** Accessible name when there is no visible label. */
    ariaLabel?: string
    title?: string
    disabled?: boolean
    size?: 'normal' | 'small'
  }

  let {
    checked,
    onchange,
    label,
    ariaLabel,
    title,
    disabled = false,
    size = 'normal',
  }: Props = $props()
</script>

<label class="toggle" class:small={size === 'small'} class:disabled {title}>
  {#if label}<span class="toggle-label">{label}</span>{/if}
  <span class="switch">
    <input
      type="checkbox"
      {checked}
      {disabled}
      {onchange}
      aria-label={label ? undefined : ariaLabel}
    />
    <span class="slider"></span>
  </span>
</label>

<style>
  .toggle {
    --switch-width: 48px;
    --switch-height: 27px;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
  }

  .toggle.small {
    --switch-width: 30px;
    --switch-height: 17px;
  }

  .toggle.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .toggle-label {
    white-space: nowrap;
  }

  .switch {
    position: relative;
    flex: 0 0 auto;
    width: var(--switch-width);
    height: var(--switch-height);
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    inset: 0;
    border-radius: var(--switch-height);
    background-color: var(--slider-bg);
    transition: 0.4s;
  }

  .slider:before {
    position: absolute;
    content: '';
    left: 3px;
    bottom: 3px;
    width: calc(var(--switch-height) - 6px);
    height: calc(var(--switch-height) - 6px);
    border-radius: 50%;
    background-color: white;
    transition: 0.4s;
  }

  input:checked + .slider {
    background-color: var(--button-action-bg);
  }

  input:checked + .slider:before {
    transform: translateX(calc(var(--switch-width) - var(--switch-height)));
  }

  input:focus-visible + .slider {
    outline: 2px solid var(--link-color);
    outline-offset: 2px;
  }
</style>
