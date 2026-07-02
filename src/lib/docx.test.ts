import { describe, it, expect } from 'vitest'
import { buildSequenceDocx } from './docx'

describe('buildSequenceDocx', () => {
  it('produces a non-trivial docx buffer', async () => {
    const buf = await buildSequenceDocx('Acme GmbH', {
      email1: { subject: 'S1', body: 'line1\nline2' },
      email2: { subject: 'S2', body: 'B2' },
      email3: { subject: 'S3', body: 'B3' },
      linkedin_note: 'note', linkedin_followup: 'follow',
    })
    expect(buf.length).toBeGreaterThan(1000)
    expect(buf.slice(0, 2).toString()).toBe('PK')
  })
})
