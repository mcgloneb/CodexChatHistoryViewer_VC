import { describe, it, expect } from 'vitest'
import { normalizeRecord, redact } from './normalize'

describe('normalizeRecord', () => {
  it('parses user/assistant messages', () => {
    const u = normalizeRecord({ ts: '2025-01-01T00:00:00Z', message: { role: 'user', content: ['Hi'] } }, 1)
    const a = normalizeRecord({ ts: 1735689600000, message: { role: 'assistant', content: ['Hello'] } }, 2)
    expect(u && u.type).toBe('user')
    expect(a && a.type).toBe('assistant')
  })

  it('parses tool call and result', () => {
    const c = normalizeRecord({ function_call: { name: 'fn', arguments: { a: 1 } }, ts: 1 }, 1)
    const r = normalizeRecord({ function_call_output: { name: 'fn', output: { ok: true } }, ts: 2 }, 2)
    expect(c && c.type).toBe('tool_call')
    expect(r && r.type).toBe('tool_result')
  })

  it('emits reasoning summary as meta', () => {
    const m = normalizeRecord({ reasoning: { summary: 'decision', content: 'secret' }, ts: 3 }, 1)
    expect(m && m.type).toBe('meta')
  })
})

describe('redact', () => {
  it('masks emails, tokens, and long digits', () => {
    const text = 'contact me test@example.com token ABCDEFGHIJKLMNOPQRST and card 1234567890123456'
    const r = redact(text)
    expect(r).not.toContain('test@example.com')
    expect(r).toContain('[REDACTED_TOKEN]')
    expect(r).toContain('[REDACTED_16D]')
  })
})

