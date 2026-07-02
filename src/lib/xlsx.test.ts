import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { buildWorkbook, parseImport } from './xlsx'

const sample = {
  project: { name: 'P', product_desc: 'tools', competitor_brands: ['X'], value_props: {}, target_markets: ['DE'], target_industries: [] },
  companies: [{ id: 1, name: 'Acme', country: 'DE', city: '', website: '', source: 'ai', competitor_brands_carried: ['X'], main_distribution: '', end_industries: '', size_estimate: '', fit_score: 4, priority: 'A', verify_status: 'unverified', status: '', notes: '' }],
  contacts: [{ company_id: 1, name: 'Jo', title: 'Buyer', linkedin_url: '', email: 'jo@acme.de', email_status: 'inferred', phone: '', preferred_channel: '', notes: '' }],
  activities: [{ company_id: 1, stage: '2-待发送', channel: '', first_touch_date: null, followup1_date: null, followup2_date: null, last_touch_date: null, replied: false, next_action: '', next_action_date: null, notes: '' }],
}

describe('buildWorkbook', () => {
  it('produces 5 tabs with company row', () => {
    const buf = buildWorkbook(sample as never)
    const wb = XLSX.read(buf)
    expect(wb.SheetNames).toEqual(['1-项目上下文', '2-目标客户库', '3-决策人', '4-30天追踪', '看板'])
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['2-目标客户库'])
    expect(rows[0]['公司名称']).toBe('Acme')
  })
})

describe('parseImport', () => {
  it('reads rows and reports bad ones', () => {
    const ws = XLSX.utils.json_to_sheet([
      { 公司名称: 'Beta GmbH', 国家: 'Germany', 城市: 'Berlin', 官网: 'https://beta.de', 优先级: 'A', 备注: '' },
      { 公司名称: '', 国家: 'US' },
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const { rows, errors } = parseImport(buf)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Beta GmbH')
    expect(errors).toHaveLength(1)
  })
})
