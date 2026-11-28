const { createHash, randomUUID } = require('node:crypto')
const {
  mkdirSync,
  readdirSync,
  linkSync,
  unlinkSync,
  readFileSync,
  renameSync,
  writeFileSync,
} = require('node:fs')
const { join } = require('node:path')
const {
  definitions,
  identity,
  operations,
  version,
} = require('./definitions.cjs')
const { ajv, validator } = require('./schemas.cjs')
const { checkIdentity, fail, prepare } = require('./workflow.cjs')

const terminal = new Set(['succeeded', 'failed', 'cancelled'])
const read = (path) => JSON.parse(readFileSync(path, 'utf8'))
const write = (path, document) => {
  const temporary = path + '.' + randomUUID()
  writeFileSync(temporary, JSON.stringify(document))
  renameSync(temporary, path)
}

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ':' + canonical(value[key]))
        .join(',') +
      '}'
    )
  return JSON.stringify(value)
}

const digest = (value) =>
  'sha256:' + createHash('sha256').update(canonical(value)).digest('hex')

function values(tree) {
  return Object.fromEntries(
    Object.entries(tree)
      .filter(([key]) => key !== '__extra')
      .map(([key, entry]) => [
        key,
        typeof entry.value === 'string' ? entry.value : values(entry),
      ])
  )
}

const archiveOperations = ['list_workflows', 'read_workflow', 'write_workflow']
const pathVariables = ['workdir', 'rundir', 'workflowdir']

function describe(configuration) {
  const nodes = definitions(configuration)
  const configurable = configuration.Editable?.value === 'true'
  const locations =
    configuration.Archive?.value === 'true'
      ? [
          { id: 'shared', label: 'Shared workflows', writable: true },
          { id: 'examples', label: 'Examples', writable: false },
        ]
      : []
  return {
    __backend: {
      ...identity,
      configuration_digest: digest(values(configuration)),
      registry_digest: digest(nodes),
      operations: operations.filter(
        (op) =>
          (configurable || op !== 'configure') &&
          (locations.length || !archiveOperations.includes(op))
      ),
      workflow_locations: locations,
      path_variables: pathVariables,
      ...(configurable && {
        configuration,
        capabilities: { actions: ['configure'] },
      }),
    },
    ...nodes,
  }
}

function queued(network, registry, source_run_id) {
  const plan = prepare(network, registry)
  return {
    network,
    registry,
    plan,
    status: {
      run_id: 'run-' + randomUUID().replaceAll('-', ''),
      state: 'queued',
      nodes: plan.nodes,
      scheduling: { state: 'active', revision: 0 },
      ...(source_run_id && { source_run_id }),
    },
  }
}

function advance(run) {
  const { status, plan } = run
  if (terminal.has(status.state)) return
  const setState = (id, state) => {
    status.nodes[id].state = state
    for (const file of plan.files[id] ?? []) status.nodes[file].state = state
  }
  if (status.cancellation_requested) {
    for (const [id, node] of Object.entries(status.nodes))
      if (!terminal.has(node.state)) setState(id, 'cancelled')
    status.state = 'cancelled'
    delete status.scheduling
    return
  }
  const active = plan.work.find((id) => status.nodes[id].state === 'running')
  if (active) {
    const configuration = plan.effective[active]
    if (configuration.outcome?.value === 'missing_output') {
      const qualified_id = plan.files[active]?.[0] ?? active
      const error = {
        code: 'missing_output',
        message: 'Expected artifact was not produced',
        qualified_id,
      }
      setState(active, 'failed')
      status.nodes[qualified_id].error = error
      status.error = error
      status.state = 'failed'
      delete status.scheduling
      return
    }
    setState(active, 'succeeded')
    if (
      status.source_run_id &&
      configuration.run_policy?.value === 'if_missing'
    )
      status.nodes[active].reused = true
  }
  const next = plan.work.find((id) => status.nodes[id].state === 'queued')
  if (!next) {
    status.state = 'succeeded'
    delete status.scheduling
  } else if (status.scheduling.state === 'draining') {
    status.scheduling.state = 'paused'
  } else if (status.scheduling.state !== 'paused') {
    status.scheduling.state = 'active'
    status.state = 'running'
    if (!active) setState(next, 'running')
  }
}

function runOperation(run, request) {
  const { status, plan } = run
  switch (request.operation) {
    case 'status':
      advance(run)
      return status
    case 'pause':
    case 'resume': {
      const schedule = status.scheduling
      if (schedule) {
        const paused = ['paused', 'draining'].includes(schedule.state)
        if ((request.operation === 'pause') !== paused) {
          schedule.revision++
          schedule.state =
            request.operation === 'pause' ? 'draining' : 'resuming'
        }
      }
      return status
    }
    case 'cancel':
      if (!terminal.has(status.state)) {
        status.cancellation_requested = true
        delete status.scheduling
      }
      return status
    case 'logs':
      return {
        run_id: status.run_id,
        logs: Object.fromEntries(
          plan.work.map((id) => {
            const params = plan.effective[id]
            return [
              id,
              params.message?.value ??
                params.Greeting?.value ??
                'Completed fixture step',
            ]
          })
        ),
      }
    case 'outputs':
      return {
        run_id: status.run_id,
        outputs: Object.fromEntries(
          Object.entries(plan.files)
            .filter(([id]) => status.nodes[id].state === 'succeeded')
            .map(([id, files]) => [
              id,
              files.map((file) => plan.effective[file].path.value),
            ])
        ),
      }
    case 'artifact': {
      const { qualified_id, name, offset } = request
      const file = plan.files[qualified_id]?.find(
        (id) => plan.effective[id].path.value === name
      )
      if (!file || status.nodes[file].state !== 'succeeded')
        fail('unknown_output', 'Artifact is not available', qualified_id)
      const contents = Buffer.from(
        (plan.effective[qualified_id].message?.value ?? 'fixture') + '\n'
      )
      const chunk = contents.subarray(offset, offset + 3)
      return {
        name,
        media_type: 'text/plain',
        data: chunk.toString('base64'),
        next_offset:
          offset + chunk.length < contents.length
            ? offset + chunk.length
            : null,
      }
    }
  }
}

function archive(profilePath, header, request) {
  if (request.configuration_digest !== header.configuration_digest)
    fail('stale_configuration', 'Reload the active backend configuration')
  const location = header.workflow_locations.find(
    ({ id }) => id === request.location_id
  )
  if (!location)
    fail('unknown_workflow_location', 'Select a configured workflow location')
  const directory = join(profilePath + '.workflows', location.id)
  mkdirSync(directory, { recursive: true })
  const validName = (name) =>
    /^[A-Za-z0-9_][A-Za-z0-9_. -]*\.json$/u.test(name) && !/[\r\n]/u.test(name)
  const stored = (name) => {
    try {
      return readFileSync(join(directory, name))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      return null
    }
  }
  const entry = (name, data) => ({
    name,
    revision: 'sha256:' + createHash('sha256').update(data).digest('hex'),
  })
  const parseNetwork = (data) => {
    try {
      const document = JSON.parse(data)
      return validator('network')(document) ? document : undefined
    } catch {
      return undefined
    }
  }
  if (request.operation === 'list_workflows') {
    const entries = []
    const files = readdirSync(directory, { withFileTypes: true })
      .filter((file) => file.isFile() && validName(file.name))
      .map(({ name }) => name)
      .sort()
    for (const name of files) {
      const data = stored(name)
      if (data && data.length <= 4 * 1024 * 1024 && parseNetwork(data))
        entries.push(entry(name, data))
    }
    return { entries }
  }
  const name = request.workflow_name
  if (!validName(name))
    fail('invalid_workflow_name', 'Expected a workflow JSON basename')
  const previous = stored(name)
  if (request.operation === 'read_workflow') {
    if (previous === null) fail('workflow_not_found', 'Workflow does not exist')
    if (previous.length > 4 * 1024 * 1024)
      fail('workflow_too_large', 'Workflow exceeds 4 MiB')
    const network = parseNetwork(previous)
    if (!network) fail('invalid_network', 'Expected a workflow document')
    return { ...entry(name, previous), network }
  }
  if (!location.writable)
    fail('workflow_read_only', 'This location is read-only')
  const current = previous === null ? null : entry(name, previous).revision
  if (request.expected_revision !== current)
    fail('workflow_conflict', 'Workflow changed or already exists')
  const contents = JSON.stringify(request.network)
  if (Buffer.byteLength(contents) > 4 * 1024 * 1024)
    fail('workflow_too_large', 'Workflow exceeds 4 MiB')
  const destination = join(directory, name)
  if (current === null) {
    const temporary = join(directory, '.' + randomUUID())
    writeFileSync(temporary, contents)
    try {
      linkSync(temporary, destination)
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      fail('workflow_conflict', 'Workflow already exists')
    } finally {
      unlinkSync(temporary)
    }
  } else {
    write(destination, request.network)
  }
  return entry(name, contents)
}

function dispatch(profilePath, request) {
  const profile = read(profilePath)
  if (!validator('backend-settings')(profile))
    fail('invalid_configuration', 'Expected tagged backend settings')
  checkIdentity(profile.backend, identity)
  if (typeof profile.configuration.Greeting?.value !== 'string')
    fail('invalid_configuration', 'Greeting is required')
  const registry = describe(profile.configuration)
  const header = registry.__backend
  if (archiveOperations.includes(request.operation))
    return archive(profilePath, header, request)
  const runDirectory = profilePath + '.runs'
  const saveRun = (run) => {
    mkdirSync(runDirectory, { recursive: true })
    write(join(runDirectory, run.status.run_id + '.json'), run)
    return run.status
  }

  switch (request.operation) {
    case 'describe':
      return registry
    case 'configure':
      if (!header.operations.includes('configure'))
        fail(
          'unsupported_operation',
          'Edit the fixture profile to configure it'
        )
      if (request.configuration_digest !== header.configuration_digest)
        fail('stale_configuration', 'Reload settings before editing')
      if (typeof request.configuration.Greeting?.value !== 'string')
        fail('invalid_configuration', 'Greeting is required')
      write(profilePath, { ...profile, configuration: request.configuration })
      return describe(request.configuration)
    case 'migrate': {
      const network = structuredClone(request.document)
      if (!validator('network')(network))
        fail('invalid_network', 'Unrecognized workflow document')
      const changes = []
      if (!network.backend) {
        network.backend = identity
        changes.push('Added backend identity')
      }
      prepare(network, registry)
      return { network, changes }
    }
    case 'validate':
    case 'submit':
      if (request.configuration_digest !== header.configuration_digest)
        fail('stale_configuration', 'Reload settings before submitting')
      if (request.registry_digest !== header.registry_digest)
        fail('stale_registry', 'Reload the registry before submitting')
      if (request.operation === 'submit')
        return saveRun(queued(request.network, registry))
      prepare(request.network, registry)
      return { valid: true }
  }

  let run
  try {
    run = read(join(runDirectory, request.run_id + '.json'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    fail('unknown_run', 'Run does not exist')
  }
  if (request.operation === 'replay') {
    if (run.status.state !== 'succeeded')
      fail('replay_unavailable', 'Replay requires a successful run')
    return saveRun(queued(run.network, run.registry, run.status.run_id))
  }
  const result = runOperation(run, request)
  if (['status', 'pause', 'resume', 'cancel'].includes(request.operation))
    saveRun(run)
  return result
}

function exchange(profilePath) {
  const requestSchema = validator('execution-service', '#/$defs/request')
  const responseSchema = validator('execution-service', '#/$defs/response')
  const response = { version }
  try {
    let request
    try {
      request = JSON.parse(readFileSync(0, 'utf8'))
    } catch {
      fail('invalid_request', 'Expected one JSON request')
    }
    if (typeof request?.version === 'string' && request.version !== version)
      fail('incompatible_protocol', 'Expected execution protocol ' + version)
    if (!requestSchema(request))
      fail('invalid_request', ajv.errorsText(requestSchema.errors))
    response.operation = request.operation
    response.result = dispatch(profilePath, request)
  } catch (error) {
    if (typeof error.code !== 'string') throw error
    response.error = { code: error.code, message: error.message }
    if (error.qualified_id) response.error.qualified_id = error.qualified_id
  }
  if (!responseSchema(response))
    throw new Error(ajv.errorsText(responseSchema.errors))
  process.stdout.write(JSON.stringify(response) + '\n')
}

module.exports = { exchange }
