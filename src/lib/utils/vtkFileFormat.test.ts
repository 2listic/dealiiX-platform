import { describe, expect, it } from 'vitest'
import { isVtkFileName } from './vtkFileFormat'

describe('VTK file recognition', () => {
  it('recognises supported VTK dataset extensions', () => {
    expect(isVtkFileName('results/solution.pvd')).toBe(true)
    expect(isVtkFileName('solution.vtu')).toBe(true)
    expect(isVtkFileName('mesh.VTK')).toBe(true)
    expect(isVtkFileName('partition.pvtu')).toBe(true)
  })

  it('does not classify arbitrary strings as VTK files', () => {
    expect(isVtkFileName('solution.vtu.tmp')).toBe(false)
    expect(isVtkFileName('not a file')).toBe(false)
    expect(isVtkFileName(42)).toBe(false)
  })
})
