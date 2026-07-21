<script lang="ts">
  import Button from './layout/Button.svelte'
  import Modal, { getModal } from './layout/Modal.svelte'
  import { parametersState } from '../stores/parametersStore.svelte'
  import { toastState } from '../stores/toastsStore.svelte'
  import type { ParameterTree, ParameterNode } from '../types/parameterTypes'
  import {
    isExtraNode,
    isParameterLeaf,
    isParameterTree,
  } from '../utils/parameterFileFormat'

  let parameters = $derived(parametersState.value)
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
   * Deletes an extra node (section or leaf) after user confirmation.
   * Only nodes marked __extra are deletable; template nodes are read-only.
   * @param path - Path to the parent tree.
   * @param key  - Key of the node to delete within its parent.
   */
  function deleteExtraNode(path: string[], key: string) {
    if (!parametersState.value) return
    if (!window.confirm(`Delete "${key}"? This cannot be undone.`)) return
    // Deep-clone so intermediate mutations don't touch the live reactive store.
    const next = $state.snapshot(parametersState.value) as ParameterTree
    // parent is a reference into next — mutations propagate back via JS reference semantics.
    const parent = getTreeAtPath(next, path)
    if (!parent) return
    // mutation here propagates back to next.
    delete parent[key]
    // only this final assignment triggers Svelte reactivity.
    parametersState.value = next
    toastState.add({ message: `${key} removed`, type: 'success' })
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
                {#if isExtraNode(val)}
                  <button
                    type="button"
                    class="delete-btn"
                    title="Delete section"
                    onclick={(e) => {
                      e.stopPropagation()
                      deleteExtraNode(path, key)
                    }}>× Delete</button
                  >
                {/if}
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

  .delete-btn {
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

  summary:hover .delete-btn {
    opacity: 1;
  }

  summary:hover .delete-btn:hover {
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
    color: var(--link-color);
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
    font: inherit;
  }

  .duplicate-actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
  }
</style>
