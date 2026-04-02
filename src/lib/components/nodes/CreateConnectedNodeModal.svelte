<script lang="ts">
  /**
   * Modal shown when the user drops a connection onto empty canvas space and
   * multiple compatible node types exist. Lets the user pick the type and set
   * the node name before confirming creation.
   */
  import Modal from '../layout/Modal.svelte'
  import Button from '../layout/Button.svelte'
  import type { CompatibleNodeOption } from '../../utils/canvasNodeUtils'
  import { returnNodeName } from '../../types/nodeTypes'

  interface Props {
    modalId: string
    /** Compatible node options for the dangling connection. */
    options: CompatibleNodeOption[]
    /** Type string of the originating handle, shown as a hint. */
    sourceType: string
    onCreate: (_option: CompatibleNodeOption, _name: string) => void
    onCancel: () => void
  }

  let { modalId, options, sourceType, onCreate, onCancel }: Props = $props()

  // Composite key used as <select> value to uniquely identify an option even
  // when multiple node definitions share the same type (different handle indices).
  // eslint-disable-next-line svelte/prefer-writable-derived
  let selectedOptionId = $state('')
  let nodeName = $state('')

  // Fires when `options` changes (i.e. modal opens with a new set of choices).
  // Resets selection to the first option.
  $effect(() => {
    selectedOptionId = options[0]
      ? `${options[0].nodeDefinition.type}-${options[0].handleId}`
      : ''
  })

  // Fires when `selectedOptionId` changes. Syncs nodeName to the option's default.
  $effect(() => {
    const selectedOption = options.find(
      (option) =>
        `${option.nodeDefinition.type}-${option.handleId}` === selectedOptionId
    )
    if (selectedOption) {
      nodeName = returnNodeName(selectedOption.nodeDefinition)
    }
  })

  const handleCreate = () => {
    const selectedOption = options.find(
      (option) =>
        `${option.nodeDefinition.type}-${option.handleId}` === selectedOptionId
    )
    if (!selectedOption) {
      return
    }
    onCreate(selectedOption, nodeName.trim())
  }
</script>

<Modal id={modalId} size="sm" onClose={onCancel}>
  <div class="create-connected-node-form">
    <h2>Create Connected Node</h2>
    <p class="helper-text">
      Compatible with output type <code>{sourceType}</code>
    </p>

    <label for="connected-node-type">Node type</label>
    <select
      id="connected-node-type"
      bind:value={selectedOptionId}
      class="input-field"
    >
      {#each options as option (`${option.nodeDefinition.type}-${option.handleId}`)}
        <option value={`${option.nodeDefinition.type}-${option.handleId}`}>
          {returnNodeName(option.nodeDefinition)} ({option.argumentName})
        </option>
      {/each}
    </select>

    <label for="connected-node-name">Node name</label>
    <input
      id="connected-node-name"
      type="text"
      bind:value={nodeName}
      class="input-field"
      placeholder="Enter node name"
    />

    <div class="button-container">
      <Button variant="action" onclick={handleCreate}>Create</Button>
    </div>
  </div>
</Modal>

<style>
  h2 {
    margin: 1.5rem 0 0.5rem;
    text-align: center;
  }

  .helper-text {
    margin: 0 0 1rem;
    text-align: center;
    opacity: 0.8;
  }

  .create-connected-node-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .input-field {
    padding: 1vh;
    border: 1px solid var(--ternary-color);
    border-radius: 8px;
    font-size: 1rem;
    background: var(--secondary-color);
  }

  .button-container {
    margin-top: 1vh;
    display: flex;
    gap: 1vh;
    justify-content: flex-end;
  }
</style>
