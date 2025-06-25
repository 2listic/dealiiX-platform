export const initialNodes = [
  {
    id: '1',
    type: 'text',
    data: {
      text: 'whoami',
    },
    position: { x: 0, y: 100 },
  },
  {
    id: '2',
    type: 'text',
    data: {
      text: 'ls -a',
    },
    position: { x: 100, y: 200 },
  },
  {
    id: '4',
    type: 'concat',
    data: {},
    position: { x: 400, y: 200 },
  },
];

export const initialEdges = [
  // {
  //   id: 'e1-4-top',
  //   source: '1',
  //   target: '4',
  //   targetHandle: 'top-input',
  // },
  // {
  //   id: 'e2-4-bottom',
  //   source: '2',
  //   target: '4',
  //   targetHandle: 'bottom-input',
  // },
];