import { NodeType, type StandardNodeDefinition } from '../types/nodeTypes'

/** A logical operation and the concrete registry definitions that implement it. */
export type NodePaletteGroup = {
  key: string
  operation?: string
  family?: string
  displayName: string
  nodes: StandardNodeDefinition[]
}

/** A concrete class/template specialization inside a legacy namespace family. */
export type NodePaletteSubgroup = {
  key: string
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
 * Entries without `operation` are grouped by their namespace. This gives
 * legacy registries a useful family structure without changing their concrete
 * type identifiers.
 *
 * @param node - Concrete registry definition.
 * @returns Stable key used to group the node in the palette.
 */
export const nodePaletteKey = (node: StandardNodeDefinition): string => {
  const operation = node.operation?.trim()
  return operation
    ? `operation:${operation}`
    : `namespace:${nodeNamespace(node.type)}`
}

const qualifiedTypeParts = (type: string): string[] => {
  const parts: string[] = []
  let part = ''
  let templateDepth = 0

  for (let index = 0; index < type.length; index += 1) {
    const character = type[index]
    if (character === '<') templateDepth += 1
    if (character === '>') templateDepth = Math.max(0, templateDepth - 1)

    if (character === ':' && type[index + 1] === ':' && templateDepth === 0) {
      parts.push(part)
      part = ''
      index += 1
      continue
    }
    part += character
  }

  if (part) parts.push(part)
  return parts
}

const typePartNameAndTag = (part: string): { name: string; tag: string } => {
  const match = part.trim().match(/^(.*?)(<[^<>]*>)$/)
  if (!match) return { name: part.trim(), tag: '' }

  const tag = match[2].replace(/\s+/g, '')
  return /^<\d+(?:,\d+){0,1}>$/.test(tag)
    ? { name: match[1].trim(), tag }
    : { name: part.trim(), tag: '' }
}

const readableTypePartName = (part: string): string => {
  const angleBracket = part.indexOf('<')
  return (angleBracket >= 0 ? part.slice(0, angleBracket) : part).trim()
}

const numericTemplatePartIndex = (parts: string[]): number =>
  parts.findIndex((part) => Boolean(typePartNameAndTag(part).tag))

const functionWrapperIndex = (parts: string[]): number =>
  parts.findIndex(
    (part, index) => part === 'std' && parts[index + 1]?.startsWith('function<')
  )

const methodNodeTypes = new Set<NodeType>([
  NodeType.METHOD,
  NodeType.CONST_METHOD,
  NodeType.VOID_METHOD,
  NodeType.VOID_CONST_METHOD,
])

const isMethodNode = (node: StandardNodeDefinition): boolean =>
  methodNodeTypes.has(node.node_type)

/** Returns the class/template part that owns a legacy node. */
const nodeOwnerType = (node: StandardNodeDefinition): string => {
  const parts = qualifiedTypeParts(node.type.trim())
  if (!parts.length) return node.type
  const ownerIndex = numericTemplatePartIndex(parts)
  if (ownerIndex >= 0) return parts[ownerIndex]

  const wrapperIndex = functionWrapperIndex(parts)
  return wrapperIndex >= 0
    ? (parts[wrapperIndex + 1] ?? node.type)
    : (parts.at(-1) ?? node.type)
}

/**
 * Returns the namespace portion of a concrete registry type.
 * @param type - Concrete registry type identifier.
 * @returns Namespace, or `Global` when no namespace is present.
 */
export const nodeNamespace = (type: string): string => {
  const parts = qualifiedTypeParts(type.trim())
  if (parts.length < 2) return 'Global'

  const ownerIndex = numericTemplatePartIndex(parts)
  if (ownerIndex > 0) return parts.slice(0, ownerIndex).join('::')

  const wrapperIndex = functionWrapperIndex(parts)
  if (wrapperIndex > 0) return parts.slice(0, wrapperIndex).join('::')

  const namespaceParts = parts.slice(0, -1)
  return namespaceParts.join('::') || 'Global'
}

/**
 * Returns the readable class/member name without its namespace or dimension tag.
 * @param type - Concrete registry type identifier.
 * @returns Readable class or member name.
 */
export const nodeClassName = (type: string): string => {
  const parts = qualifiedTypeParts(type.trim())
  if (!parts.length) return ''

  const lastPart = typePartNameAndTag(parts.at(-1) ?? '')
  const candidate =
    !lastPart.tag && parts.length >= 3 ? (parts.at(-1) ?? '') : lastPart.name
  return readableTypePartName(candidate)
}

const nodeNumericTemplateTag = (type: string): string => {
  const parts = qualifiedTypeParts(type.trim())
  if (!parts.length) return ''

  const last = typePartNameAndTag(parts.at(-1) ?? '')
  if (last.tag) return last.tag
  return parts.length >= 2 ? typePartNameAndTag(parts.at(-2) ?? '').tag : ''
}

/**
 * Returns a readable dimension tag, such as `· 2D` or `· 1D in 2D`.
 * @param type - Concrete registry type identifier.
 * @returns Human-readable dimension tag, or `""` when none is present.
 */
export const nodeDimensionTag = (type: string): string => {
  const tag = nodeNumericTemplateTag(type)
  if (!tag) return ''

  const dimensions = tag.slice(1, -1).split(',')
  if (dimensions.length === 1) return `· ${dimensions[0]}D`
  if (dimensions.length === 2) {
    return dimensions[0] === dimensions[1]
      ? `· ${dimensions[0]}D`
      : `· ${dimensions[0]}D in ${dimensions[1]}D`
  }
  return ''
}

/**
 * Builds the fallback label for a registry node without presentation metadata.
 * @param type - Concrete registry type identifier.
 * @returns Human-readable fallback label.
 */
export const nodeSimpleDisplayName = (type: string): string => {
  const name = humanize(nodeClassName(type))
  const tag = nodeDimensionTag(type)
  return [name, tag].filter(Boolean).join(' ')
}

/**
 * Returns the label used for a logical operation in the picker/sidebar.
 * @param node - Registry definition to label.
 * @returns Human-readable logical operation label.
 */
export const nodePaletteDisplayName = (
  node: StandardNodeDefinition
): string => {
  const explicitName = node.display_name?.trim() || node.operation?.trim()
  return explicitName ? humanize(explicitName) : nodeNamespace(node.type)
}

/**
 * Groups concrete definitions for presentation while retaining every concrete
 * definition in each group for type checking, drag-and-drop, and serialization.
 *
 * @param nodes - Registry definitions to group.
 * @returns Palette groups containing the original concrete definitions.
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
    const family = operation ? undefined : nodeNamespace(node.type)
    groups.set(key, {
      key,
      ...(operation ? { operation } : {}),
      ...(family ? { family } : {}),
      displayName: nodePaletteDisplayName(node),
      nodes: [node],
    })
  }

  return [...groups.values()]
}

/**
 * Groups legacy namespace entries by their concrete class/template family.
 * @param nodes - Registry definitions to group.
 * @returns Concrete family subgroups.
 */
export const groupNodesByFamily = (
  nodes: StandardNodeDefinition[]
): NodePaletteSubgroup[] => {
  const groups = new Map<string, NodePaletteSubgroup>()

  for (const node of nodes) {
    const ownerType = nodeOwnerType(node)
    const key = ownerType
    const existing = groups.get(key)
    if (existing) {
      existing.nodes.push(node)
      continue
    }

    groups.set(key, {
      key,
      displayName: nodeSimpleDisplayName(ownerType),
      nodes: [node],
    })
  }

  return [...groups.values()]
}

/**
 * Returns the concrete identifier shown when an operation still has overloads.
 * @param node - Registry definition.
 * @returns Concrete registry type identifier.
 */
export const nodeConcreteSignature = (node: StandardNodeDefinition): string =>
  node.type

/**
 * Returns the readable specialization label when a plugin provides one.
 * Legacy registries fall back to their concrete type exactly as before.
 *
 * @param node - Registry definition to label.
 * @returns Human-readable specialization label.
 */
export const nodeVariantName = (node: StandardNodeDefinition): string =>
  node.variant_name?.trim() ||
  (node.operation?.trim() || node.display_name?.trim()
    ? nodeConcreteSignature(node)
    : nodeSimpleDisplayName(node.type))

const registryName = (node: StandardNodeDefinition): string => {
  const name = node.name?.trim()
  return name && name !== node.type ? name : ''
}

/**
 * Returns exactly the label used for a node in the palette.
 * @param node - Registry definition to label.
 * @param hasSpecializations - Whether the node is shown beneath a logical group.
 * @returns Human-readable palette label.
 */
export const nodePaletteNodeName = (
  node: StandardNodeDefinition,
  hasSpecializations = false
): string => {
  if (hasSpecializations) return nodeVariantName(node)

  const explicitName =
    registryName(node) || node.display_name?.trim() || node.operation?.trim()
  if (explicitName) return humanize(explicitName)

  const parts = qualifiedTypeParts(node.type.trim())
  const ownerIndex = numericTemplatePartIndex(parts)
  if (ownerIndex >= 0 && parts.length > ownerIndex + 1) {
    return nodePaletteChildName(node)
  }

  return nodeSimpleDisplayName(node.type)
}

/**
 * Returns the compact leaf label displayed below a legacy class family.
 * @param node - Registry definition to label.
 * @returns Human-readable leaf label.
 */
export const nodePaletteChildName = (node: StandardNodeDefinition): string => {
  const explicitName =
    registryName(node) || node.display_name?.trim() || node.operation?.trim()
  if (explicitName) return humanize(explicitName)

  const parts = qualifiedTypeParts(node.type.trim())
  const ownerIndex = numericTemplatePartIndex(parts)
  if (ownerIndex >= 0 && parts.length > ownerIndex + 1) {
    const member = typePartNameAndTag(parts[ownerIndex + 1])
    return humanize(member.name)
  }

  const wrapperIndex = functionWrapperIndex(parts)
  if (wrapperIndex >= 0) {
    return node.output_type
      ? nodeSimpleDisplayName(node.output_type)
      : humanize(readableTypePartName(parts[wrapperIndex + 1] ?? ''))
  }

  if (!isMethodNode(node)) return nodePaletteNodeName(node)

  const member = typePartNameAndTag(parts.at(-1) ?? node.type)
  const name = humanize(member.name)
  const tag = member.tag ? nodeDimensionTag(member.tag) : ''
  return [name, tag].filter(Boolean).join(' ')
}
