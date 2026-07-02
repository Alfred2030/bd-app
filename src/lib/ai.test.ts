import { describe, it, expect } from 'vitest'
import { extractJson } from './glm'
import { parseCompanies, parseSequence } from './ai'

describe('extractJson', () => {
  it('parses fenced json', () => {
    expect(extractJson('前言```json\n[{"a":1}]\n```后记')).toEqual([{ a: 1 }])
  })
  it('parses bare json with noise', () => {
    expect(extractJson('答案如下 [{"a":1}] 完')).toEqual([{ a: 1 }])
  })
  it('throws on garbage', () => {
    expect(() => extractJson('没有 JSON')).toThrow()
  })
})

describe('parseCompanies', () => {
  it('keeps valid rows, drops bad rows', () => {
    const raw = [
      { name: 'Acme Tools GmbH', country: 'Germany', city: 'Köln', website: 'https://acme.de',
        competitor_brands_carried: ['BrandX'], main_distribution: 'cutting tools',
        end_industries: 'automotive', size_estimate: '50-100', fit_score: 4, priority: 'A', reason: 'carries BrandX' },
      { name: '', country: 'US' },            // 缺 name → 丢
      { name: 'NoScore Inc', country: 'US', fit_score: 99 }, // fit_score 越界 → 丢
    ]
    const { rows, dropped } = parseCompanies(raw)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Acme Tools GmbH')
    expect(dropped).toBe(2)
  })
  it('returns empty on non-array', () => {
    expect(parseCompanies({ nope: 1 })).toEqual({ rows: [], dropped: 0 })
  })
})

describe('parseSequence', () => {
  it('accepts full sequence', () => {
    const seq = {
      email1: { subject: 'S1', body: 'B1' },
      email2: { subject: 'S2', body: 'B2' },
      email3: { subject: 'S3', body: 'B3' },
      linkedin_note: 'hi', linkedin_followup: 'again',
    }
    expect(parseSequence(seq)).toEqual(seq)
  })
  it('throws when an email missing', () => {
    expect(() => parseSequence({ email1: { subject: 's', body: 'b' } })).toThrow()
  })
})
