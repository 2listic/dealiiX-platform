const version = '1.1'
const identity = { id: 'mock', version }
const operations = [
  'describe',
  'configure',
  'validate',
  'submit',
  'status',
  'pause',
  'resume',
  'cancel',
  'logs',
  'outputs',
  'replay',
  'migrate',
  'artifact',
  'list_workflows',
  'read_workflow',
  'write_workflow',
]
const leaf = (value, pattern = '[Anything]') => ({
  value,
  default_value: value,
  documentation: '',
  pattern,
  pattern_description: pattern,
})
const argument = (name, type, connection_type) => ({
  name,
  type,
  connection_type,
})
const node = (type, fields = {}) => ({
  type,
  node_type: 'void_function',
  arguments: [],
  inputs: [],
  outputs: [],
  ...fields,
})
const configurable = { actions: ['configure'], configuration_exposable: true }
const literal = (type, value, fields = {}) =>
  node(type, {
    node_type: 'elementary_constructor',
    value,
    outputs: [-1],
    ...fields,
  })
const stringLiteral = literal('std::string', '')
const dependency = 'mock::dependency'
const artifact = 'mock::file'
const file = (type) =>
  node(type, {
    display_name: type.split('::').at(-1),
    palette_section: 'Mock',
    arguments: [
      argument('Produced by', artifact, 'input'),
      argument('Read by', artifact, 'output'),
    ],
    inputs: [0],
    outputs: [1],
    capabilities: configurable,
    configuration: { path: leaf('input.dat') },
  })

function definitions(configuration) {
  return {
    bool: literal('bool', 'false', { display_name: 'Option' }),
    int: literal('int', '0'),
    double: literal('double', '0'),
    'std::string': stringLiteral,
    'mock::Selection': node('mock::Selection', {
      arguments: [
        {
          ...argument('Choice', 'std::string', 'output'),
          configuration_path: ['choice'],
        },
      ],
      outputs: [0],
      configuration: {
        options: leaf('hello|goodbye'),
        choice: {
          ...leaf('hello', '[Selection hello|goodbye ]'),
          selection_options: 'options',
        },
      },
      capabilities: configurable,
    }),
    'mock::LocalFile': file('mock::LocalFile'),
    'mock::RemoteFile': file('mock::RemoteFile'),
    'mock::GenericFile': {
      ...file('mock::GenericFile'),
      capabilities: { ...configurable, hidden: true },
    },
    'mock::Transfer': node('mock::Transfer', {
      arguments: [
        argument('Source', artifact, 'input'),
        argument('Destination', artifact, 'output'),
      ],
      inputs: [0],
      outputs: [1],
    }),
    'mock::Stage': node('mock::Stage', {
      display_name: 'Stage',
      class_name: 'Solver',
      overload_group: 'Solver family',
      variant_name: 'Local',
      palette_section: 'Mock',
      palette_subsection: 'Local',
      arguments: [
        { ...argument('After', dependency, 'input'), multiple: true },
        argument('Completed', dependency, 'output'),
        { ...argument('Files', artifact, 'input'), multiple: true },
        argument('Artifacts', artifact, 'output'),
      ],
      inputs: [0, 2],
      outputs: [1, 3],
      configuration: {
        message: configuration.Greeting,
        enabled: leaf('false', '[Bool]'),
        iterations: leaf('0', '[Integer]'),
        tolerance: leaf('0', '[Double]'),
        outcome: leaf('success', '[Selection success|missing_output ]'),
        run_policy: leaf('always', '[Selection always|if_missing ]'),
      },
      capabilities: configurable,
    }),
    'mock::Child': node('mock::Child', {
      node_type: 'network',
      display_name: 'CORAL',
      palette_section: 'Mock',
      palette_subsection: 'Remote',
      capabilities: { actions: ['open_child_workflow'] },
      value: {
        registry: {
          __backend: { id: 'coral', plugin: 'fixture' },
          'std::string': stringLiteral,
        },
      },
    }),
  }
}

module.exports = { definitions, identity, leaf, operations, version }
