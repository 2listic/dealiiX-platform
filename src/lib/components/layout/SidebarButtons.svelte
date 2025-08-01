<script lang="ts">
  import {
    getEdges,
    getNodes,
    edgesFromProtocolToFlow,
    nodesFromProtocolToFlow,
    setEdges,
    setImportedNodes,
    setNodes,
    updateLastNodeId,
  } from '../../stores/nodes.svelte'
  import { exportGraph } from '../../utils/sshMessages'
  import Modal, { getModal } from './Modal.svelte'
  import LoginForm from '../LoginForm.svelte'
  import { auth } from '../../stores/auth.svelte'
  // import { saveItem, getItem } from '../../requests/items'

  const loginModalId = 'login-modal'
  const logoutModalId = 'logout-modal'
  const token = $derived(auth.token)
  const loginText = $derived.by(() => {
    return token ? 'Logout' : 'Login'
  })
  let importGraphFiles: FileList | null = $state()

  const handleLogin = () => {
    if (token) {
      auth.clearToken()
      getModal(logoutModalId).open()
      return
    } else {
      getModal(loginModalId).open()
      return
    }
  }

  const handleExport = async () => {
    try {
      await exportGraph(getNodes(), getEdges())
    } catch (error) {
      console.error('Upload failed:', error)
    }
  }

  const loadGraphFromFile = async () => {
    if (importGraphFiles == null || importGraphFiles.length == 0) {
      return
    }
    // reset nodes/edges before reading file asyncronously otherwise UI dose not update correctly
    setNodes([])
    setEdges([])
    const importedGraphAsText = await readFileAsText(importGraphFiles[0])
    const importedGraph = JSON.parse(importedGraphAsText)

    const importedNodes = importedGraph?.workflow?.nodes
    if (importedNodes == null) {
      console.error('No nodes found in imported graph')
      return
    }
    const importedEdges = importedGraph?.workflow?.edges
    if (importedEdges == null) {
      console.error('No edges found in imported graph')
      return
    }

    const parsedNodes = nodesFromProtocolToFlow(importedNodes)
    const parsedEdges = edgesFromProtocolToFlow(importedEdges)
    setNodes(parsedNodes)
    setEdges(parsedEdges)
    updateLastNodeId()
    console.log('imported graph nodes', getNodes())
    console.log('imported graph edges', getEdges())
  }

  const onFileChangeLoadNodes = async (e) => {
    // TODO: use bind:files instead
    const file = e.target.files[0]
    if (file == null) {
      return
    }
    // TODO: use readFileAsText instead of readJsonFile and add sanitization checks
    const importedNodes = await readJsonFile(file)
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

  const readFileAsText = (file) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsText(file)
    })

  // TODO: remove this check. This is just for debugging purposes
  $effect(() => {
    console.log('auth.token', auth.token)
  })
</script>

<aside>
  <div class="button-container">
    <label for="login-button" class="element-label" title={loginText}>
      <svg
        width="25px"
        height="25px"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8 7C9.65685 7 11 5.65685 11 4C11 2.34315 9.65685 1 8 1C6.34315 1 5 2.34315 5 4C5 5.65685 6.34315 7 8 7Z"
          fill="var(--ternary-color)"
        />
        <path
          d="M14 12C14 10.3431 12.6569 9 11 9H5C3.34315 9 2 10.3431 2 12V15H14V12Z"
          fill="var(--ternary-color)"
        />
      </svg>
    </label>
    <button
      id="login-button"
      onclick={handleLogin}
      style="display: none"
      aria-label="Login"
    ></button>
    <span class="button-text">
      {loginText}
    </span>
  </div>
  <Modal id={loginModalId}>
    <LoginForm modalId={loginModalId} />
  </Modal>
  <Modal id={logoutModalId}>
    <div style="padding: 0 1vh;">
      <h2>Logout</h2>
      <p>Logout was successful</p>
    </div>
  </Modal>
  <!-- <div class="button-container">
    <label
      for="save-graph-button"
      class="element-label"
      title="Save graph to the cloud"
    >
      <svg
        fill="var(--ternary-color)"
        width="30px"
        height="30px"
        viewBox="0 0 32 32"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M23.845 8.124c-1.395-3.701-4.392-6.045-8.921-6.045-5.762 0-9.793 4.279-10.14 9.86-2.778 0.889-4.784 3.723-4.784 6.933 0 3.93 3.089 7.249 6.744 7.249h2.889c0.552 0 1-0.448 1-1s-0.448-1-1-1h-2.889c-2.572 0-4.776-2.404-4.776-5.249 0-2.514 1.763-4.783 3.974-5.163l0.907-0.156-0.080-0.916-0.008-0.011c0-4.871 3.205-8.545 8.161-8.545 3.972 0 6.204 1.957 7.236 5.295l0.214 0.688 0.721 0.015c3.715 0.078 6.972 3.092 6.972 6.837 0 3.408-2.259 7.206-5.678 7.206h-2.285c-0.552 0-1 0.448-1 1s0.448 1 1 1l2.277-0.003c5-0.132 7.605-4.908 7.605-9.203 0-4.616-3.617-8.305-8.14-8.791zM16.75 16.092c-0.006-0.006-0.008-0.011-0.011-0.016l-0.253-0.264c-0.139-0.146-0.323-0.219-0.508-0.218-0.184-0.002-0.368 0.072-0.509 0.218l-0.253 0.264c-0.005 0.005-0.006 0.011-0.011 0.016l-3.61 3.992c-0.28 0.292-0.28 0.764 0 1.058l0.252 0.171c0.28 0.292 0.732 0.197 1.011-0.095l2.128-2.373v10.076c0 0.552 0.448 1 1 1s1-0.448 1-1v-10.066l2.199 2.426c0.279 0.292 0.732 0.387 1.011 0.095l0.252-0.171c0.279-0.293 0.279-0.765 0-1.058z"
        ></path>
      </svg>
    </label>
    <button
      id="save-graph-button"
      onclick={saveItem}
      style="display: none"
      aria-label="Save graph"
    ></button>
    <span class="button-text">Save Graph</span>
  </div>
  <div class="button-container">
    <label
      for="update-graph-button"
      class="element-label"
      title="Download graph from the cloud"
    >
      <svg
        fill="#000000"
        width="30px"
        height="30px"
        viewBox="0 0 32 32"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M23.845 8.125c-1.395-3.701-4.392-6.045-8.92-6.045-5.762 0-9.793 4.279-10.14 9.861-2.779 0.889-4.784 3.723-4.784 6.933 0 3.93 3.089 7.249 6.744 7.249h0.889c0.552 0 1-0.448 1-1s-0.448-1-1-1h-0.889c-2.572 0-4.776-2.404-4.776-5.249 0-2.515 1.763-4.783 3.974-5.163l0.907-0.156-0.081-0.917-0.008-0.011c0-4.871 3.206-8.545 8.162-8.545 3.972 0 6.204 1.957 7.236 5.295l0.213 0.688 0.721 0.015c3.715 0.078 6.971 3.092 6.971 6.837 0 3.408-2.259 7.206-5.679 7.206h-0.285c-0.552 0-1 0.448-1 1s0.448 1 1 1v-0.003c5-0.132 7.883-4.909 7.883-9.203-0.001-4.617-3.619-8.304-8.141-8.791zM20.198 24.233c-0.279-0.292-0.731-0.292-1.010-0l-2.2 2.427v-10.067c0-0.552-0.448-1-1-1s-1 0.448-1 1v10.076l-2.128-2.373c-0.28-0.292-0.732-0.355-1.011-0.063l-0.252 0.138c-0.28 0.293-0.28 0.765 0 1.057l3.61 3.992c0.005 0.005 0.006 0.012 0.011 0.017l0.253 0.265c0.14 0.146 0.324 0.219 0.509 0.218 0.183 0.001 0.368-0.072 0.507-0.218l0.253-0.265c0.005-0.005 0.008-0.011 0.012-0.017l3.701-4.055c0.279-0.292 0.279-0.639 0-0.932z"
        ></path>
      </svg>
    </label>
    <button
      id="update-graph-button"
      onclick={getItem}
      style="display: none"
      aria-label="Download graph"
    ></button>
    <span class="button-text">Download Graph</span>
  </div> -->
  <div class="button-container">
    <label
      for="export-graph-button"
      class="element-label"
      title="Export JSON graph"
    >
      <svg
        width="25px"
        height="25px"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M3 15C3 17.8284 3 19.2426 3.87868 20.1213C4.75736 21 6.17157 21 9 21H15C17.8284 21 19.2426 21 20.1213 20.1213C21 19.2426 21 17.8284 21 15"
          stroke="var(--ternary-color)"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M12 16V3M12 3L16 7.375M12 3L8 7.375"
          stroke="var(--ternary-color)"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </label>
    <button
      id="export-graph-button"
      onclick={handleExport}
      style="display: none"
      aria-label="Export graph"
    ></button>
    <span class="button-text">Export Graph</span>
  </div>
  <div class="button-container">
    <label
      for="import-graph-input"
      class="element-label"
      title="Import grpah from JSON file"
    >
      <svg
        width="30px"
        height="30px"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 14L11.2929 14.7071L12 15.4142L12.7071 14.7071L12 14ZM13 5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44771 11 5L13 5ZM6.29289 9.70711L11.2929 14.7071L12.7071 13.2929L7.70711 8.29289L6.29289 9.70711ZM12.7071 14.7071L17.7071 9.70711L16.2929 8.29289L11.2929 13.2929L12.7071 14.7071ZM13 14L13 5L11 5L11 14L13 14Z"
          fill="var(--ternary-color)"
          stroke-width="2"
        />
        <path
          d="M5 16L5 17C5 18.1046 5.89543 19 7 19L17 19C18.1046 19 19 18.1046 19 17V16"
          stroke="var(--ternary-color)"
          stroke-width="2"
        />
      </svg>
    </label>
    <input
      id="import-graph-input"
      type="file"
      onchange={loadGraphFromFile}
      accept=".json"
      bind:files={importGraphFiles}
      style="display: none"
    />
    <span class="button-text">Import Graph</span>
  </div>
  <div class="button-container">
    <label
      for="import-nodes-input"
      class="element-label"
      title="Import nodes from JSON file"
    >
      <svg
        width="30px"
        height="30px"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 14L11.2929 14.7071L12 15.4142L12.7071 14.7071L12 14ZM13 5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44771 11 5L13 5ZM6.29289 9.70711L11.2929 14.7071L12.7071 13.2929L7.70711 8.29289L6.29289 9.70711ZM12.7071 14.7071L17.7071 9.70711L16.2929 8.29289L11.2929 13.2929L12.7071 14.7071ZM13 14L13 5L11 5L11 14L13 14Z"
          fill="var(--ternary-color)"
          stroke-width="2"
        />
        <path
          d="M5 16L5 17C5 18.1046 5.89543 19 7 19L17 19C18.1046 19 19 18.1046 19 17V16"
          stroke="var(--ternary-color)"
          stroke-width="2"
        />
      </svg>
    </label>
    <input
      id="import-nodes-input"
      type="file"
      onchange={onFileChangeLoadNodes}
      accept=".json"
      style="display: none"
    />
    <span class="button-text">Load Nodes</span>
  </div>
</aside>

<style>
  aside {
    height: 100vh;
    background: var(--primary-color);
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
  }

  .button-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.5rem 0.3rem;
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
    margin: 0.5rem 0.2rem;
  }

  .element-label:hover {
    border-color: var(--border-color-hover);
  }

  .button-text {
    font-size: 0.8rem;
    color: var(--ternary-color);
    text-align: center;
    font-weight: bold;
    line-height: 1.2;
  }
</style>
