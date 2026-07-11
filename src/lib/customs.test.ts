import { describe, it, expect } from 'vitest'
import {
  trimCustomsMarkdown, extractSupplierSlugs, scrubSource, safeDate, parseBuyerExtract, mergeBuyers,
  parseSupplierCandidates, pickSupplierSlugs, CUSTOMS_SURCHARGE,
} from './customs'
import { costCents } from './pricing'

// 贴近真实 ImportYeti 搜索页结构的 markdown 片段
const SEARCH_MD = `
[Ehwa Diamond Ind](https://www.importyeti.com/supplier/ehwa-diamond-ind)

supplier

374 Nambu-Daero Osan Korea

Total Shipments

1,847

[Fujian Ehwa Diamond Tools](https://www.importyeti.com/supplier/fujian-ehwa-diamond-tools)

supplier

Fuzhou Fujian China

Total Shipments

72

[Ehwa Indonesia](https://www.importyeti.com/supplier/ehwa-indonesia)

supplier

Karawang

Total Shipments

1,309

[Diamond Offshore](https://www.importyeti.com/supplier/diamond-offshore)

supplier

Aberdeen UK

Total Shipments

1,251

[Beijing Worldia Diamond Tools](https://www.importyeti.com/supplier/beijing-worldia-diamond-tools)

supplier

Langfang Hebei

Total Shipments

4
`

describe('customs 海关反查工具', () => {
  it('CUSTOMS_SURCHARGE 为 3，且 costCents 支持覆盖系数', () => {
    expect(CUSTOMS_SURCHARGE).toBe(3)
    const { glm, billed } = costCents({ in: 1.25, out: 1.25 }, 1000, 1000, CUSTOMS_SURCHARGE)
    expect(glm).toBeCloseTo(2.5, 6)
    expect(billed).toBeCloseTo(7.5, 6) // 2.5 × 3
  })

  it('trimCustomsMarkdown 砍掉尾部 API 示例噪声', () => {
    const md = 'A'.repeat(300) + '\n有用内容\n## ImportYeti API\ncurl ...很多噪声'.repeat(50)
    const t = trimCustomsMarkdown(md)
    expect(t).toContain('有用内容')
    expect(t).not.toContain('ImportYeti API')
  })

  it('extractSupplierSlugs 抽出真实档案 slug', () => {
    const md = '[Beijing Worldia Diamond Tools](https://www.importyeti.com/supplier/beijing-worldia-diamond-tools)\n[X](https://www.importyeti.com/supplier/ehwa-diamond-ind)'
    const slugs = extractSupplierSlugs(md)
    expect(slugs).toContain('beijing-worldia-diamond-tools')
    expect(slugs).toContain('ehwa-diamond-ind')
  })

  it('parseSupplierCandidates 解析名称/slug/票数', () => {
    const cands = parseSupplierCandidates(SEARCH_MD)
    expect(cands.length).toBe(5)
    const ehwa = cands.find(c => c.slug === 'ehwa-diamond-ind')!
    expect(ehwa.shipments).toBe(1847)
    expect(ehwa.isSupplier).toBe(true)
  })

  it('pickSupplierSlugs 选中真档案：Ehwa→韩国母公司+福州工厂（按分数/票数），排除 Diamond Offshore', () => {
    const picks = pickSupplierSlugs('Ehwa Diamond', SEARCH_MD)
    expect(picks).toEqual(['ehwa-diamond-ind', 'fujian-ehwa-diamond-tools'])
    expect(picks).not.toContain('diamond-offshore')
  })

  it('pickSupplierSlugs 单一独特词：Worldia→唯一沃尔德档案', () => {
    expect(pickSupplierSlugs('Worldia', SEARCH_MD)).toEqual(['beijing-worldia-diamond-tools'])
    expect(pickSupplierSlugs('Beijing Worldia Diamond Tools', SEARCH_MD)).toEqual(['beijing-worldia-diamond-tools'])
  })

  it('pickSupplierSlugs 无独特词（SF Diamond / 纯泛词）→ 判无匹配返回空', () => {
    expect(pickSupplierSlugs('SF Diamond', SEARCH_MD)).toEqual([])
    expect(pickSupplierSlugs('Diamond Tools', SEARCH_MD)).toEqual([])
  })

  it('scrubSource 抹掉来源网站/平台名（白标），含分隔符变体与裸域名', () => {
    expect(scrubSource('数据来自 ImportYeti 和 importyeti.com/supplier/x')).not.toMatch(/yeti/i)
    expect(scrubSource('见 Panjiva / ImportGenius')).not.toMatch(/panjiva|importgenius/i)
    expect(scrubSource('Import_Yeti 与 import-yeti 变体')).not.toMatch(/yeti/i)
    expect(scrubSource('Export Genius / Volza / Seair / Zauba')).not.toMatch(/export\s*genius|volza|seair|zauba/i)
    expect(scrubSource('普通文字不变')).toBe('普通文字不变')
  })

  it('safeDate 只放行日期样式、拦截夹带文案', () => {
    expect(safeDate('07/07/2026')).toBe('07/07/2026')
    expect(safeDate('2026-07-07')).toBe('2026-07-07')
    expect(safeDate('2026')).toBe('2026')
    expect(safeDate('via ImportYeti 2026-01')).toBe('')
    expect(safeDate('最近一票')).toBe('')
  })

  it('parseBuyerExtract 容错解析 + 抹来源名 + 按信号排序 + 丢无名买家', () => {
    const raw = {
      suppliers: [{ name: 'Ehwa Diamond Ind', slug: 'ehwa-diamond-ind', total_shipments: '1847', most_recent: '07/07/2026' }],
      buyers: [
        { buyer_name: 'Lenox', signal: '低', shipments: '30', pitch: '来自 ImportYeti 的线索' },
        { buyer_name: 'Freud America', signal: '中', shipments: 265 },
        { buyer_name: 'General Tool', signal: '高', shipments: 1464 },
        { buyer_name: '', signal: '高' }, // 无名，应丢弃
      ],
      notes: 'ImportYeti 显示高度集中',
    }
    const { suppliers, buyers, notes } = parseBuyerExtract(raw)
    expect(suppliers[0].total_shipments).toBe(1847)
    expect(buyers.map(b => b.buyer_name)).toEqual(['General Tool', 'Freud America', 'Lenox']) // 高→中→低
    expect(buyers.find(b => b.buyer_name === 'Lenox')!.pitch).not.toMatch(/importyeti/i)
    expect(notes).not.toMatch(/importyeti/i)
  })

  it('parseBuyerExtract 对垃圾输入返回空', () => {
    expect(parseBuyerExtract(null).buyers).toEqual([])
    expect(parseBuyerExtract('nope').suppliers).toEqual([])
  })

  it('mergeBuyers 合并跨档案同一买家：票数求和/来源合并/信号取最高/日期取最近/话术取最强项', () => {
    const merged = mergeBuyers([
      { buyer_name: 'General Tool Inc', location: 'Irvine, CA', products: '金刚石工具', shipments: 1392, most_recent_date: '07/07/2026', source_supplier: 'Ehwa Diamond Ind', signal: '高', pitch: 'A' },
      { buyer_name: 'General Tool', location: '', products: '抛光垫', shipments: 72, most_recent_date: '07/04/2026', source_supplier: 'Fujian Ehwa Diamond Tools', signal: '中', pitch: 'B' },
      { buyer_name: 'Freud America', location: 'NC', products: '锯片', shipments: 265, most_recent_date: '06/18/2026', source_supplier: 'Ehwa Diamond Ind', signal: '中', pitch: 'C' },
    ])
    expect(merged.length).toBe(2)
    const gt = merged.find(b => b.buyer_name.startsWith('General Tool'))!
    expect(gt.shipments).toBe(1464)
    expect(gt.signal).toBe('高')
    expect(gt.most_recent_date).toBe('07/07/2026')
    expect(gt.source_supplier).toContain('Ehwa Diamond Ind')
    expect(gt.source_supplier).toContain('Fujian Ehwa Diamond Tools')
    expect(gt.pitch).toBe('A')
    expect(gt.products).toContain('金刚石工具')
    expect(gt.products).toContain('抛光垫')
  })

  it('parseBuyerExtract 端到端合并同名买家', () => {
    const { buyers } = parseBuyerExtract({
      buyers: [
        { buyer_name: 'General Tool Inc', signal: '高', shipments: 1392, source_supplier: 'Ehwa Diamond Ind' },
        { buyer_name: 'General Tool', signal: '中', shipments: 72, source_supplier: 'Fujian Ehwa Diamond Tools' },
      ],
    })
    expect(buyers.length).toBe(1)
    expect(buyers[0].shipments).toBe(1464)
  })
})
