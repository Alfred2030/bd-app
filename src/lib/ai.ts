import { z } from 'zod'

export const CompanyRowSchema = z.object({
  name: z.string().min(1),
  country: z.string().default(''),
  city: z.string().default(''),
  website: z.string().default(''),
  competitor_brands_carried: z.array(z.string()).default([]),
  main_distribution: z.string().default(''),
  end_industries: z.string().default(''),
  size_estimate: z.string().default(''),
  fit_score: z.number().int().min(1).max(5).default(3),
  priority: z.enum(['A', 'B', 'C']).default('B'),
  reason: z.string().default(''),
})
export type CompanyRow = z.infer<typeof CompanyRowSchema>

export function parseCompanies(raw: unknown): { rows: CompanyRow[]; dropped: number } {
  if (!Array.isArray(raw)) return { rows: [], dropped: 0 }
  const rows: CompanyRow[] = []
  let dropped = 0
  for (const item of raw) {
    const r = CompanyRowSchema.safeParse(item)
    if (r.success) rows.push(r.data)
    else dropped++
  }
  return { rows, dropped }
}

const EmailSchema = z.object({ subject: z.string().min(1), body: z.string().min(1) })
export const SequenceSchema = z.object({
  email1: EmailSchema,
  email2: EmailSchema,
  email3: EmailSchema,
  linkedin_note: z.string().default(''),
  linkedin_followup: z.string().default(''),
})
export type Sequence = z.infer<typeof SequenceSchema>

export function parseSequence(raw: unknown): Sequence {
  return SequenceSchema.parse(raw)
}

type Project = {
  product_desc: string
  competitor_brands: string[]
  value_props: { priceAdvantage?: string; proofPoints?: string; riskFreeTerms?: string }
  target_industries: string[]
}
type Company = {
  name: string; country: string; website: string
  competitor_brands_carried: string[]; main_distribution: string; end_industries: string
}
type Msg = { role: 'system' | 'user'; content: string }

function projectContext(p: Project): string {
  return [
    `我方产品线：${p.product_desc}`,
    `竞品品牌：${p.competitor_brands.join(', ') || '（未填）'}`,
    `价格优势：${p.value_props.priceAdvantage || '（未填）'}`,
    `量化实证：${p.value_props.proofPoints || '（未填）'}`,
    `零风险条款：${p.value_props.riskFreeTerms || '（未填）'}`,
    `目标终端行业：${p.target_industries.join(', ') || '（未填）'}`,
  ].join('\n')
}

export function buildCompanyPrompt(p: Project, market: string): Msg[] {
  return [
    { role: 'system', content: '你是 B2B 国际渠道开发研究员。只输出 JSON 数组，不要输出任何其他文字。' },
    { role: 'user', content: `${projectContext(p)}

请基于你的行业知识，列出 ${market} 最多 15 家最可能分销此类产品、且很可能在售上述竞品品牌的经销商/分销商/贸易商（不要终端制造工厂）。
每家输出对象字段：name, country, city, website, competitor_brands_carried(字符串数组), main_distribution, end_industries, size_estimate, fit_score(1-5 整数), priority("A"/"B"/"C"), reason(一句话推荐理由)。
注意：这些信息可能过时或不准确，宁缺毋滥，不确定的字段留空字符串。只输出 JSON 数组。` },
  ]
}

export function buildPersonaPrompt(p: Project, c: Company): Msg[] {
  return [
    { role: 'system', content: '你是 B2B 销售研究顾问，用中文回答，简洁分点。' },
    { role: 'user', content: `${projectContext(p)}

目标公司：${c.name}（${c.country}），主营：${c.main_distribution || '未知'}，服务行业：${c.end_industries || '未知'}。
请给出：1) 该找的决策人职位画像（按优先级：采购总监/经理 > 品类/产品经理 > Sourcing Manager；小经销商找 Owner/BD），结合该公司规模给出具体建议；2) 3 条可直接粘贴到 LinkedIn 搜索框的英文搜索词；3) 邮箱验证注意事项（推测/catch-all 地址退信风险提示）。` },
  ]
}

export function buildSequencePrompt(p: Project, c: Company, contactName?: string): Msg[] {
  return [
    { role: 'system', content: 'You are a senior B2B cold-outreach copywriter. Output JSON only, no other text.' },
    { role: 'user', content: `Context (our side):
${projectContext(p)}

Target distributor: ${c.name} (${c.country}), carries competitor brands: ${c.competitor_brands_carried.join(', ') || 'unknown'}.
Contact name: ${contactName || '(unknown, use a neutral greeting)'}

Write a professional, concise, benefit-driven English cold-email sequence (3 emails) plus LinkedIn scripts:
- email1 (Day 0): open by naming the competitor brand(s) they carry ("I noticed you supply ..."), offer our equivalent products with the price advantage and quantified proof points above, and propose a FREE head-to-head cost-per-part test on their customer's own workpiece.
- email2 (+3 days): private-label / OEM angle — we can ship under their own brand.
- email3 (+7 days): zero-risk close using our risk-free terms (e.g. validation period, no-performance-no-deal, consignment stock).
- linkedin_note: connection request message, MAX 300 characters, same competitor hook.
- linkedin_followup: message after they accept.
Every email body must end with an unsubscribe line and a sender address placeholder "[Sender name, Company, Address]".
Output JSON: {"email1":{"subject":"...","body":"..."},"email2":{...},"email3":{...},"linkedin_note":"...","linkedin_followup":"..."}` },
  ]
}

export function buildFollowupPrompt(p: Project, c: Company, activity: { stage: string; last_touch_date: string | null }): Msg[] {
  return [
    { role: 'system', content: 'You are a senior B2B cold-outreach copywriter. Output JSON only: {"subject":"...","body":"..."}' },
    { role: 'user', content: `${projectContext(p)}

Target: ${c.name} (${c.country}), current stage: ${activity.stage}, last touch: ${activity.last_touch_date || 'unknown'}.
They have not replied for 3+ days. Write ONE short English follow-up email (under 120 words) that adds a new angle (a proof point or the risk-free offer) instead of "just checking in". End with an unsubscribe line and "[Sender name, Company, Address]".` },
  ]
}
