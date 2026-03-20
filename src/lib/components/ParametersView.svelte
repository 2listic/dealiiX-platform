<script lang="ts">
  type ParameterLeaf = {
    value: string
    default_value: string
    documentation: string
    pattern: string
    pattern_description: string
    actions?: string
  }

  type ParameterTree = {
    [key: string]: ParameterLeaf | ParameterTree
  }

  let parameters: ParameterTree | null = $state(null)
  // null! asserts non-null to TS — safe because bind:this assigns the element before any user interaction
  let fileInput: HTMLInputElement = $state(null!)

  function isLeaf(obj: unknown): obj is ParameterLeaf {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'value' in obj &&
      'pattern_description' in obj
    )
  }

  function loadFile(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        parameters = JSON.parse(e.target?.result as string)
      } catch {
        /* invalid JSON */
      }
    }
    reader.readAsText(file)
  }

  function parsePatternType(
    desc: string
  ): 'bool' | 'selection' | 'number' | 'text' {
    if (desc === '[Bool]') return 'bool'
    if (desc.startsWith('[Selection')) return 'selection'
    if (desc.startsWith('[Integer') || desc.startsWith('[Double'))
      return 'number'
    return 'text'
  }

  function getSelectionOptions(desc: string): string[] {
    const match = desc.match(/\[Selection\s+(.*?)\]/)
    if (!match) return []
    return match[1]
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  function downloadParameters() {
    if (!parameters) return
    const json = JSON.stringify($state.snapshot(parameters), null, 4)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template_parameters.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  $effect(() => {
    if (parameters) {
      console.log('parameters changed:', $state.snapshot(parameters))
    }
  })
</script>

<div class="parameters-view">
  {#if !parameters}
    <div class="empty-state">
      <input
        bind:this={fileInput}
        type="file"
        accept=".json"
        onchange={loadFile}
        hidden
      />
      <button class="load-button" onclick={() => fileInput.click()}>
        Load Parameters File
      </button>
    </div>
  {:else}
    <div class="toolbar">
      <input
        bind:this={fileInput}
        type="file"
        accept=".json"
        onchange={loadFile}
        hidden
      />
      <button class="load-button small" onclick={() => fileInput.click()}>
        Load File
      </button>
      <button class="load-button small" onclick={downloadParameters}>
        Download
      </button>
    </div>
    <div class="tree">
      {#snippet renderTree(tree: ParameterTree, depth: number)}
        {#each Object.entries(tree) as [key, val] (key)}
          {#if isLeaf(val)}
            {@const inputType = parsePatternType(val.pattern_description)}
            <div class="param-leaf">
              {#if val.documentation}
                <span class="param-doc" title={val.documentation}>i</span>
              {/if}
              <label title={val.documentation || undefined}>
                <span class="param-name">{key}</span>
                {#if inputType === 'bool'}
                  <input
                    type="checkbox"
                    checked={val.value === 'true'}
                    onchange={(e) => {
                      val.value = (e.target as HTMLInputElement).checked
                        ? 'true'
                        : 'false'
                    }}
                  />
                {:else if inputType === 'selection'}
                  <select
                    value={val.value}
                    onchange={(e) => {
                      val.value = (e.target as HTMLSelectElement).value
                    }}
                  >
                    {#each getSelectionOptions(val.pattern_description) as opt (opt)}
                      <option value={opt}>{opt}</option>
                    {/each}
                  </select>
                {:else if inputType === 'number'}
                  <input
                    type="number"
                    value={val.value}
                    step={val.pattern_description.startsWith('[Integer')
                      ? '1'
                      : 'any'}
                    onchange={(e) => {
                      val.value = (e.target as HTMLInputElement).value
                    }}
                  />
                {:else}
                  <input
                    type="text"
                    value={val.value}
                    onchange={(e) => {
                      val.value = (e.target as HTMLInputElement).value
                    }}
                  />
                {/if}
              </label>
            </div>
          {:else}
            <details open={depth < 1}>
              <summary>{key}</summary>
              <div class="section-content">
                {@render renderTree(val as ParameterTree, depth + 1)}
              </div>
            </details>
          {/if}
        {/each}
      {/snippet}

      {@render renderTree(parameters, 0)}
    </div>
  {/if}
</div>

<style>
  .parameters-view {
    width: 100%;
    height: 100%;
    background-color: var(--background-color);
    overflow-y: auto;
    color: var(--ternary-color);
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .toolbar {
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--xy-edge-stroke, #ccc);
  }

  .load-button {
    padding: 0.6rem 1.2rem;
    background: var(--primary-color);
    color: var(--ternary-color);
    border: 1px solid var(--xy-edge-stroke, #ccc);
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }

  .load-button.small {
    padding: 0.3rem 0.8rem;
    font-size: 0.85rem;
  }

  .load-button:hover {
    background: var(--background-color-secondary);
  }

  .tree {
    padding: 0.5rem 1rem;
  }

  details {
    margin: 0.25rem 0;
  }

  summary {
    cursor: pointer;
    font-weight: 600;
    padding: 0.4rem 0.25rem;
    border-radius: 3px;
    user-select: none;
  }

  summary:hover {
    background: var(--background-color-secondary);
  }

  .section-content {
    padding-left: 1rem;
    border-left: 1px solid var(--xy-edge-stroke, #333);
    margin-left: 0.5rem;
  }

  @media (min-width: 900px) {
    /* only apply when viewport is ≥ 900px */
    .section-content {
      display: grid;
      grid-template-columns: 1fr 1fr; /* two equal-width columns */
      column-gap: 1.5rem;
    }

    .section-content :global(details) {
      /* :global() needed because <details> is in a snippet */
      grid-column: 1 / -1; /* make <details> span from column 1 to the last column */
    }
  }

  .param-leaf {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.25rem;
  }

  .param-leaf label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  .param-name {
    flex: 1 1 50%;
    font-size: 0.85rem;
  }

  .param-leaf input[type='text'],
  .param-leaf input[type='number'],
  .param-leaf select {
    flex: 1 1 50%;
    padding: 0.25rem 0.4rem;
    background: var(--primary-color);
    color: var(--ternary-color);
    border: 1px solid var(--xy-edge-stroke, #555);
    border-radius: 3px;
    font-size: 0.85rem;
    min-width: 0;
  }

  .param-leaf input[type='checkbox'] {
    width: 1rem;
    height: 1rem;
    margin-left: auto;
  }

  .param-doc {
    flex: 0 0 auto;
    width: 1.2rem;
    height: 1.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--primary-color);
    border: 1px solid var(--xy-edge-stroke, #555);
    font-size: 0.7rem;
    /* cursor: help; */
  }
</style>
