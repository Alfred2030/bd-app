import * as XLSX from 'xlsx'

type AnyRow = Record<string, unknown>
export type ImportRow = { name: string; country: string; city: string; website: string; priority: 'A' | 'B' | 'C'; notes: string }

export function buildWorkbook(data: { project: AnyRow; companies: AnyRow[]; contacts: AnyRow[]; activities: AnyRow[] }): Buffer {
  const wb = XLSX.utils.book_new()
  const p = data.project
  const vp = (p.value_props ?? {}) as AnyRow

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
    项目: p.name, 产品线: p.product_desc,
    竞品品牌: (p.competitor_brands as string[] ?? []).join(', '),
    价格优势: vp.priceAdvantage ?? '', 量化实证: vp.proofPoints ?? '', 零风险条款: vp.riskFreeTerms ?? '',
    目标市场: (p.target_markets as string[] ?? []).join(', '),
    目标行业: (p.target_industries as string[] ?? []).join(', '),
  }]), '1-项目上下文')

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.companies.map((c, i) => ({
    序号: i + 1, 公司名称: c.name, '国家/地区': c.country, 城市: c.city, 官网: c.website,
    来源: c.source === 'ai' ? 'AI建议·待验证' : c.source === 'import' ? '导入' : '手动',
    在售竞品: (c.competitor_brands_carried as string[] ?? []).join(', '),
    主营分销: c.main_distribution, 服务终端行业: c.end_industries, '规模(估)': c.size_estimate,
    '契合度1-5': c.fit_score, '优先级A/B/C': c.priority,
    验证状态: c.verify_status, 状态: c.status, 备注: c.notes,
  }))), '2-目标客户库')

  const companyName = new Map(data.companies.map(c => [c.id, c.name]))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.contacts.map((t, i) => ({
    序号: i + 1, 公司: companyName.get(t.company_id) ?? '', 姓名: t.name, '职位/角色': t.title,
    'LinkedIn URL': t.linkedin_url, 邮箱: t.email, 邮箱状态: t.email_status, 电话: t.phone,
    优先渠道: t.preferred_channel, 备注: t.notes,
  }))), '3-决策人')

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.activities.map((a, i) => ({
    序号: i + 1, 公司: companyName.get(a.company_id) ?? '', 阶段: a.stage, 渠道: a.channel,
    首触日期: a.first_touch_date ?? '', 跟进1: a.followup1_date ?? '', 跟进2: a.followup2_date ?? '',
    最近触达: a.last_touch_date ?? '', 是否回复: a.replied ? '是' : '否',
    下一步动作: a.next_action, 下一步日期: a.next_action_date ?? '', 备注: a.notes,
  }))), '4-30天追踪')

  const stages = ['2-待发送', '3-草稿就绪', '4-首触已发', '5-跟进中', '6-已回复', '7-约电话/寄样']
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stages.map(s => ({
    阶段: s, 公司数: data.activities.filter(a => a.stage === s).length,
  }))), '看板')

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export function parseImport(buf: Buffer): { rows: ImportRow[]; errors: string[] } {
  const wb = XLSX.read(buf)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<AnyRow>(sheet)
  const rows: ImportRow[] = []
  const errors: string[] = []
  raw.forEach((r, i) => {
    const name = String(r['公司名称'] ?? '').trim()
    if (!name) { errors.push(`第 ${i + 2} 行：缺少公司名称`); return }
    const pr = String(r['优先级'] ?? 'B').trim().toUpperCase()
    rows.push({
      name,
      country: String(r['国家'] ?? r['国家/地区'] ?? '').trim(),
      city: String(r['城市'] ?? '').trim(),
      website: String(r['官网'] ?? '').trim(),
      priority: (['A', 'B', 'C'].includes(pr) ? pr : 'B') as 'A' | 'B' | 'C',
      notes: String(r['备注'] ?? '').trim(),
    })
  })
  return { rows, errors }
}
