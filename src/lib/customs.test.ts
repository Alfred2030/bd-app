import { describe, it, expect } from 'vitest'
import {
  trimCustomsMarkdown, extractSupplierSlugs, scrubSource, safeDate, parseBuyerExtract, CUSTOMS_SURCHARGE,
} from './customs'
import { costCents } from './pricing'

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
})
