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

// GLM 输出的常见格式偏差在丢弃前先归一化：null 字段剔除让默认值生效、
// 数字给成字符串、优先级 "a"/"A级"、品牌数组给成逗号分隔字符串。
function coerceCompanyRow(item: unknown): unknown {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) return item
  const r: Record<string, unknown> = { ...(item as Record<string, unknown>) }
  for (const k of Object.keys(r)) if (r[k] === null) delete r[k]
  if (typeof r.competitor_brands_carried === 'string')
    r.competitor_brands_carried = r.competitor_brands_carried.split(/[,;，、|]/).map(s => s.trim()).filter(Boolean)
  if (Array.isArray(r.competitor_brands_carried))
    r.competitor_brands_carried = r.competitor_brands_carried.map(b => String(b)).filter(Boolean)
  if (typeof r.fit_score === 'string' && r.fit_score.trim() !== '') r.fit_score = Number(r.fit_score)
  if (typeof r.fit_score === 'number' && Number.isFinite(r.fit_score))
    r.fit_score = Math.min(5, Math.max(1, Math.round(r.fit_score)))
  else delete r.fit_score
  if (typeof r.priority === 'string') {
    const p = r.priority.trim().toUpperCase().charAt(0)
    if (['A', 'B', 'C'].includes(p)) r.priority = p
    else delete r.priority
  }
  for (const k of ['name', 'country', 'city', 'website', 'main_distribution', 'end_industries', 'size_estimate', 'reason'])
    if (r[k] !== undefined && typeof r[k] !== 'string') r[k] = String(r[k])
  return r
}

export function parseCompanies(raw: unknown): { rows: CompanyRow[]; dropped: number } {
  if (!Array.isArray(raw)) return { rows: [], dropped: 0 }
  const rows: CompanyRow[] = []
  let dropped = 0
  for (const item of raw) {
    const r = CompanyRowSchema.safeParse(coerceCompanyRow(item))
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

export const ContactCandidateSchema = z.object({
  name: z.string().min(1),
  title: z.string().default(''),
  linkedin_url: z.string().default(''),
  reason: z.string().default(''),
})
export type ContactCandidate = z.infer<typeof ContactCandidateSchema>

export function parseContactCandidates(raw: unknown): { rows: ContactCandidate[]; dropped: number } {
  if (!Array.isArray(raw)) return { rows: [], dropped: 0 }
  const rows: ContactCandidate[] = []
  let dropped = 0
  for (const item of raw) {
    const r = ContactCandidateSchema.safeParse(item)
    if (r.success) rows.push(r.data)
    else dropped++
  }
  return { rows, dropped }
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

// 序列语言：英语默认 + 按目标国自动 + 18 种目标市场语言（欧洲 11 种 + 日/韩/俄/阿拉伯/泰/越南/印尼）
export const SEQUENCE_LANGUAGES: Record<string, string> = {
  en: 'English',
  auto: 'AUTO',
  fr: 'French',
  it: 'Italian',
  es: 'Spanish',
  'pt-BR': 'Brazilian Portuguese',
  'pt-PT': 'European Portuguese',
  de: 'German',
  nl: 'Dutch',
  sv: 'Swedish',
  pl: 'Polish',
  cs: 'Czech',
  tr: 'Turkish',
  ja: 'Japanese',
  ko: 'Korean',
  ru: 'Russian',
  ar: 'Arabic',
  th: 'Thai',
  vi: 'Vietnamese',
  id: 'Indonesian',
}

export function buildSequencePrompt(p: Project, c: Company, contactName?: string, language = 'en'): Msg[] {
  const langName = SEQUENCE_LANGUAGES[language] ?? 'English'
  const langInstruction =
    language === 'auto'
      ? `Write ALL email subjects/bodies and LinkedIn scripts in the primary business language of ${c.country || 'the target country'} (e.g. German for Germany/Austria, French for France, Italian for Italy, Spanish for Spain/Mexico, Portuguese for Brazil/Portugal, Dutch for Netherlands/Belgium, Swedish for Sweden, Polish for Poland, Czech for Czechia, Turkish for Turkey, Japanese for Japan, Korean for South Korea, Russian for Russia/CIS, Arabic for Middle East/North Africa, Thai for Thailand, Vietnamese for Vietnam, Indonesian for Indonesia). Keep product/technical terms accurate; if the country's business language is English or ambiguous, use English.`
      : language === 'en'
        ? 'Write everything in English.'
        : `Write ALL email subjects/bodies and LinkedIn scripts in ${langName}, natural native business tone for that market. Keep product/technical terms accurate (industry terms may stay in English where that is customary).`
  return [
    { role: 'system', content: 'You are a senior B2B cold-outreach copywriter. Output JSON only, no other text.' },
    { role: 'user', content: `Context (our side):
${projectContext(p)}

Target distributor: ${c.name} (${c.country}), carries competitor brands: ${c.competitor_brands_carried.join(', ') || 'unknown'}.
Contact name: ${contactName || '(unknown, use a neutral greeting)'}

Language: ${langInstruction}

Write a professional, concise, benefit-driven cold-email sequence (3 emails) plus LinkedIn scripts:
- email1 (Day 0): open by naming the competitor brand(s) they carry ("I noticed you supply ..."), offer our equivalent products with the price advantage and quantified proof points above, and propose a FREE head-to-head cost-per-part test on their customer's own workpiece.
- email2 (+3 days): private-label / OEM angle — we can ship under their own brand.
- email3 (+7 days): zero-risk close using our risk-free terms (e.g. validation period, no-performance-no-deal, consignment stock).
- linkedin_note: connection request message, MAX 300 characters, same competitor hook.
- linkedin_followup: message after they accept.
Every email body must end with an unsubscribe line and a sender address placeholder "[Sender name, Company, Address]".
Output JSON: {"email1":{"subject":"...","body":"..."},"email2":{...},"email3":{...},"linkedin_note":"...","linkedin_followup":"..."}` },
  ]
}

export function buildContactExtractionPrompt(
  p: Project,
  c: Company,
  results: { title: string; description: string; url: string }[],
): Msg[] {
  const list = results
    .map((r, i) => `${i + 1}. 标题：${r.title}\n   摘要：${r.description}\n   链接：${r.url}`)
    .join('\n')
  return [
    { role: 'system', content: '你是 B2B 销售研究员。只依据给到的公开搜索结果做人物提取，绝不编造。只输出 JSON 数组，不要输出任何其他文字。' },
    { role: 'user', content: `${projectContext(p)}

目标公司：${c.name}（${c.country}），主营：${c.main_distribution || '未知'}。

下面是公开网页搜索结果（可能包含 LinkedIn 公开个人页、公司团队页、新闻等）：
${list}

请从中提取最多 5 位**很可能在该公司任职**、且与采购/品类/寻源/产品管理或（小公司的）Owner/BD 相关的真实人物。
每人输出对象字段：name（姓名）, title（职位，未知留空）, linkedin_url（仅当结果里出现该人的 linkedin.com/in 链接才填，否则留空）, reason（依据哪条结果，一句话）。
铁律：结果里没有出现的人绝不能出现在输出里；不确定是否在该公司任职的不要输出。
输出格式铁律：无论提取到几个人，都只输出一个 JSON 数组；一个都提取不到时输出两个字符 []，禁止输出任何解释、说明或其他文字。` },
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
