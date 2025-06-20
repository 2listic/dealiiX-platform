// import type { Node, Edge } from '@xyflow/svelte';

export const initialNodes = [
  // {
  //   id: '1',
  //   type: 'input',
  //   data: { label: 'Hello' },
  //   position: { x: 0, y: 10 },
  //   style: 'width: 170px; height: 80px;',
  // },
  // {
  //   id: '1:child1',
  //   type: 'output',
  //   data: { label: 'child' },
  //   position: { x: 5, y: 30 },
  //   parentId: '1',
  // },
  // {
  //   id: '2',
  //   type: 'default',
  //   data: { label: 'World' },
  //   position: { x: 150, y: 150 },
  // },
  // {
  //   id: '3',
  //   type: 'textUpdater',
  //   position: { x: 300, y: 0 },
  //   data: { text: 'some text' },
  // },
  // {
  //   id: '4',
  //   type: 'textUpdater',
  //   position: { x: 300, y: 300 },
  //   data: { text: 'some text' },
  // },
  {
    id: '1',
    type: 'text',
    data: {
      text: 'whoami',
    },
    position: { x: -100, y: -50 },
  },
  {
    id: '2',
    type: 'text',
    data: {
      text: 'ls',
    },
    position: { x: 0, y: 100 },
  },
  // {
  //   id: '3',
  //   type: 'result',
  //   data: {},
  //   position: { x: 300, y: 50 },
  // },
  {
    id: '4',
    type: 'concat',
    data: {},
    position: { x: 300, y: 200 },
  },
];

export const initialEdges = [
  // {
  //   id: '1-2',
  //   source: '1',
  //   target: '2',
  //   type: 'smoothstep',
  //   label: 'to the',
  //   animated: true,
  // },
  // {
  //   id: 'edge-1',
  //   source: '3',
  //   target: '4',
  //   type: 'custom-edge',
  // },
  // {
  //   id: 'e1-3',
  //   source: '1',
  //   target: '3',
  //   type: 'custom-edge',
  // },
  // {
  //   id: 'e2-3',
  //   source: '2',
  //   target: '3',
  // },
  {
    id: 'e1-4-top',
    source: '1',
    target: '4',
    targetHandle: 'top-input',
  },
  {
    id: 'e2-4-bottom',
    source: '2',
    target: '4',
    targetHandle: 'bottom-input',
  },
];