<script lang="ts">
  import { setImportedNodes } from '../../states/store.svelte'
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
    <label for="export-graph" class="element-label" title="Export JSON graph">
      <svg
        width="3vh"
        height="3vh"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M3 15C3 17.8284 3 19.2426 3.87868 20.1213C4.75736 21 6.17157 21 9 21H15C17.8284 21 19.2426 21 20.1213 20.1213C21 19.2426 21 17.8284 21 15"
          stroke="var(--text-color)"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M12 16V3M12 3L16 7.375M12 3L8 7.375"
          stroke="var(--text-color)"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
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
      class="element-label"
      title="Import nodes from JSON file"
    >
      <svg
        width="3vh"
        height="3vh"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 14L11.2929 14.7071L12 15.4142L12.7071 14.7071L12 14ZM13 5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44771 11 5L13 5ZM6.29289 9.70711L11.2929 14.7071L12.7071 13.2929L7.70711 8.29289L6.29289 9.70711ZM12.7071 14.7071L17.7071 9.70711L16.2929 8.29289L11.2929 13.2929L12.7071 14.7071ZM13 14L13 5L11 5L11 14L13 14Z"
          fill="var(--text-color)"
          stroke-width="2.5"
        />
        <path
          d="M5 16L5 17C5 18.1046 5.89543 19 7 19L17 19C18.1046 19 19 18.1046 19 17V16"
          stroke="var(--text-color)"
          stroke-width="2.5"
        />
      </svg>
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
    background: var(--primary-color);
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

  .element-label {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 50px;
    height: 50px;
    background-color: var(--background-color-secondary);
    border: 1px solid grey;
    border-radius: 10px;
    cursor: pointer;
    margin: 10px;
  }

  .element-label:hover {
    border-color: var(--border-color-hover);
  }

  .button-text {
    font-size: 0.8rem;
    color: var(--text-color);
    text-align: center;
    font-weight: bold;
    line-height: 1.2;
  }
</style>
