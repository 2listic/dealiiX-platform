<script lang="ts">
  import { useNodes, useEdges } from '@xyflow/svelte';
  import { uploadGraphWithKey } from '../utils/sshMessages';
 
  const currentNodes = useNodes();
  const currentEdges = useEdges();

  const handleUpload = async () => {
    try {
      await uploadGraphWithKey(currentNodes.current, currentEdges.current);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };
</script>
 
<div >
  <button onclick={handleUpload}>Upload graph</button>
</div>