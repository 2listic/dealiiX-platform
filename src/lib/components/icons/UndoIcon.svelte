<script lang="ts">
  let { width = '24px', height = '24px' }: { width?: string; height?: string } =
    $props()
</script>

<svg
  {width}
  {height}
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <path
    d="M3 9h13a5 5 0 0 1 0 10H7"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <polyline
    points="7,5 3,9 7,13"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
