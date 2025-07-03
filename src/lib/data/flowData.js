export const initialNodes = [
  {
    id: '1',
    type: 'text',
    data: {
      value: 'whoami',
    },
    position: { x: 0, y: 100 },
  },
  {
    id: '2',
    type: 'text',
    data: {
      value: 'ls -a',
    },
    position: { x: 100, y: 200 },
  },
  {
    id: '3',
    type: 'bool',
    data: {
      value: true,
    },
    position: { x: 100, y: 300 },
  },
  {
    id: '4',
    type: 'concat',
    data: {},
    position: { x: 400, y: 200 },
  },
  {
    id: '5',
    type: 'unsigned',
    data: {},
    position: { x: 100, y: 400 },
  },
]

export const initialEdges = [
  // {
  //   id: 'e1-4-top',
  //   source: '1',
  //   sourceHandle: 'output-0',
  //   target: '4',
  //   targetHandle: 'input-0',
  //   type: 'custom-edge'
  // },
  // {
  //   id: 'e2-4-bottom',
  //   source: '2',
  //   sourceHandle: 'output-0',
  //   target: '4',
  //   targetHandle: 'input-1',
  // },
]