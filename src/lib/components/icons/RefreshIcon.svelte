<script lang="ts">
  let { width, height, rotation } = $props()
  let resolvedRotation = $derived.by(() =>
    typeof rotation === 'number' ? rotation : (rotation?.current ?? 0)
  )
</script>

<svg
  style="transform: rotate({resolvedRotation}deg); transition: transform 0.5s ease-out;"
  {width}
  {height}
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <!-- stroke="currentColor" inherits the CSS `color` property, so the icon adapts to the theme -->
  <path
    d="M3 3V8M3 8H8M3 8L6 5.29168C7.59227 3.86656 9.69494 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.71683 21 4.13247 18.008 3.22302 14"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
