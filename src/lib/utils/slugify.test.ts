import { describe, expect, it } from 'vitest'
import { slugify, buildDirName } from './slugify'

describe('slugify', () => {
  it('lowercases and hyphenates mixed-case input with punctuation', () => {
    expect(slugify('Poisson Convergence Study!')).toBe(
      'poisson-convergence-study'
    )
  })

  it('collapses multiple separator characters into a single hyphen', () => {
    expect(slugify('a   b--c__d')).toBe('a-b-c-d')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  --hello world--  ')).toBe('hello-world')
  })

  it('returns an empty string for whitespace/punctuation-only input', () => {
    expect(slugify('   ')).toBe('')
    expect(slugify('!!!')).toBe('')
  })
})

describe('buildDirName', () => {
  it('falls back to a timestamp-based name when no custom name is given', () => {
    expect(buildDirName('run')).toMatch(/^run-\d+$/)
    expect(buildDirName('pipeline')).toMatch(/^pipeline-\d+$/)
  })

  it('falls back to a timestamp when the custom name is whitespace-only', () => {
    expect(buildDirName('run', '   ')).toMatch(/^run-\d+$/)
  })

  it('uses the slugified custom name when given', () => {
    expect(buildDirName('run', 'Poisson Study')).toBe('run-poisson-study')
    expect(buildDirName('pipeline', 'Poisson Study')).toBe(
      'pipeline-poisson-study'
    )
  })
})
