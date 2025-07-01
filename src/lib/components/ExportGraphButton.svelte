<script lang="ts">
  import { useNodes, useEdges } from '@xyflow/svelte'
  import { exportGraph } from '../utils/sshMessages'
 
  const currentNodes = useNodes()
  const currentEdges = useEdges()

  const handleUpload = async () => {
    try {
      await exportGraph(currentNodes.current, currentEdges.current)
    } catch (error) {
      console.error('Upload failed:', error)
    }
  }
</script>
 
<button onclick={handleUpload}>Export graph</button>