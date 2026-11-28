const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { after, test } = require('node:test')
const { leaf } = require('./definitions.cjs')
const { ajv, validator } = require('./schemas.cjs')

const read = (path) => JSON.parse(readFileSync(path, 'utf8'))
const write = (path, value) => writeFileSync(path, JSON.stringify(value))
const validates = (schema, document, fragment) => {
  const validate = validator(schema, fragment)
  assert.ok(validate(document), ajv.errorsText(validate.errors))
}
const success = new Set()

function fixture(t, editable = false) {
  const directory = mkdtempSync(join(tmpdir(), 'dealiix-wire-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const profile = join(directory, 'backend.config.json')
  write(profile, {
    backend: { id: 'mock' },
    configuration: {
      Greeting: leaf('hello'),
      Editable: leaf(String(editable), '[Bool]'),
    },
  })
  const send = (request) => {
    const child = spawnSync(
      process.execPath,
      [join(__dirname, 'backend.cjs'), '--configuration', profile, 'exchange'],
      {
        input: JSON.stringify(request),
        encoding: 'utf8',
        timeout: 5000,
      }
    )
    assert.equal(child.error, undefined)
    assert.equal(child.status, 0, child.stderr)
    const response = JSON.parse(child.stdout)
    validates('execution-service', response, '#/$defs/response')
    if (response.operation) assert.equal(response.operation, request.operation)
    if ('result' in response) success.add(response.operation)
    return response
  }
  const call = (operation, args) => send({ version: '1.1', operation, ...args })
  const result = (operation, args) => {
    const response = call(operation, args)
    assert.ok('result' in response, JSON.stringify(response))
    return response.result
  }
  const rejection = (operation, args, code) => {
    const response = call(operation, args)
    assert.equal(response.error?.code, code, JSON.stringify(response))
    return response.error
  }
  return { call, result, rejection, send, profile }
}

const revision = ({
  __backend: { configuration_digest, registry_digest },
}) => ({
  configuration_digest,
  registry_digest,
})
const edge = (source, source_output, target, target_input) => ({
  source,
  source_output,
  target,
  target_input,
})
const handle = (direction, key) =>
  'parameter-' + direction + '-' + encodeURIComponent(JSON.stringify([key]))
const exposure = (key, direction) => ({
  exposures: [
    {
      path: [key],
      type: 'string',
      input: direction === 'input',
      output: direction === 'output',
    },
  ],
})

function workflow() {
  return {
    version: 1,
    backend: { id: 'mock' },
    workflow: {
      nodes: {
        0: {
          type: 'mock::Selection',
          configuration: { choice: leaf('goodbye') },
        },
        1: { type: 'mock::LocalFile' },
        2: {
          type: 'mock::Stage',
          configuration: { run_policy: leaf('if_missing') },
          configuration_exposures: exposure('message', 'input'),
        },
        3: {
          type: 'mock::RemoteFile',
          configuration: { path: leaf('result.txt') },
        },
        4: { type: 'mock::Transfer' },
        5: {
          type: 'mock::LocalFile',
          configuration: { path: leaf('copied.txt') },
        },
      },
      edges: {
        0: {
          source: 0,
          source_output: 0,
          target: 2,
          target_handle: handle('input', 'message'),
        },
        1: edge(1, 0, 2, 1),
        2: edge(2, 1, 3, 0),
        3: edge(3, 0, 4, 0),
        4: edge(4, 0, 5, 0),
      },
    },
  }
}

function complete(client, run_id) {
  for (let step = 0; step < 20; step++) {
    const status = client.result('status', { run_id })
    if (['succeeded', 'failed', 'cancelled'].includes(status.state))
      return status
  }
  assert.fail('The fixture run did not terminate')
}

test('validates the shipped registry and workflow examples and desktop settings schema', () => {
  const examples = join(__dirname, '../../schemas/examples')
  validates('registry', read(join(examples, 'registry-executables.json')))
  validates('registry', read(join(examples, 'registry-coral-network.json')))
  validates('network', read(join(examples, 'network-executables.json')))
  validates('registry', read(join(__dirname, 'registry.json')))
  validates('network', read(join(__dirname, 'network.json')))
  const frontend = {
    'Backend command': leaf('["/usr/bin/node"]'),
    'Backend configuration file': leaf('/tmp/backend.config.json'),
    Theme: leaf('auto'),
    'VTK visualizer URL': leaf(''),
    'Project server URL': leaf(''),
  }
  validates('frontend-settings', frontend)
  assert.equal(
    validator('frontend-settings')({ ...frontend, Theme: leaf('invalid') }),
    false
  )
  assert.equal(validator('backend-settings')(frontend), false)
})

test('discovers registry capabilities, families, file ports and a scoped CORAL registry', (t) => {
  const client = fixture(t)
  const registry = client.result('describe')
  assert.equal(registry.__backend.id, 'mock')
  assert.equal(registry.__backend.operations.includes('configure'), false)
  assert.deepEqual(registry['mock::Stage'].capabilities, {
    actions: ['configure'],
    configuration_exposable: true,
  })
  assert.equal(registry['mock::Stage'].overload_group, 'Solver family')
  assert.equal(registry['mock::Stage'].palette_subsection, 'Local')
  assert.equal(registry['mock::Child'].palette_subsection, 'Remote')
  assert.equal(
    registry['mock::Child'].value.registry.__backend.plugin,
    'fixture'
  )
  assert.deepEqual(registry['mock::Child'].capabilities.actions, [
    'open_child_workflow',
  ])
  assert.equal(registry['mock::GenericFile'].capabilities.hidden, true)
  assert.equal(registry['mock::Stage'].arguments[2].multiple, true)
  assert.deepEqual(
    registry['mock::Selection'].arguments[0].configuration_path,
    ['choice']
  )
  assert.equal(
    registry['mock::Selection'].configuration.choice.selection_options,
    'options'
  )
  client.rejection(
    'configure',
    {
      configuration: {},
      configuration_digest: registry.__backend.configuration_digest,
    },
    'unsupported_operation'
  )
})

test('validates a portable profile and exercises optional configure and stale revisions', (t) => {
  const client = fixture(t, true)
  const first = client.result('describe')
  const configuration = {
    ...first.__backend.configuration,
    Greeting: leaf('salve'),
  }
  const stale = revision(first)
  const updated = client.result('configure', {
    configuration,
    configuration_digest: stale.configuration_digest,
  })
  assert.equal(read(client.profile).backend.id, 'mock')
  assert.equal(read(client.profile).configuration.Greeting.value, 'salve')
  assert.notEqual(
    revision(updated).configuration_digest,
    stale.configuration_digest
  )
  assert.notEqual(revision(updated).registry_digest, stale.registry_digest)
  client.rejection(
    'configure',
    { configuration, configuration_digest: stale.configuration_digest },
    'stale_configuration'
  )
  client.rejection(
    'validate',
    { network: workflow(), ...stale },
    'stale_configuration'
  )
  client.rejection(
    'submit',
    {
      network: workflow(),
      ...revision(updated),
      registry_digest: stale.registry_digest,
    },
    'stale_registry'
  )
  write(client.profile, { backend: { id: 'different' }, configuration })
  client.rejection('describe', {}, 'incompatible_backend')
  write(client.profile, configuration)
  client.rejection('describe', {}, 'invalid_configuration')
})

test('rejects invalid request shapes, nodes, ports, cycles and unavailable input files', (t) => {
  const client = fixture(t)
  const rev = revision(client.result('describe'))
  assert.equal(
    client.send({ version: '1.0', operation: 'describe' }).error.code,
    'incompatible_protocol'
  )
  client.rejection('submit', { network: workflow() }, 'invalid_request')
  client.rejection('status', { run_id: 'run-' + '0'.repeat(32) }, 'unknown_run')
  const cases = [
    [
      'incompatible_backend',
      (network) => {
        network.backend.id = 'coral'
      },
    ],
    [
      'unknown_node',
      ({ workflow }) => {
        workflow.nodes[2].type = 'mock::Unknown'
      },
    ],
    [
      'invalid_edge',
      ({ workflow }) => {
        workflow.edges[1].target_input = 0
      },
    ],
    [
      'invalid_request',
      ({ workflow }) => {
        workflow.edges[0].target_input = 0
      },
    ],
    [
      'cyclic_network',
      ({ workflow }) => {
        workflow.edges[5] = edge(2, 0, 2, 0)
      },
    ],
    [
      'invalid_parameters',
      ({ workflow }) => {
        workflow.nodes[0].configuration.choice.value = 'missing'
      },
    ],
  ]
  for (const [code, edit] of cases) {
    const network = workflow()
    edit(network)
    client.rejection('validate', { network, ...rev }, code)
  }
  const network = workflow()
  network.workflow.nodes[1].configuration = { path: leaf('missing.dat') }
  assert.equal(
    client.rejection('submit', { network, ...rev }, 'missing_input')
      .qualified_id,
    '1'
  )
  network.workflow.nodes[1] = {
    type: 'mock::LocalFile',
    configuration: { path: leaf('input.dat') },
    configuration_exposures: exposure('path', 'input'),
  }
  network.workflow.nodes[6] = {
    type: 'mock::Selection',
    configuration: {
      options: leaf('input.dat|missing.dat'),
      choice: leaf('missing.dat'),
    },
  }
  network.workflow.edges[5] = {
    source: 6,
    source_output: 0,
    target: 1,
    target_handle: handle('input', 'path'),
  }
  assert.equal(
    client.rejection('validate', { network, ...rev }, 'missing_input')
      .qualified_id,
    '1'
  )
})

test('checks nested identity, typed parameter-file ports and materialized workflow schema', (t) => {
  const client = fixture(t)
  const rev = revision(client.result('describe'))
  const child = {
    backend: { id: 'coral', plugin: 'fixture' },
    workflow: {
      nodes: {
        0: { type: 'std::string', value: 'bound into file' },
        1: {
          type: 'std::string',
          value: 'settings.json',
          parameter_file: exposure('Greeting', 'input'),
        },
      },
      edges: {
        0: {
          source: 0,
          source_output: 0,
          target: 1,
          target_handle: handle('input', 'Greeting'),
        },
      },
    },
  }
  const network = {
    backend: { id: 'mock' },
    workflow: {
      nodes: { 0: { type: 'mock::Child', node_type: 'network', value: child } },
      edges: {},
    },
  }
  assert.equal(client.result('validate', { network, ...rev }).valid, true)
  const submitted = client.result('submit', { network, ...rev })
  assert.ok(submitted.nodes['0_1'])
  const finished = complete(client, submitted.run_id)
  assert.equal(finished.state, 'succeeded')
  assert.equal(
    client.result('logs', { run_id: submitted.run_id }).logs['0_1'],
    'bound into file'
  )
  const materialized = structuredClone(network)
  assert.equal(validator('network-execution')(materialized), false)
  materialized.workflow.nodes[0].qualified_id = '0'
  const inner = materialized.workflow.nodes[0].value.workflow
  inner.nodes[0].qualified_id = '0_0'
  inner.nodes[1].qualified_id = '0_1'
  delete inner.nodes[1].parameter_file
  inner.edges = {}
  validates('network-execution', materialized)
  child.backend.plugin = 'wrong'
  client.rejection('validate', { network, ...rev }, 'incompatible_backend')
})

test('migrates untagged workflows and retains compatible tagged workflows', (t) => {
  const client = fixture(t)
  const network = workflow()
  delete network.backend
  const migrated = client.result('migrate', { document: network })
  assert.equal(migrated.network.backend.id, 'mock')
  assert.equal(migrated.changes.length, 1)
  assert.deepEqual(
    client.result('migrate', { document: migrated.network }).changes,
    []
  )
  client.rejection(
    'migrate',
    { document: { invalid: true } },
    'invalid_network'
  )
})

test('runs a workflow with Selection, file and transfer ports, pause/resume, logs and chunked artifacts', (t) => {
  const client = fixture(t)
  const rev = revision(client.result('describe'))
  const network = workflow()
  assert.equal(client.result('validate', { network, ...rev }).valid, true)
  const submitted = client.result('submit', { network, ...rev })
  const { run_id } = submitted
  assert.equal(submitted.state, 'queued')
  assert.equal(submitted.nodes[0].state, 'succeeded')
  assert.equal(submitted.nodes[1].state, 'succeeded')
  assert.equal(client.result('status', { run_id }).nodes[3].state, 'running')
  assert.deepEqual(client.result('pause', { run_id }).scheduling, {
    state: 'draining',
    revision: 1,
  })
  assert.equal(client.result('pause', { run_id }).scheduling.revision, 1)
  const paused = client.result('status', { run_id })
  assert.equal(paused.scheduling.state, 'paused')
  assert.equal(paused.nodes[3].state, 'succeeded')
  assert.equal(paused.nodes[4].state, 'queued')
  const resumed = client.result('resume', { run_id })
  assert.equal(resumed.run_id, run_id)
  assert.deepEqual(resumed.scheduling, { state: 'resuming', revision: 2 })
  const finished = complete(client, run_id)
  assert.equal(finished.state, 'succeeded')
  assert.equal(finished.nodes[5].state, 'succeeded')
  assert.equal(client.result('logs', { run_id }).logs[2], 'goodbye')
  assert.deepEqual(client.result('outputs', { run_id }).outputs, {
    2: ['result.txt'],
    4: ['copied.txt'],
  })
  const args = { run_id, qualified_id: '2', name: 'result.txt' }
  const chunks = []
  let offset = 0
  while (offset !== null) {
    const piece = client.result('artifact', { ...args, offset })
    assert.equal(piece.media_type, 'text/plain')
    chunks.push(Buffer.from(piece.data, 'base64'))
    offset = piece.next_offset
  }
  assert.equal(Buffer.concat(chunks).toString(), 'goodbye\n')
  client.rejection(
    'artifact',
    { ...args, name: 'missing.txt', offset: 0 },
    'unknown_output'
  )
  const replay = client.result('replay', { run_id })
  assert.equal(replay.source_run_id, run_id)
  assert.notEqual(replay.run_id, run_id)
  assert.equal(complete(client, replay.run_id).nodes[2].reused, true)
})

test('cancels a paused run and reports failed output against its File node', (t) => {
  const client = fixture(t)
  const rev = revision(client.result('describe'))
  const network = workflow()
  const { run_id } = client.result('submit', { network, ...rev })
  client.result('pause', { run_id })
  assert.equal(client.result('status', { run_id }).scheduling.state, 'paused')
  assert.equal(client.result('cancel', { run_id }).cancellation_requested, true)
  client.result('resume', { run_id })
  assert.equal(client.result('status', { run_id }).state, 'cancelled')
  client.rejection('replay', { run_id }, 'replay_unavailable')
  network.workflow.nodes[2].configuration.outcome = leaf('missing_output')
  const failed = complete(
    client,
    client.result('submit', { network, ...rev }).run_id
  )
  assert.equal(failed.state, 'failed')
  assert.equal(failed.nodes[3].error.qualified_id, '3')
  assert.equal(failed.nodes[3].error.code, 'missing_output')
})

after(() => {
  const service = read(
    join(__dirname, '../../schemas/execution-service.schema.json')
  )
  assert.deepEqual(
    [...success].sort(),
    [...service.$defs.operation.enum].sort()
  )
})

test('discovers workflow locations and reads and writes graphs with revision checks', (t) => {
  const client = fixture(t)
  const settings = read(client.profile)
  settings.configuration.Archive = leaf('true')
  write(client.profile, settings)
  const header = client.result('describe').__backend
  assert.deepEqual(header.path_variables, ['workdir', 'rundir', 'workflowdir'])
  assert.deepEqual(
    header.workflow_locations.map(({ id, writable }) => [id, writable]),
    [
      ['shared', true],
      ['examples', false],
    ]
  )
  const context = {
    location_id: 'shared',
    configuration_digest: header.configuration_digest,
  }
  const file = { ...context, workflow_name: 'ADAN56.network.json' }
  client.rejection(
    'list_workflows',
    {
      ...context,
      configuration_digest: 'sha256:' + '0'.repeat(64),
    },
    'stale_configuration'
  )
  const network = workflow()
  const create = { ...file, network, expected_revision: null }
  assert.deepEqual(client.result('list_workflows', context), { entries: [] })
  const created = client.result('write_workflow', create)
  assert.deepEqual(client.result('list_workflows', context).entries, [created])
  assert.deepEqual(client.result('read_workflow', file), {
    ...created,
    network,
  })
  client.rejection('write_workflow', create, 'workflow_conflict')
  const updated = client.result('write_workflow', {
    ...create,
    network: { ...network, author: 'next' },
    expected_revision: created.revision,
  })
  assert.notEqual(updated.revision, created.revision)
  client.rejection(
    'write_workflow',
    { ...create, expected_revision: created.revision },
    'workflow_conflict'
  )
  client.rejection(
    'write_workflow',
    { ...create, location_id: 'examples' },
    'workflow_read_only'
  )
  client.rejection(
    'read_workflow',
    { ...file, workflow_name: '../ADAN56.network.json' },
    'invalid_request'
  )
  client.rejection(
    'read_workflow',
    { ...file, workflow_name: 'missing.json' },
    'workflow_not_found'
  )
  client.rejection(
    'list_workflows',
    { ...context, location_id: 'other' },
    'unknown_workflow_location'
  )
})
