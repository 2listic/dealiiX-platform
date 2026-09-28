import type { StandardNodeDefinition } from '../types/nodeTypes'

/** A logical operation and the concrete registry definitions that implement it. */
export type NodePaletteGroup = {
  key: string
  operation?: string
  displayName: string
  nodes: StandardNodeDefinition[]
}

const humanize = (value: string): string => {
  const normalized = value.replaceAll('_', ' ').trim()
  return normalized
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
    : ''
}

/**
 * Returns the stable grouping key for a registry entry.
 *
 * Entries without `operation` deliberately use their concrete type as the key:
 * old registries therefore remain one-item palette entries instead of being
 * accidentally merged because they happen to share a display label.
 */
export const nodePaletteKey = (node: StandardNodeDefinition): string => {
  const operation = node.operation?.trim()
  return operation ? `operation:${operation}` : `type:${node.type}`
}

/** Returns the label used for a logical operation in the picker/sidebar. */
export const nodePaletteDisplayName = (node: StandardNodeDefinition): string =>
  humanize(node.display_name?.trim() || node.operation?.trim() || node.type)

/**
 * Groups concrete definitions for presentation while retaining every concrete
 * definition in each group for type checking, drag-and-drop, and serialization.
 */
export const groupNodesByOperation = (
  nodes: StandardNodeDefinition[]
): NodePaletteGroup[] => {
  const groups = new Map<string, NodePaletteGroup>()

  for (const node of nodes) {
    const key = nodePaletteKey(node)
    const existing = groups.get(key)
    if (existing) {
      existing.nodes.push(node)
      continue
    }

    const operation = node.operation?.trim()
    groups.set(key, {
      key,
      ...(operation ? { operation } : {}),
      displayName: nodePaletteDisplayName(node),
      nodes: [node],
    })
  }

  return [...groups.values()]
}

/** Concrete identifier shown when an operation still has overloads. */
export const nodeConcreteSignature = (node: StandardNodeDefinition): string =>
  node.type
