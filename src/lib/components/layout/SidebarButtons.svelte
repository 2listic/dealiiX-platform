<script lang="ts">
  import { setImportedNodes } from '../../states/store.svelte'
  import exportIcon from '@assets/upload-minimalistic.svg'
  import importIcon from '@assets/import.svg'
  import { useNodes, useEdges } from '@xyflow/svelte'
  import { exportGraph } from '../../utils/sshMessages'

  const currentNodes = useNodes()
  const currentEdges = useEdges()

  const handleUpload = async () => {
    try {
      await exportGraph(currentNodes.current, currentEdges.current)
    } catch (error) {
      console.error('Upload failed:', error)
    }
  }

  const onFileChange = async (e) => {
    const file = e.target.files[0]
    if (file == null) {
      return
    }
    const importedNodes = await readJsonFile(file) // TODO: add sanitization checks
    setImportedNodes(importedNodes)
  }

  const readJsonFile = (file) => {
    const reader = new FileReader()
    return new Promise((resolve, reject) => {
      reader.onload = () => resolve(JSON.parse(reader.result as string))
      reader.onerror = reject
      reader.readAsText(file)
    })
  }
</script>

<aside>
  <div class="button-group">
    <label
      for="export-graph"
      class="file-upload-label"
      title="Export JSON graph"
    >
      <img class="icon" src={exportIcon} alt="Export graph" />
    </label>
    <button
      id="export-graph"
      onclick={handleUpload}
      style="display: none"
      aria-label="Export graph"
    ></button>
    <span class="button-text">Export graph</span>
  </div>
  <div class="button-group">
    <label
      for="file-upload"
      class="file-upload-label"
      title="Import nodes from JSON file"
    >
      <img class="icon" src={importIcon} alt="Import nodes" />
    </label>
    <input
      id="file-upload"
      type="file"
      onchange={onFileChange}
      accept=".json"
      style="display: none"
    />
    <span class="button-text">Import nodes</span>
  </div>
</aside>

<style>
  aside {
    height: 100vh;
    background: white;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
  }

  .button-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem;
  }

  .file-upload-label {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 50px;
    height: 50px;
    background-color: white;
    border: 1px solid grey;
    border-radius: 10px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    margin: 10px;
    /* transition: border-color 0.2s ease; */
  }

  .icon {
    width: 3vh;
  }

  .file-upload-label:hover {
    border-color: #646cff;
  }

  .button-text {
    font-size: 0.8rem;
    color: rgb(81, 81, 81);
    text-align: center;
    font-weight: bold;
    line-height: 1.2;
  }
</style>
