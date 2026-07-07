import { describe, it, expect } from 'vitest'
import { extractJson } from './glm'
import { parseCompanies, parseSequence, parseContactCandidates, companyKey } from './ai'

describe('companyKey', () => {
  it('normalizes bilingual and suffix variants to the same key', () => {
    expect(companyKey('Hoffmann Gruppe')).toBe(companyKey('Hoffmann Group'))
    expect(companyKey('Würth Industrie Service GmbH & Co. KG')).toBe(companyKey('Würth Industrie Service'))
  })
  it('keeps distinct companies distinct', () => {
    expect(companyKey('Hahn + Kolb')).not.toBe(companyKey('Kistenpfennig'))
  })
})

describe('parseContactCandidates', () => {
  it('keeps valid rows, drops nameless rows', () => {
    const { rows, dropped } = parseContactCandidates([
      { name: 'Jo Buyer', title: 'Purchasing Manager', linkedin_url: 'https://linkedin.com/in/jo', reason: 'result 1' },
      { name: '', title: 'Ghost' },
      { title: 'No name at all' },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Jo Buyer')
    expect(dropped).toBe(2)
  })
  it('returns empty on non-array', () => {
    expect(parseContactCandidates('nope')).toEqual({ rows: [], dropped: 0 })
  })
})

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
  it('recovers when stray brackets precede the payload', () => {
    expect(extractJson('提示 {注意} 结果如下 [{"a":1}] 完')).toEqual([{ a: 1 }])
  })
  it('parses object payload when no valid array slice exists', () => {
    expect(extractJson('注意[未完 结果 {"ok":true} 完')).toEqual({ ok: true })
  })
})

describe('parseCompanies', () => {
  it('keeps valid rows, drops bad rows', () => {
    const raw = [
      { name: 'Acme Tools GmbH', country: 'Germany', city: 'Köln', website: 'https://acme.de',
        competitor_brands_carried: ['BrandX'], main_distribution: 'cutting tools',
        end_industries: 'automotive', size_estimate: '50-100', fit_score: 4, priority: 'A', reason: 'carries BrandX' },
      { name: '', country: 'US' },            // 缺 name → 丢
      { name: 'NoScore Inc', country: 'US', fit_score: 99 }, // fit_score 越界 → 钳制到 5 保留
    ]
    const { rows, dropped } = parseCompanies(raw)
    expect(rows).toHaveLength(2)
    expect(rows[0].name).toBe('Acme Tools GmbH')
    expect(rows[1]).toMatchObject({ name: 'NoScore Inc', fit_score: 5 })
    expect(dropped).toBe(1)
  })
  it('returns empty on non-array', () => {
    expect(parseCompanies({ nope: 1 })).toEqual({ rows: [], dropped: 0 })
  })
  it('coerces sloppy GLM output instead of dropping (null fields, string numbers, lowercase priority, string brands)', () => {
    const { rows, dropped } = parseCompanies([
      { name: 'Null Fields Inc', country: 'Canada', city: null, website: null, competitor_brands_carried: null,
        main_distribution: null, end_industries: null, size_estimate: null, fit_score: null, priority: null, reason: null },
      { name: 'Stringy Ltd', country: 'Canada', fit_score: '4', priority: 'a', competitor_brands_carried: 'Sandvik, Kennametal' },
      { name: 'Overflow Corp', country: 'Canada', fit_score: 9.7, priority: 'B级' },
    ])
    expect(dropped).toBe(0)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ city: '', fit_score: 3, priority: 'B', competitor_brands_carried: [] })
    expect(rows[1]).toMatchObject({ fit_score: 4, priority: 'A', competitor_brands_carried: ['Sandvik', 'Kennametal'] })
    expect(rows[2]).toMatchObject({ fit_score: 5, priority: 'B' })
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
