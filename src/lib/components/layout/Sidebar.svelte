<script lang="ts">
  import { useDnD } from '../DnDProvider.svelte'
 
  const type = useDnD()
 
  const onDragStart = (event: DragEvent, nodeType: string) => {
    if (!event.dataTransfer) {
      return null
    }
 
    type.current = nodeType
 
    event.dataTransfer.effectAllowed = 'move'
  }
</script>
 
<aside>
  <div class="label">You can drag these nodes to the pane below.</div>
  <div class="nodes-container">
    <div role="option" aria-selected="false" tabindex="0"
      class="node"
      on:dragstart={(event) => onDragStart(event, 'text')}
      draggable={true}
    >
      Text Node
    </div>
    <div role="option" aria-selected="false" tabindex="0"
      class="node"
      on:dragstart={(event) => onDragStart(event, 'bool')}
      draggable={true}
    >
      Bool Node
    </div>
  </div>
</aside>
 
<style>
  aside {
    width: 100%;
    background: #fff;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
 
  .label {
    margin: 1rem 0;
    font-size: 0.9rem;
  }
 
  .nodes-container {
    display: flex;
    align-items: center;
    justify-content: center;
  }
 
  .node {
    margin: 0.5rem;
    border: 1px solid #111;
    padding: 0.5rem 1rem;
    font-weight: 700;
    border-radius: 5px;
    cursor: grab;
  }
</style>