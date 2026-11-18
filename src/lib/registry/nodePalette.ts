import { NodeType, type StandardNodeDefinition } from '../types/nodeTypes'

/** Removes the ImmersX namespace from text rendered as a user-facing label. */
export const displayTypeName = (value: string): string =>
  value.replaceAll('ImmersX::', '')

/**
 * Converts a snake_case or raw identifier into a sentence-cased display name.
 * @param name - Raw name string (e.g. `"my_node_name"`).
 * @returns Display name (e.g. `"My node name"`), or `""` if input is blank.
 */
export const formatSuggestedNodeName = (name: string): string => {
  const normalized = displayTypeName(name).replaceAll('_', ' ').trim()
  return normalized
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
    : ''
}

/**
 * Returns the key of the family a registry entry belongs to: entries with the
 * same key become one overload family in the sidebar and the connected-node
 * picker. From the first source present:
 * 1. a literal's own type, so literals never group;
 * 2. `class_name` + `method_name`;
 * 3. `overload_group`;
 * 4. `operation`, without numeric template arguments;
 * 5. for a method: `Class::method` from the type;
 * 6. the type without its numeric template arguments, so `Class<1,2>` and
 *    `Class<2,2>` share a key.
 *
 * @param node - Concrete registry definition.
 * @returns Family key.
 */
export const nodePaletteKey = (node: StandardNodeDefinition): string => {
  if (node.node_type === NodeType.ELEMENTARY_CONSTRUCTOR) {
    return `elementary:${node.type}`
  }
  if (node.class_name?.trim() && node.method_name?.trim()) {
    return `method:${node.class_name.trim()}::${node.method_name.trim()}`
  }
  const overloadGroup = node.overload_group?.trim()
  if (overloadGroup) return `group:${overloadGroup}`
  const operation = paletteOperationName(node)
  if (operation) return `operation:${operation}`
  if (isMethodNode(node)) return `method:${methodPaletteName(node.type)}`
  return `type:${canonicalTypeName(node.type)}`
}

/**
 * Returns the label of a registry entry in the sidebar and the connected-node
 * picker, from the first source present:
 * 1. a literal's value type (`int`, `std::string`);
 * 2. `display_name`;
 * 3. `method_name`, for an entry with `class_name` and `method_name`;
 * 4. for a method: its qualified `operation`, else `Class::method` from the type;
 * 5. `operation`;
 * 6. for a constructor: the class name from the type;
 * 7. the type without its numeric template arguments.
 * Names in steps 2, 3 and 5 are sentence-cased; types keep their C++ spelling.
 *
 * @param node - Registry definition to label.
 * @returns Human-readable label.
 */
export const nodePaletteDisplayName = (
  node: StandardNodeDefinition
): string => {
  if (node.node_type === NodeType.ELEMENTARY_CONSTRUCTOR)
    return displayTypeName(node.type)
  const displayName = node.display_name?.trim()
  if (displayName) return formatSuggestedNodeName(displayName)
  if (node.class_name?.trim() && node.method_name?.trim())
    return formatSuggestedNodeName(node.method_name)
  if (isMethodNode(node))
    return displayTypeName(
      node.operation?.includes('::')
        ? paletteOperationName(node)
        : methodPaletteName(node.type)
    )
  const operation = paletteOperationName(node)
  if (operation) return formatSuggestedNodeName(operation)
  if (classNodeTypes.has(node.node_type)) return classPaletteName(node.type)
  return displayTypeName(canonicalTypeName(node.type))
}

/**
 * Returns the label of a registry entry on the canvas and on its sidebar tile:
 * {@link nodePaletteDisplayName}, prefixed with its class (`Class -> member`)
 * unless it has no `class_name` or is a constructor.
 *
 * @param node - Registry definition to label.
 * @returns Human-readable label.
 */
export const nodeOwnerDisplayName = (node: StandardNodeDefinition): string => {
  const memberName = nodePaletteDisplayName(node)
  const ownerName = node.class_name?.trim()
  if (!ownerName || isConstructorNode(node)) return memberName
  return `${humanizeClassName(ownerName)} -> ${memberName}`
}

/**
 * Returns the sidebar section a registry entry is listed under: the class
 * named by its `class_name`, without namespace or template arguments.
 *
 * @param node - Registry definition.
 * @returns The section's key and label, or `undefined` for an entry without
 * `class_name`, which is listed on its own.
 */
export const nodeClassSection = (
  node: StandardNodeDefinition
): { key: string; label: string } | undefined => {
  const className = node.class_name?.trim()
  const name = className ? classPaletteName(className) : ''
  if (!name) return undefined
  return { key: `class:${name.toLowerCase()}`, label: humanizeClassName(name) }
}

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
  if (explicitName) return formatSuggestedNodeName(explicitName)
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

// ── Private helpers ──

const humanizeClassName = (value: string): string => {
  const name = displayTypeName(value)
    .split('::')
    .at(-1)
    ?.replace(/<[^<>]*>$/, '')
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

/** Splits a C++ type at its top-level `::`, keeping template arguments whole. */
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

/** Whether a type part ends in numeric template arguments, such as `<2>` or `<1,2>`. */
const hasNumericTemplateTag = (part: string): boolean => {
  const match = part.trim().match(/<[^<>]*>$/)
  return Boolean(match && /^<\d+(?:,\d+)?>$/.test(match[0].replace(/\s+/g, '')))
}

const readableTypePartName = (part: string): string => {
  const angleBracket = part.indexOf('<')
  return (angleBracket >= 0 ? part.slice(0, angleBracket) : part).trim()
}

const methodNodeTypes = new Set<NodeType>([
  NodeType.METHOD,
  NodeType.CONST_METHOD,
  NodeType.VOID_METHOD,
  NodeType.VOID_CONST_METHOD,
])

const isMethodNode = (node: StandardNodeDefinition): boolean =>
  methodNodeTypes.has(node.node_type)

const classNodeTypes = new Set<NodeType>([
  NodeType.EMPTY_CONSTRUCTOR,
  NodeType.CONSTRUCTOR,
])

/**
 * Coral exposes constructors either with a constructor node type or as a
 * function annotated with `method_name: "create"`.
 */
const isConstructorNode = (node: StandardNodeDefinition): boolean =>
  classNodeTypes.has(node.node_type) || node.method_name?.trim() === 'create'

/** Returns the method's type without Coral's generated `std::function` alias suffix. */
const wrapperBaseType = (type: string): string | undefined => {
  const marker = '::std::function<'
  const index = type.indexOf(marker)
  return index > 0 ? type.slice(0, index) : undefined
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

  const ownerIndex = parts.findIndex(hasNumericTemplateTag)
  const methodIndex =
    ownerIndex >= 0 && ownerIndex + 1 < parts.length
      ? ownerIndex + 1
      : parts.length - 1
  const owner = readableTypePartName(parts[methodIndex - 1] ?? '')
  const method = readableTypePartName(parts[methodIndex] ?? '')
  return [owner, method].filter(Boolean).join('::')
}

/** Returns the trimmed `operation`, without template arguments when qualified. */
const paletteOperationName = (node: StandardNodeDefinition): string => {
  const operation = node.operation?.trim() ?? ''
  return operation.includes('::') ? canonicalTypeName(operation) : operation
}

const classPaletteName = (type: string): string => {
  const parts = qualifiedTypeParts(type.trim())
  return displayTypeName(readableTypePartName(parts.at(-1) ?? type))
}
