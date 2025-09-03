import { describe, it, expect } from 'vitest'
import { dataDir, resolveSafePath } from './path'
import path from 'node:path'

describe('resolveSafePath', () => {
  it('resolves root and subpaths', () => {
    const base = dataDir()
    expect(resolveSafePath('/')).toBe(base)
    expect(resolveSafePath('')).toBe(base)
    const p = resolveSafePath('sub/child')
    expect(p.startsWith(base + path.sep)).toBe(true)
  })

  it('blocks path traversal', () => {
    expect(() => resolveSafePath('../outside')).toThrow()
  })
})
