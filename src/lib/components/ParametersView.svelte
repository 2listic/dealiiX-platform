<script lang="ts">
  import Button from './layout/Button.svelte'
  import Modal, { getModal } from './layout/Modal.svelte'
  import { parametersState } from '../stores/parametersStore.svelte'
  import { settingsState } from '../stores/settingsStore.svelte'
  import { toastState } from '../stores/toastsStore.svelte'
  import type {
    ParameterLeaf,
    ParameterTree,
    ParameterNode,
  } from '../types/parameterTypes'
  import {
    isParameterLeaf,
    isParameterTree,
    parseParametersFileWithFormat,
    serializeParametersFile,
  } from '../utils/parameterFileFormat'

  let parameters = $derived(parametersState.value)
  let fileInput = $state<HTMLInputElement | null>(null)
  let lastParametersFilePath = ''
  let duplicateModalName = $state('')
  let duplicateModalKey = ''
  let duplicateModalPath: string[] = []
  const duplicateSectionModalId = 'duplicate-parameters-section-modal'

  // Action: sets open once on mount, then lets the browser own the state.
  // No update() → Svelte never re-applies this on re-renders, so user-opened
  // sections stay open when the tree is mutated (e.g. after a duplication).
  function setInitialOpen(node: HTMLDetailsElement, open: boolean) {
    node.open = open
  }

  function isExtraNode(obj: unknown): boolean {
    return typeof obj === 'object' && obj !== null && '__extra' in obj
      ? Boolean((obj as { __extra?: boolean }).__extra)
      : false
  }

  function coerceUploadedLeaf(value: unknown): ParameterLeaf {
    if (isParameterLeaf(value)) {
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
    if (isParameterLeaf(node)) {
      return { ...node, __extra: true }
    }

    if (isParameterTree(node)) {
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

  function cloneNodeAsExtra(node: ParameterNode): ParameterNode {
    if (isParameterLeaf(node)) {
      return { ...node, __extra: true }
    }

    const entries = Object.entries(node)
      .filter(([key]) => key !== '__extra')
      .map(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          return [key, cloneNodeAsExtra(value as ParameterNode)]
        }
        return [key, value]
      })

    return {
      __extra: true,
      ...Object.fromEntries(entries),
    } as ParameterTree
  }

  /**
   * Returns the subtree at `path`, or null if any segment is missing or a leaf.
   * `path` points to the PARENT — the node itself is `getTreeAtPath(root, path)[key]`.
   * @param root - The root of the tree to navigate.
   * @param path - Array of keys from the root to the target's parent.
   */
  function getTreeAtPath(
    root: ParameterTree,
    path: string[]
  ): ParameterTree | null {
    let current: ParameterTree = root
    for (const segment of path) {
      const next = current[segment]
      if (!isParameterTree(next)) {
        return null
      }
      current = next
    }
    return current
  }

  /**
   * Opens the duplicate modal pre-filled with a suggested name.
   * The path/key split is intentional: mutation requires a handle to the parent
   * (to insert a sibling), not to the node itself.
   * @param path - Path to the parent tree, e.g. `["Geometry"]` for a section inside Geometry.
   * @param key  - Name of the section within its parent, e.g. `"Mesh"`.
   */
  function duplicateSection(path: string[], key: string) {
    if (!parametersState.value) return

    const suggestedName = `${key}_copy`
    duplicateModalPath = path
    duplicateModalKey = key
    duplicateModalName = suggestedName
    getModal(duplicateSectionModalId)?.open()
  }

  /**
   * Commits the duplication after the user confirms the name in the modal.
   */
  function confirmDuplicateSection() {
    if (!parametersState.value || !duplicateModalKey) return

    // Deep-clone so intermediate mutations don't touch the live reactive store.
    const nextParameters = $state.snapshot(
      parametersState.value
    ) as ParameterTree
    // parentTree is a reference into nextParameters — mutations propagate back via JS reference semantics.
    const parentTree = getTreeAtPath(nextParameters, duplicateModalPath)
    const sourceNode = parentTree?.[duplicateModalKey]
    if (!parentTree || !isParameterTree(sourceNode)) {
      toastState.add({
        message: `Section ${duplicateModalKey} could not be duplicated`,
        type: 'error',
      })
      return
    }

    const newName = duplicateModalName.trim()
    if (!newName) {
      return
    }
    if (newName in parentTree) {
      toastState.add({
        message: `A section named ${newName} already exists`,
        type: 'error',
      })
      return
    }

    // mutation here propagates back to nextParameters.
    parentTree[newName] = cloneNodeAsExtra(sourceNode) as ParameterTree
    // only this final assignment triggers Svelte reactivity.
    parametersState.value = nextParameters
    toastState.add({
      message: `Section ${duplicateModalKey} duplicated as ${newName}`,
      type: 'success',
    })
    getModal(duplicateSectionModalId)?.close()
  }

  function resetDuplicateSectionModal() {
    duplicateModalName = ''
    duplicateModalKey = ''
    duplicateModalPath = []
  }

  /**
   * Merges an uploaded file onto the canonical template tree.
   * The template is the authority for structure and metadata; the upload only contributes `value` fields.
   * Designed to be called twice from `loadFile` when extra keys are detected: first with
   * `includeExtras=false` (dry run), then with `includeExtras=true` if the user confirms.
   * @param template      - Canonical parameter tree (authority for structure and metadata).
   * @param uploaded      - Parsed content of the user's file (untrusted, arbitrary shape).
   * @param currentPath   - Dot-separated path of the current subtree for building `extraPaths`. Pass `''` at root.
   * @param includeExtras - Whether to include keys not present in the template.
   * @returns Merged tree and list of dotted paths that were in the upload but not the template.
   */
  function mergeParametersTemplate(
    template: ParameterTree,
    uploaded: unknown,
    currentPath = '',
    includeExtras = false
  ): { merged: ParameterTree; extraPaths: string[] } {
    const extraPaths: string[] = []
    // Phase 1: walk every key in the template, taking values from the upload when present.
    const mergedEntries: [string, ParameterNode][] = Object.entries(template)
      .filter(([key]) => key !== '__extra')
      .map(([key, templateValue]) => {
        const path = currentPath ? `${currentPath}.${key}` : key
        const uploadedValue =
          uploaded && typeof uploaded === 'object' && key in uploaded
            ? (uploaded as Record<string, unknown>)[key]
            : undefined

        if (isParameterLeaf(templateValue)) {
          // Uploaded is a full leaf (JSON format): take its value, keep template metadata.
          if (uploadedValue && isParameterLeaf(uploadedValue)) {
            return [key, { ...templateValue, value: uploadedValue.value }]
          }
          // Uploaded is a bare primitive (PRM format): stringify it into the template leaf.
          if (
            uploadedValue !== undefined &&
            (typeof uploadedValue !== 'object' || uploadedValue === null)
          ) {
            return [key, { ...templateValue, value: String(uploadedValue) }]
          }
          // No uploaded value: keep the template default unchanged.
          return [key, { ...templateValue }]
        }

        const nestedUploaded =
          uploadedValue && typeof uploadedValue === 'object'
            ? uploadedValue
            : {}
        const nested = mergeParametersTemplate(
          templateValue as ParameterTree,
          nestedUploaded,
          path,
          includeExtras
        )
        // Bubble up extra paths from nested levels.
        extraPaths.push(...nested.extraPaths)
        // Preserve __extra flag if the template subtree was itself already extra.
        return [
          key,
          isExtraNode(templateValue)
            ? { __extra: true, ...nested.merged }
            : nested.merged,
        ]
      })

    // Phase 2: find keys in the upload that don't exist in the template.
    // Phase 1 only walks template keys, so this second pass is needed to catch upload-only keys.
    if (uploaded && typeof uploaded === 'object') {
      for (const [key, value] of Object.entries(
        uploaded as Record<string, unknown>
      )) {
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

  /**
   * Reads the selected file and loads it into the parameter state.
   * Without a template snapshot, the file becomes the new state directly.
   * With a template, the file is merged onto it so template metadata is preserved.
   * When the file contains keys absent from the template, prompts the user before including them.
   *
   * @param event - The change event from the hidden file input.
   */
  function loadFile(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const { data: uploadedTree } = parseParametersFileWithFormat(
          e.target?.result as string,
          file.name
        )
        lastParametersFilePath = window.electron?.getFilePath?.(file) ?? ''

        // Currently always takes the else branch — ParametersView is only rendered in executable mode,
        // and a probe should always run before this function is reachable (button not visible).
        // Kept as defensive code in case context changes.
        if (!parametersState.snapshot) {
          parametersState.value = uploadedTree
        } else {
          const baseTemplate = parametersState.snapshot
          const initialMerge = mergeParametersTemplate(
            baseTemplate,
            uploadedTree
          )
          let merged = initialMerge.merged
          const { extraPaths } = initialMerge

          if (extraPaths.length > 0) {
            const preview = extraPaths.slice(0, 5).join(', ')
            const suffix =
              extraPaths.length > 5 ? `, and ${extraPaths.length - 5} more` : ''
            const includeExtras = window.confirm(
              `Uploaded file contains sections not present in the template: ${preview}${suffix}.\n\nDo you want to add them to the parameters table anyway?`
            )
            if (includeExtras) {
              // Second merge pass with includeExtras=true to include the extra keys.
              merged = mergeParametersTemplate(
                baseTemplate,
                uploadedTree,
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
                message:
                  'Extra sections were ignored and only template entries were loaded',
                type: 'info',
                timeout: 8000,
              })
            }
          }

          parametersState.value = merged
        }
      } catch {
        toastState.add({
          message: 'Invalid parameters file',
          type: 'error',
        })
      }

      // Reset so the same file path can trigger onChange again on re-selection.
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
    const snapshot = parametersState.snapshot
    if (!snapshot) return
    const defaultPath =
      lastParametersFilePath ||
      settingsState.activeParametersFileName ||
      'template_parameters.json'

    if (window.electron?.invoke) {
      const result = await window.electron.invoke('save-parameters-file', {
        defaultPath,
        parameters: snapshot,
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

    const content = serializeParametersFile(snapshot, defaultPath)
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = defaultPath.split(/[/\\]/).pop() || 'template_parameters.json'
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
      <div class="empty-state-copy">
        <strong>No backend template synced yet</strong>
        <span>
          Save the executable configuration from Settings to probe the backend
          and load its parameters template.
        </span>
      </div>
    </div>
  {:else}
    <input
      bind:this={fileInput}
      type="file"
      accept=".json,.prm"
      onchange={loadFile}
      hidden
    />
    <div class="tree">
      {#snippet renderTree(tree: ParameterTree, depth: number, path: string[])}
        {#each Object.entries(tree).filter(([key]) => key !== '__extra') as [key, val] (key)}
          {#if isParameterLeaf(val)}
            {@const inputType = parsePatternType(val.pattern_description)}
            <div class="param-leaf">
              {#if val.documentation}
                <span
                  class="param-doc"
                  class:extra={val.__extra}
                  title={val.documentation}>i</span
                >
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
            <details use:setInitialOpen={depth < 1}>
              <summary class:extra={isExtraNode(val)}>
                {key}
                <button
                  type="button"
                  class="duplicate-btn"
                  title="Duplicate section"
                  onclick={(e) => {
                    e.stopPropagation()
                    duplicateSection(path, key)
                  }}>⧉ Copy</button
                >
              </summary>
              <div class="section-content">
                {@render renderTree(val as ParameterTree, depth + 1, [
                  ...path,
                  key,
                ])}
              </div>
            </details>
          {/if}
        {/each}
      {/snippet}

      {@render renderTree(parameters, 0, [])}
    </div>
    <div class="toolbar">
      <Button
        size="small"
        title="Merge new fields from file"
        onclick={() => fileInput?.click()}>Merge from file</Button
      >
      <Button
        size="small"
        title="Download parameters as a JSON or PRM file"
        onclick={saveParameters}>Download params</Button
      >
    </div>
  {/if}
</div>

<Modal
  id={duplicateSectionModalId}
  size="sm"
  onClose={resetDuplicateSectionModal}
>
  <div class="duplicate-modal">
    <h2>Duplicate Section</h2>
    <label class="duplicate-field">
      <span>New section name</span>
      <input
        type="text"
        class="duplicate-input"
        bind:value={duplicateModalName}
        placeholder="section_copy"
      />
    </label>
    <div class="duplicate-actions">
      <Button onclick={() => getModal(duplicateSectionModalId)?.close()}
        >Cancel</Button
      >
      <Button
        variant="action"
        onclick={confirmDuplicateSection}
        disabled={!duplicateModalName.trim()}
      >
        Duplicate
      </Button>
    </div>
  </div>
</Modal>

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
    padding: 1rem;
    margin-top: 0.5rem;
  }

  .tree {
    padding: 7rem 2rem 2rem 1rem;
  }

  details {
    margin: 0.25rem 0;
  }

  summary {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    font-weight: 600;
    padding: 0.4rem 0.25rem;
    border-radius: 3px;
    user-select: none;
    list-style: none;
  }

  /* Chrome/Safari render their own disclosure triangle on <summary> by default.
     list-style:none (above) removes it in Firefox; this removes it in WebKit. */
  summary::-webkit-details-marker {
    display: none;
  }

  /* ::before inserts a virtual first child with no HTML node.
     Because summary is a flex container, it becomes the leftmost flex item. */
  summary::before {
    content: '▸';
    flex: 0 0 auto;
    width: 1rem;
    text-align: center;
  }

  /* details[open] matches when the browser has set the open attribute.
     The > child combinator ensures we only target the direct summary, not nested ones. */
  details[open] > summary::before {
    content: '▾';
  }

  summary:hover {
    background: var(--background-color-secondary);
  }

  .duplicate-btn {
    margin-left: auto;
    opacity: 0;
    border: 1px solid transparent;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 0.9rem;
    padding: 0.3rem 0.4rem;
    border-radius: 4px;
    flex: 0 0 auto;
  }

  summary:hover .duplicate-btn {
    opacity: 1;
  }

  summary:hover .duplicate-btn:hover {
    border-color: var(--ternary-color);
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

    /* :global() needed because <details> rendered inside a snippet */
    .section-content :global(details) {
      grid-column: 1 / -1; /* span both columns so a section never splits across them */
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

  .duplicate-modal {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .duplicate-modal h2 {
    margin: 0;
    text-align: center;
  }

  .duplicate-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-weight: 600;
  }

  .duplicate-input {
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--ternary-color);
    border-radius: 8px;
    background: var(--secondary-color);
    color: var(--ternary-color);
    font: inherit;
  }

  .duplicate-actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
  }
</style>
