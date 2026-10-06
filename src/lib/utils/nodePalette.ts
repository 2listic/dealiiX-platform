import { NodeType, type StandardNodeDefinition } from '../types/nodeTypes'

/** A logical operation and the concrete registry definitions that implement it. */
export type NodePaletteGroup = {
  key: string
  operation?: string
  className?: string
  methodName?: string
  overloadGroup?: string
  displayName: string
  nodes: StandardNodeDefinition[]
}

/** A class-owned group of method operations shown together in the palette. */
export type NodePaletteClassGroup = {
  kind: 'class'
  key: string
  displayName: string
  groups: NodePaletteGroup[]
}

/** A palette entry that is either free-standing or owned by a class. */
export type NodePaletteItem =
  | NodePaletteClassGroup
  | { kind: 'node'; key: string; group: NodePaletteGroup }

/** Removes the ImmersX namespace from text rendered as a user-facing label. */
export const displayTypeName = (value: string): string =>
  value.replaceAll('ImmersX::', '')

const humanize = (value: string): string => {
  const normalized = displayTypeName(value).replaceAll('_', ' ').trim()
  return normalized
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
    : ''
}

const humanizeClassName = (value: string): string => {
  const name = displayTypeName(value)
    .split('::')
    .at(-1)
    ?.replace(/([a-z0-9])([A-Z][a-z])/g, '$1 $2')
    .trim()

  if (!name) return ''

  return name
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word, index) => {
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1)
      }
      return /^[A-Z0-9]+$/.test(word) ? word : word.toLowerCase()
    })
    .join(' ')
}

/**
 * Returns the stable grouping key for a registry entry.
 *
 * Methods and class constructors are grouped after their numeric template
 * arguments have been removed. Consequently `Class<1, 2>` and `Class<2, 2>`
 * share one palette entry, as do all dimensional specializations of
 * `Class::method`.
 *
 * @param node - Concrete registry definition.
 * @returns Stable key used to group the node in the palette.
 */
export const nodePaletteKey = (node: StandardNodeDefinition): string => {
  if (node.node_type === NodeType.ELEMENTARY_CONSTRUCTOR) {
    return `elementary:${node.type}`
  }
  const operation = node.operation?.trim()
  if (operation) return `operation:${paletteOperationName(node)}`
  if (isMethodNode(node)) return `method:${methodPaletteName(node.type)}`
  return `type:${canonicalTypeName(node.type)}`
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

/**
 * Returns the concrete registry key without a generated std::function alias.
 *
 * Coral keeps both a method registration and the callable wrapper used by the
 * registry. They are distinct concrete definitions, but exposing both in the
 * palette gives users two buttons for the same action. The alias is removed
 * only when its non-wrapper definition is present; graph serialization still
 * uses the original concrete definition.
 */
const wrapperBaseType = (type: string): string | undefined => {
  const marker = '::std::function<'
  const index = type.indexOf(marker)
  return index > 0 ? type.slice(0, index) : undefined
}

const deduplicateImplementationAliases = (
  nodes: StandardNodeDefinition[]
): StandardNodeDefinition[] => {
  const concreteTypes = new Set(nodes.map((node) => node.type))
  return nodes.filter((node) => {
    const baseType = wrapperBaseType(node.type)
    return !baseType || !concreteTypes.has(baseType)
  })
}

/** Removes numeric template arguments while preserving the registry spelling. */
const canonicalTypeName = (type: string): string =>
  qualifiedTypeParts(type.trim())
    .map((part) => readableTypePartName(part))
    .join('::')

/** Returns the compact `Class::method` spelling used by the palette. */
const methodPaletteName = (type: string): string => {
  const unwrappedType = wrapperBaseType(type) ?? type
  const parts = qualifiedTypeParts(unwrappedType.trim())
  if (parts.length < 2) return canonicalTypeName(unwrappedType)

  const ownerIndex = numericTemplatePartIndex(parts)
  const methodIndex =
    ownerIndex >= 0 && ownerIndex === parts.length - 1
      ? parts.length - 1
      : ownerIndex >= 0 && ownerIndex + 1 < parts.length
        ? ownerIndex + 1
        : parts.length - 1
  const owner = readableTypePartName(parts[methodIndex - 1] ?? '')
  const method = readableTypePartName(parts[methodIndex] ?? '')
  return [owner, method].filter(Boolean).join('::')
}

const paletteOperationName = (node: StandardNodeDefinition): string => {
  const operation = node.operation?.trim() ?? ''
  return operation.includes('::') ? canonicalTypeName(operation) : operation
}

const classPaletteName = (type: string): string => {
  const parts = qualifiedTypeParts(type.trim())
  return displayTypeName(readableTypePartName(parts.at(-1) ?? type))
}

const methodMemberName = (node: StandardNodeDefinition): string => {
  const explicitName = node.display_name?.trim()
  if (explicitName) return humanize(explicitName)

  const registeredName = node.method_name?.trim()
  if (registeredName) return humanize(registeredName)

  const operation = node.operation?.trim()
  if (operation?.includes('::')) {
    return humanize(operation.split('::').at(-1) ?? operation)
  }

  if (isMethodNode(node)) {
    return humanize(methodPaletteName(node.type).split('::').at(-1) ?? '')
  }

  return nodePaletteDisplayName(node)
}

/** Returns the explicit class owner advertised by a registry node. */
const nodeClassOwnerName = (
  node: StandardNodeDefinition
): string | undefined => {
  const explicitClass = node.class_name?.trim()
  if (explicitClass) return classPaletteName(explicitClass)
  return undefined
}

const isClassMethodNode = (node: StandardNodeDefinition): boolean =>
  Boolean(node.class_name?.trim())

const classNodeTypes = new Set<NodeType>([
  NodeType.EMPTY_CONSTRUCTOR,
  NodeType.CONSTRUCTOR,
])

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

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const tag = typePartNameAndTag(parts[index]).tag
    if (tag) return tag
  }
  return ''
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
  if (node.node_type === NodeType.ELEMENTARY_CONSTRUCTOR)
    return displayTypeName(node.type)
  if (node.class_name?.trim() && node.method_name?.trim()) {
    return humanize(node.display_name?.trim() || node.method_name)
  }
  if (isMethodNode(node)) {
    if (node.display_name?.trim()) return humanize(node.display_name)
    return node.operation?.includes('::')
      ? displayTypeName(paletteOperationName(node))
      : displayTypeName(methodPaletteName(node.type))
  }
  if (node.operation?.trim()) {
    const operation = paletteOperationName(node)
    return humanize(node.display_name?.trim() || operation)
  }
  if (classNodeTypes.has(node.node_type)) return classPaletteName(node.type)
  return displayTypeName(canonicalTypeName(node.type))
}

/** Returns the user-facing owner/member label used on the canvas. */
export const nodeOwnerDisplayName = (node: StandardNodeDefinition): string => {
  const memberName = nodePaletteDisplayName(node)
  const ownerName = node.class_name?.trim()
  if (!ownerName) return memberName
  return `${humanizeClassName(ownerName)} -> ${memberName}`
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

  for (const node of deduplicateImplementationAliases(nodes)) {
    const key = nodePaletteKey(node)
    const existing = groups.get(key)
    if (existing) {
      existing.nodes.push(node)
      continue
    }

    const operation = node.operation?.trim()
    const overloadGroup = node.overload_group?.trim()
    const className = nodeClassOwnerName(node)
    groups.set(key, {
      key,
      ...(operation ? { operation } : {}),
      ...(className ? { className } : {}),
      ...(className ? { methodName: methodMemberName(node) } : {}),
      ...(overloadGroup ? { overloadGroup } : {}),
      displayName: nodePaletteDisplayName(node),
      nodes: [node],
    })
  }

  return [...groups.values()]
}

/**
 * Groups method-like operations below their owning class while leaving all
 * other nodes as free-standing palette entries. A class section is created
 * even for one method; the distinction is whether the class has any methods,
 * not how many overloads a method has.
 */
export const groupNodesByClass = (
  nodes: StandardNodeDefinition[]
): NodePaletteItem[] => {
  const items: NodePaletteItem[] = []
  const classGroups = new Map<string, NodePaletteClassGroup>()

  for (const group of groupNodesByOperation(nodes)) {
    const firstNode = group.nodes[0]
    if (!firstNode || !isClassMethodNode(firstNode)) {
      items.push({ kind: 'node', key: `node:${group.key}`, group })
      continue
    }

    const className = group.className || nodeClassOwnerName(firstNode)
    if (!className) {
      items.push({ kind: 'node', key: `node:${group.key}`, group })
      continue
    }

    const key = `class:${className.toLowerCase()}`
    let classGroup = classGroups.get(key)
    if (!classGroup) {
      classGroup = {
        kind: 'class',
        key,
        displayName: humanizeClassName(className),
        groups: [],
      }
      classGroups.set(key, classGroup)
      items.push(classGroup)
    }

    classGroup.groups.push({
      ...group,
      className,
      methodName: group.methodName || methodMemberName(firstNode),
    })
  }

  return items
}

/**
 * Returns the concrete identifier shown when an operation still has overloads.
 * @param node - Registry definition.
 * @returns Concrete registry type identifier.
 */
export const nodeConcreteSignature = (node: StandardNodeDefinition): string =>
  node.type

/**
 * Returns the readable specialization label when a plugin provides one;
 * methods always retain their canonical `Class::method` spelling.
 *
 * @param node - Registry definition to label.
 * @returns Human-readable specialization label.
 */
export const nodeVariantName = (node: StandardNodeDefinition): string =>
  isMethodNode(node)
    ? nodePaletteDisplayName(node)
    : node.variant_name?.trim()
      ? displayTypeName(node.variant_name.trim())
      : nodePaletteDisplayName(node)

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
  if (isMethodNode(node)) return nodePaletteDisplayName(node)
  const explicitName = node.display_name?.trim() || node.operation?.trim()
  if (explicitName) return humanize(explicitName)
  return nodePaletteDisplayName(node)
}

/**
 * Returns the canonical label for a palette node.
 * @param node - Registry definition to label.
 * @returns Human-readable leaf label.
 */
export const nodePaletteChildName = (node: StandardNodeDefinition): string => {
  return nodePaletteNodeName(node)
}
