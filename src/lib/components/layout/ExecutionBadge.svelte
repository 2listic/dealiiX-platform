<script lang="ts">
  import type {
    ExecutionLocation,
    BackendKind,
  } from '../../types/settingsTypes'

  interface Props {
    location: ExecutionLocation
    backendKind: BackendKind
  }

  let { location, backendKind }: Props = $props()
</script>

<div class="execution-badge">
  <span>{location}</span>
  <span class="badge-sep">·</span>
  <span>{backendKind}</span>
</div>

<style>
  .execution-badge {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.65rem;
    border-radius: 62rem;
    background: var(--primary-color);
    border: 1px solid color-mix(in srgb, var(--ternary-color) 30%, transparent);
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--ternary-color);
    white-space: nowrap;
  }

  .badge-sep {
    opacity: 0.45;
  }
</style>
