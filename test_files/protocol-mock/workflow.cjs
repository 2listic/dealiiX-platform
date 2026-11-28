const { validator } = require('./schemas.cjs')

const isFile = (type) =>
  ['mock::LocalFile', 'mock::RemoteFile', 'mock::GenericFile'].includes(type)
const parameterType = {
  string: 'std::string',
  int: 'int',
  'unsigned int': 'unsigned int',
  double: 'double',
  bool: 'bool',
}

function fail(code, message, qualified_id) {
  throw Object.assign(new Error(message), { code, qualified_id })
}

function order(keys, edges) {
  const pending = new Set(keys)
  const result = []
  while (pending.size) {
    const ready = [...pending].filter((key) =>
      edges.every(
        ({ source, target }) =>
          String(target) !== key || !pending.has(String(source))
      )
    )
    if (!ready.length) fail('cyclic_network', 'The graph contains a cycle')
    for (const key of ready) {
      result.push(key)
      pending.delete(key)
    }
  }
  return result
}

function parameter(tree, path) {
  return path.reduce(
    (section, key) =>
      section && Object.hasOwn(section, key) ? section[key] : undefined,
    tree
  )
}

function literalValue(item, definition, qualified_id) {
  for (const field of ['node_type', 'arguments', 'inputs', 'outputs'])
    if (
      field in item &&
      JSON.stringify(item[field]) !== JSON.stringify(definition[field])
    )
      fail(
        'invalid_network',
        'Literal does not match its registry definition',
        qualified_id
      )
  if ('configuration' in item || 'parameter_file' in item)
    fail('invalid_network', 'Literal nodes use value', qualified_id)

  const value = item.value ?? definition.value
  if (item.type === 'std::string') return value
  if (item.type === 'bool' && (value === 'true' || value === 'false'))
    return value
  if (item.type === 'int' && /^[+-]?[0-9]+$/.test(value))
    return BigInt(value).toString()
  if (
    item.type === 'double' &&
    /^[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(value)
  )
    return value
  fail(
    'invalid_parameters',
    'Invalid value for ' + item.type + ' literal',
    qualified_id
  )
}

function exposure(node, handle, direction) {
  const prefix = 'parameter-' + direction + '-'
  if (!handle?.startsWith(prefix))
    fail('invalid_edge', 'Expected a ' + direction + ' parameter handle')
  let path
  try {
    path = JSON.parse(decodeURIComponent(handle.slice(prefix.length)))
  } catch {
    fail('invalid_edge', 'Malformed parameter path')
  }
  const ports =
    (node.configuration_exposures ?? node.parameter_file)?.exposures ?? []
  const port = ports.find(
    (item) =>
      JSON.stringify(item.path) === JSON.stringify(path) && item[direction]
  )
  if (!port) fail('invalid_edge', 'Parameter exposure is undeclared')
  return port
}

function checkIdentity(target, header) {
  if (!target) return
  if (
    target.id !== header.id ||
    (target.plugin && target.plugin !== header.plugin)
  )
    fail('incompatible_backend', 'Document targets a different backend')
  if (
    target.registry_digest &&
    target.registry_digest !== header.registry_digest
  )
    fail('stale_registry', 'Document registry revision no longer matches')
  if (target.version && target.version !== header.version)
    fail('incompatible_backend', 'Document targets a different backend version')
  for (const plugin of target.plugins ?? []) {
    if (
      !header.plugins?.some(
        ({ id, version }) =>
          id === plugin.id && (!plugin.version || version === plugin.version)
      )
    )
      fail(
        'incompatible_backend',
        'Required plugin is unavailable: ' + plugin.id
      )
  }
}

function prepare(network, registry) {
  const nodes = {}
  const work = []
  const files = {}
  const effective = {}
  const walk = (graph, definitions, prefix = '') => {
    checkIdentity(graph.backend, definitions.__backend)
    const { nodes: graphNodes, edges: graphEdges } = graph.workflow
    const keys = Object.keys(graphNodes)
    const edges = Object.values(graphEdges)
    const runtime = []
    const bindings = []
    const parameters = {}
    const literals = {}

    for (const [key, item] of Object.entries(graphNodes)) {
      const qualified_id = prefix + key
      const definition = definitions[item.type]
      if (!definition?.arguments)
        fail('unknown_node', 'Unknown type: ' + item.type, qualified_id)
      if (item.qualified_id !== undefined && item.qualified_id !== qualified_id)
        fail(
          'invalid_network',
          'Qualified ID does not match the workflow level',
          qualified_id
        )
      if (
        item.configuration_exposures &&
        !definition.capabilities?.configuration_exposable
      )
        fail(
          'invalid_parameters',
          'Node cannot expose configuration',
          qualified_id
        )
      if (!prefix && definition.node_type === 'elementary_constructor')
        literals[key] = literalValue(item, definition, qualified_id)
      parameters[key] = {
        ...structuredClone(definition.configuration ?? {}),
        ...structuredClone(item.configuration ?? {}),
      }
      if (item.parameter_file)
        parameters[key] = { Greeting: { value: 'file default' } }
    }
    for (const edge of edges) {
      const source = graphNodes[edge.source]
      const target = graphNodes[edge.target]
      if (!source || !target) fail('invalid_edge', 'Edge endpoint is absent')
      if (edge.source_handle || edge.target_handle) {
        bindings.push(edge)
      } else {
        const out = definitions[source.type]
        const into = definitions[target.type]
        const output = out.outputs[edge.source_output]
        const input = into.inputs[edge.target_input]
        const type = output === -1 ? source.type : out.arguments[output]?.type
        if (!type || type !== into.arguments[input]?.type)
          fail('invalid_edge', 'Edge ports are incompatible')
        runtime.push(edge)
      }
    }

    const usedInputs = new Set()
    for (const key of order(keys, bindings)) {
      const item = graphNodes[key]
      const config = parameters[key]
      for (const edge of bindings.filter(
        ({ target }) => String(target) === key
      )) {
        const input = exposure(item, edge.target_handle, 'input')
        const inputKey = key + ':' + JSON.stringify(input.path)
        if (usedInputs.has(inputKey))
          fail('invalid_edge', 'Duplicate parameter input')
        usedInputs.add(inputKey)
        const destination = parameter(config, input.path)
        const source = graphNodes[edge.source]
        const definition = definitions[source.type]
        const output = edge.source_handle
          ? exposure(source, edge.source_handle, 'output')
          : definition.arguments[definition.outputs[edge.source_output]]
        const sourceType =
          parameterType[output?.type] ??
          output?.type ??
          (definition.outputs[edge.source_output] === -1
            ? source.type
            : undefined)
        const path = output?.path ?? output?.configuration_path
        const value = path
          ? parameter(parameters[edge.source], path)?.value
          : (literals[edge.source] ?? source.value)
        if (
          sourceType !== parameterType[input.type] ||
          typeof value !== 'string' ||
          !destination
        )
          fail(
            'invalid_edge',
            'Parameter binding types or paths are incompatible'
          )
        destination.value = value
      }
      if (
        item.type === 'mock::Selection' &&
        !config.options.value.split('|').includes(config.choice.value)
      )
        fail(
          'invalid_parameters',
          'Choice is outside the declared options',
          prefix + key
        )
    }

    for (const key of order(keys, runtime)) {
      const item = graphNodes[key]
      const qualified_id = prefix + key
      const file = isFile(item.type)
      const produced =
        file && runtime.some(({ target }) => String(target) === key)
      const checked =
        (!produced && file) ||
        item.type === 'mock::Selection' ||
        Object.hasOwn(literals, key)
      if (file && !produced && parameters[key].path.value === 'missing.dat')
        fail('missing_input', 'Required file is missing', qualified_id)
      nodes[qualified_id] = {
        qualified_id,
        state: checked ? 'succeeded' : 'queued',
      }
      effective[qualified_id] = parameters[key]
      if (file) {
        if (produced) {
          const writer = runtime.find(
            ({ target }) => String(target) === key
          ).source
          const list = (files[prefix + writer] ??= [])
          list.push(qualified_id)
        }
      } else if (!checked) {
        work.push(qualified_id)
      }
      if (item.node_type === 'network') {
        const child = definitions[item.type].value?.registry
        if (!child) fail('unknown_node', 'Missing child registry', qualified_id)
        walk(item.value, child, qualified_id + '_')
      }
    }
  }
  if (!validator('network')(network))
    fail('invalid_network', 'Invalid saved workflow')
  walk(network, registry)
  return { nodes, work, files, effective }
}

module.exports = { fail, checkIdentity, prepare }
