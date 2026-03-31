/**
 * Standalone node ID counter, isolated from the rest of the store so that
 * utilities (e.g. flowNodeCreation.ts) can import it without triggering the
 * Electron `window` side-effects that the main nodes store executes on load.
 */

let lastNodeId = $state<number>(0)

/**
 * Overwrite the counter — call this after loading a graph so the next
 * generated ID doesn't collide with existing nodes.
 */
export const setLastNodeId = (id: number): void => {
  lastNodeId = id
}

/**
 * Increment the counter and return the next available node ID.
 */
export const getNextNodeId = (): number => {
  lastNodeId++
  return lastNodeId
}
