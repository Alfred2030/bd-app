import { z } from 'zod'

// 「竞争对手客户海关数据」：输入竞品英文公司名 → 反查其在美国海关公开进口(海运提单)记录中的美国买家。
// 数据源是美国海关公开记录（经第三方检索平台渲染抓取），但**对用户一律不暴露任何来源网站/平台名称**（白标）。

// 计费系数：本工具用 ×3（区别于全局 SURCHARGE=2），在路由里通过 MeterCtx.surcharge 传入。
export const CUSTOMS_SURCHARGE = 3
// 每次页面抓取的外部数据成本（分）。可用环境变量覆盖；默认 1 分/次（≈$0.0014）。
export const FIRECRAWL_COST_CENTS = (() => {
  const v = Number(process.env.FIRECRAWL_COST_CENTS)
  return Number.isFinite(v) && v > 0 ? v : 1
})()

// 用户可见的覆盖度说明（诚实、且不含任何来源网站名）。
export const COVERAGE_CAVEAT =
  '数据来源为美国海关海运进口提单公开记录，仅含海运、不含空运/快递。体积小、单价高的刀片类产品多走空运，可能不完整；结果为线索参考，请再行核实。'

const HOST = 'https://www.importyeti.com'
export function searchUrl(query: string): string {
  return `${HOST}/search?q=${encodeURIComponent(query)}`
}
export function supplierUrl(slug: string): string {
  return `${HOST}/supplier/${slug}`
}

// 裁掉抓取页面尾部的固定「API 示例」大段噪声，并限长以控成本/token。
export function trimCustomsMarkdown(md: string, maxLen = 9000): string {
  if (!md) return ''
  let s = md
  for (const marker of ['## ImportYeti API', 'ImportYeti API', 'Sample Request', 'Need API Access']) {
    const i = s.indexOf(marker)
    if (i > 200) { s = s.slice(0, i); break }
  }
  return s.slice(0, maxLen).trim()
}

// 从搜索页 markdown 里提取所有真实出现的供应商档案 slug（用于校验 AI 挑选、防幻觉）。
export function extractSupplierSlugs(md: string): string[] {
  const out = new Set<string>()
  const re = /\/supplier\/([a-z0-9][a-z0-9-]*)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(md)) !== null) out.add(m[1].toLowerCase())
  return [...out]
}

// 输出兜底：抹掉任何可能泄漏的来源网站/平台名称，统一替换为「海关数据」。
// 用 [\W_]* 容忍任意分隔符变体（Import_Yeti / import-yeti / import yeti），并覆盖裸域名与常见同类平台。
const SOURCE_NAMES = /importyeti\.com|import[\W_]*yeti|\byeti\b|panjiva|import[\W_]*genius|export[\W_]*genius|importgenius|exportgenius|datamyne|tendata|trademo|volza|seair|zauba/gi
export function scrubSource(text: string): string {
  if (!text) return ''
  return String(text).replace(SOURCE_NAMES, '海关数据')
}

// 日期守卫：只保留形如 07/07/2026、2026-07-07、2026 的日期样式，其余（可能夹带来源名/说明）一律置空。
export function safeDate(text: string): string {
  const t = scrubSource(String(text || '')).trim()
  return /^[0-9]{1,4}[/\-.][0-9]{1,2}([/\-.][0-9]{1,4})?$|^[0-9]{4}$/.test(t) ? t : ''
}

type Msg = { role: 'system' | 'user'; content: string }

// 第一段（快模型，便宜）：从搜索结果页挑出**确实是该竞品本身**的供应商档案 slug（最多 2 个）。
export function buildSlugPickPrompt(query: string, searchMd: string): Msg[] {
  return [
    { role: 'system', content: '你是外贸海关数据分析助手。只输出 JSON，不要输出任何其他文字。' },
    { role: 'user', content: `下面是针对竞争对手『${query}』在美国海关进口数据检索页的结果内容。请从中挑出**确实是该竞争对手本身**（如中国/韩国等的超硬材料、金刚石/CBN、切削刀具的制造商或出口商）的供应商档案，返回其档案标识 slug（即链接 /supplier/ 后面的那段）。
规则：
- 最多返回 2 个最相关的 slug。
- 严格排除同名泛词的无关公司（例如通用的 Diamond / Crystal / Insert、Diamond Offshore 石油钻井、货代物流、服装、邮轮等）。
- 名称需与所查竞品有实质对应（含其独特词），仅含通用词 "diamond/tools/crystal" 不算匹配。
- 若没有任何可信匹配，返回空数组。
只输出 JSON：{"slugs":["..."],"reason":"一句中文说明"}

检索结果内容：
${searchMd}` },
  ]
}

// 第二段（主模型）：从 1–2 个供应商档案页提取美国买家 + 信号强度 + 开发切入话术。
export function buildBuyerExtractPrompt(query: string, profiles: { slug: string; md: string }[]): Msg[] {
  const body = profiles.map(p => `【档案 ${p.slug}】\n${p.md}`).join('\n\n---\n\n')
  return [
    { role: 'system', content: '你是外贸海关数据分析师，服务一家中国超硬刀具（PCBN/CBN/PCD 金属切削刀片）制造商。只依据给到的海关记录内容提取，绝不编造。只输出 JSON，不要任何其他文字。**输出中严禁出现任何数据来源网站或平台的名称。**' },
    { role: 'user', content: `竞争对手：${query}
下面是它的美国海关进口记录页内容（可能含 1–2 个关联档案）。页面『Customers』表和『Most Recent Sea Shipments/最近海运』表里的 Consignee/Customer（收货人）就是该竞争对手的**美国买家**。

请提取并输出 JSON：{"suppliers":[...],"buyers":[...],"notes":"..."}
- suppliers：读到的该竞品出口商档案，每个对象 {name, slug, address, total_shipments(数字), most_recent(日期字符串)}。
- buyers：美国买家列表，每个对象：
  - buyer_name（买家公司名）
  - location（城市+州，未知留空）
  - products（买的产品/货描，用中文概括，如"金刚石锯片/硬质合金钎焊刀具"）
  - shipments（票数，数字）
  - most_recent_date（最近一票日期，未知留空）
  - source_supplier（来自哪个档案名）
  - signal（该线索强度，只能是 "高"/"中"/"低"；依据：①最近活跃度 2025–2026 为高、2023 前为低 ②票数多寡 ③产品与我方 PCBN/CBN/PCD 金属切削刀片的相关度——车铣刀片/切削刀具=高，金刚石锯片/磨轮/石材工具=中，磨料/砂轮/合成设备=低）
  - pitch（一句中文开发切入话术，点明"它正从该竞品买什么、我方可如何切入替代或补充"）
- notes：一句中文提示（如买家高度集中于某总经销、含与出口方同名的疑似关联方等）。

规则：
- 只列真实出现在记录里的买家，禁止编造；提单保密/未披露的收货人不要列。
- 与出口方同名的疑似其美国自有关联公司，signal 给"低"并在 pitch 里注明"疑似其关联方"。
- **输出中不得出现任何来源网站/平台的名称。**
- 若无有效买家，buyers 用空数组。

海关记录内容：
${body}` },
  ]
}

export const SupplierSchema = z.object({
  name: z.string().default(''),
  slug: z.string().default(''),
  address: z.string().default(''),
  total_shipments: z.coerce.number().catch(0).default(0),
  most_recent: z.string().default(''),
})
export type CustomsSupplier = z.infer<typeof SupplierSchema>

export const BuyerSchema = z.object({
  buyer_name: z.string().min(1),
  location: z.string().default(''),
  products: z.string().default(''),
  shipments: z.coerce.number().catch(0).default(0),
  most_recent_date: z.string().default(''),
  source_supplier: z.string().default(''),
  signal: z.enum(['高', '中', '低']).catch('中'),
  pitch: z.string().default(''),
})
export type CustomsBuyer = z.infer<typeof BuyerSchema>

// 解析主模型输出：容错 + 抹掉来源网站名 + 丢弃无名买家。
export function parseBuyerExtract(raw: unknown): { suppliers: CustomsSupplier[]; buyers: CustomsBuyer[]; notes: string } {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const suppliers: CustomsSupplier[] = []
  for (const s of Array.isArray(obj.suppliers) ? obj.suppliers : []) {
    const r = SupplierSchema.safeParse(s)
    if (r.success) suppliers.push({
      ...r.data,
      name: scrubSource(r.data.name),
      address: scrubSource(r.data.address),
      slug: scrubSource(r.data.slug),
      most_recent: safeDate(r.data.most_recent),
    })
  }
  const buyers: CustomsBuyer[] = []
  for (const b of Array.isArray(obj.buyers) ? obj.buyers : []) {
    const r = BuyerSchema.safeParse(b)
    if (r.success) buyers.push({
      ...r.data,
      buyer_name: scrubSource(r.data.buyer_name),
      products: scrubSource(r.data.products),
      pitch: scrubSource(r.data.pitch),
      location: scrubSource(r.data.location),
      source_supplier: scrubSource(r.data.source_supplier),
      most_recent_date: safeDate(r.data.most_recent_date),
    })
  }
  const notes = scrubSource(typeof obj.notes === 'string' ? obj.notes : '')
  // 信号强度排序：高 > 中 > 低
  const order = { 高: 0, 中: 1, 低: 2 } as const
  buyers.sort((a, b) => order[a.signal] - order[b.signal])
  return { suppliers, buyers, notes }
}
