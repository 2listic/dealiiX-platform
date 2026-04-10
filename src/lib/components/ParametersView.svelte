<script lang="ts">
  import Button from './layout/Button.svelte'
  import { parametersState } from '../stores/parametersStore.svelte'
  import { settingsState } from '../stores/settingsStore.svelte'
  import { toastState } from '../stores/toastsStore.svelte'

  type ParameterLeaf = {
    value: string
    default_value: string
    documentation: string
    pattern: string
    pattern_description: string
    actions?: string
    __extra?: boolean
  }

  interface ParameterTree {
    __extra?: boolean
    [key: string]: ParameterLeaf | ParameterTree | boolean | undefined
  }

  type ParameterNode = ParameterLeaf | ParameterTree

  let parameters = $derived(parametersState.value)
  let fileInput: HTMLInputElement = $state(null)
  let executableMode = $derived(settingsState.isExecutableMode())
  let lastParametersFilePath = $state('')

  function isLeaf(obj: unknown): obj is ParameterLeaf {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'value' in obj &&
      'pattern_description' in obj
    )
  }

  function isTree(obj: unknown): obj is ParameterTree {
    return typeof obj === 'object' && obj !== null && !isLeaf(obj)
  }

  function isExtraNode(obj: unknown): boolean {
    return typeof obj === 'object' && obj !== null && '__extra' in obj
      ? Boolean((obj as { __extra?: boolean }).__extra)
      : false
  }

  function cloneLeaf(leaf: ParameterLeaf): ParameterLeaf {
    return { ...leaf }
  }

  function coerceUploadedLeaf(value: unknown): ParameterLeaf {
    if (isLeaf(value)) {
      return { ...value, __extra: true }
    }

    return {
      value: String(value ?? ''),
      default_value: String(value ?? ''),
      documentation: 'Imported from uploaded parameter file',
      pattern: '.*',
      pattern_description: '[Text]',
      __extra: true,
    }
  }

  function includeExtraNode(node: unknown): ParameterNode {
    if (isLeaf(node)) {
      return { ...node, __extra: true }
    }

    if (isTree(node)) {
      const entries = Object.entries(node)
        .filter(([key]) => key !== '__extra')
        .map(([key, value]) => [key, includeExtraNode(value)])
      return {
        __extra: true,
        ...Object.fromEntries(entries),
      } as ParameterTree
    }

    return coerceUploadedLeaf(node)
  }

  function mergeParametersTemplate(
    template: ParameterTree,
    uploaded: unknown,
    currentPath = '',
    includeExtras = false
  ): { merged: ParameterTree; extraPaths: string[] } {
    const extraPaths: string[] = []
    const mergedEntries: [string, ParameterNode][] = Object.entries(template)
      .filter(([key]) => key !== '__extra')
      .map(([key, templateValue]) => {
        const path = currentPath ? `${currentPath}.${key}` : key
        const uploadedValue =
          uploaded && typeof uploaded === 'object' && key in uploaded
            ? (uploaded as Record<string, unknown>)[key]
            : undefined

        if (isLeaf(templateValue)) {
          if (uploadedValue && isLeaf(uploadedValue)) {
            return [
              key,
              {
                ...cloneLeaf(templateValue),
                value: uploadedValue.value,
              },
            ]
          }
          if (
            uploadedValue !== undefined &&
            (typeof uploadedValue !== 'object' || uploadedValue === null)
          ) {
            return [
              key,
              {
                ...cloneLeaf(templateValue),
                value: String(uploadedValue),
              },
            ]
          }
          return [key, cloneLeaf(templateValue)]
        }

        const nestedUploaded =
          uploadedValue && typeof uploadedValue === 'object' ? uploadedValue : {}
        const nested = mergeParametersTemplate(
          templateValue as ParameterTree,
          nestedUploaded,
          path,
          includeExtras
        )
        extraPaths.push(...nested.extraPaths)
        return [
          key,
          isExtraNode(templateValue)
            ? { __extra: true, ...nested.merged }
            : nested.merged,
        ]
      })

    if (uploaded && typeof uploaded === 'object') {
      for (const [key, value] of Object.entries(uploaded as Record<string, unknown>)) {
        if (key === '__extra') continue
        if (!(key in template)) {
          extraPaths.push(currentPath ? `${currentPath}.${key}` : key)
          if (includeExtras) {
            mergedEntries.push([key, includeExtraNode(value)])
          }
        }
      }
    }

    return {
      merged: {
        ...(isExtraNode(template) ? { __extra: true } : {}),
        ...Object.fromEntries(mergedEntries),
      } as ParameterTree,
      extraPaths,
    }
  }

  function loadFile(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    lastParametersFilePath = window.electron?.getFilePath
      ? window.electron.getFilePath(file)
      : lastParametersFilePath
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string)
        if (!parametersState.snapshot) {
          parametersState.value = parsed
          return
        }

        const baseTemplate = parametersState.snapshot
        const initialMerge = mergeParametersTemplate(baseTemplate, parsed)
        let merged = initialMerge.merged
        const { extraPaths } = initialMerge

        if (extraPaths.length > 0) {
          const preview = extraPaths.slice(0, 5).join(', ')
          const suffix =
            extraPaths.length > 5
              ? `, and ${extraPaths.length - 5} more`
              : ''
          const includeExtras = window.confirm(
            `Uploaded file contains sections not present in the template: ${preview}${suffix}.\n\nDo you want to add them to the parameters table anyway?`
          )
          if (includeExtras) {
            merged = mergeParametersTemplate(
              baseTemplate,
              parsed,
              '',
              true
            ).merged
            toastState.add({
              message: 'Extra sections were added to the parameters table',
              type: 'info',
              timeout: 8000,
            })
          } else {
            toastState.add({
              message: 'Extra sections were ignored and only template entries were loaded',
              type: 'info',
              timeout: 8000,
            })
          }
        }

        parametersState.value = merged
      } catch {
        toastState.add({
          message: 'Invalid parameters JSON file',
          type: 'error',
        })
      }

      input.value = ''
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

  async function saveParameters() {
    if (!parameters) return
    const json = JSON.stringify(parametersState.snapshot, null, 4)

    if (window.electron?.invoke) {
      const result = await window.electron.invoke('save-json-file', {
        defaultPath: lastParametersFilePath || 'template_parameters.json',
        content: json,
        title: 'Save Parameters File',
      })
      if (!result?.canceled && result?.filePath) {
        lastParametersFilePath = result.filePath
        toastState.add({
          message: `Parameters saved to ${result.filePath}`,
          type: 'success',
        })
      }
      return
    }

    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = lastParametersFilePath
      ? lastParametersFilePath.split(/[/\\]/).pop() || 'template_parameters.json'
      : 'template_parameters.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  $effect(() => {
    if (parameters) {
      console.log('parameters changed:', parametersState.snapshot)
    }
  })
</script>

<div class="parameters-view">
  {#if !parameters}
    <div class="empty-state">
      {#if executableMode}
        <div class="empty-state-copy">
          <strong>No backend template synced yet</strong>
          <span>
            Save the executable configuration from Settings to probe the backend
            and load its parameters template.
          </span>
        </div>
      {:else}
        <input
          bind:this={fileInput}
          type="file"
          accept=".json"
          onchange={loadFile}
          hidden
        />
        <Button onclick={() => fileInput.click()}>Load Parameters File</Button>
      {/if}
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
      <Button size="small" onclick={() => fileInput.click()}>Load File</Button>
      <Button size="small" onclick={saveParameters}>Save</Button>
    </div>
    <div class="tree">
      {#snippet renderTree(tree: ParameterTree, depth: number)}
        {#each Object.entries(tree).filter(([key]) => key !== '__extra') as [key, val] (key)}
          {#if isLeaf(val)}
            {@const inputType = parsePatternType(val.pattern_description)}
            <div class="param-leaf">
              {#if val.documentation}
                <span class="param-doc" class:extra={val.__extra} title={val.documentation}>i</span>
              {/if}
              <label title={val.documentation || undefined}>
                <span class="param-name" class:extra={val.__extra}>{key}</span>
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
              <summary class:extra={isExtraNode(val)}>{key}</summary>
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

  .empty-state-copy {
    max-width: 28rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
    padding: 1rem;
  }

  .toolbar {
    display: flex;
    gap: 5rem;
    justify-content: center;
    padding: 1rem 1rem;
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

  summary.extra,
  .param-name.extra,
  .param-doc.extra {
    color: #1f6feb;
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
