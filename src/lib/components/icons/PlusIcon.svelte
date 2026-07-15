<script lang="ts">
  let { width, height } = $props()
</script>

<svg
  {width}
  {height}
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <!-- stroke="currentColor" inherits the CSS `color` property, so the icon adapts to the theme -->
  <path
    d="M12 5V19M5 12H19"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
  />
</svg>
