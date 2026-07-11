import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { errorResponse } from '@/lib/tenant'
import { glmChat, extractJson } from '@/lib/glm'
import { assertBalance, recordDataCost, type MeterCtx } from '@/lib/meter'
import { firecrawlScrape } from '@/lib/firecrawl'
import {
  CUSTOMS_SURCHARGE, FIRECRAWL_COST_CENTS, COVERAGE_CAVEAT,
  searchUrl, supplierUrl, trimCustomsMarkdown, extractSupplierSlugs,
  buildSlugPickPrompt, buildBuyerExtractPrompt, parseBuyerExtract,
} from '@/lib/customs'

export const maxDuration = 300

// 数据源瞬时不可用（抓取失败/空、档案页全读不到）：不扣抓取费、不缓存，返回可重试提示。
const SOURCE_DOWN = { error: '海关数据源暂时不可用，请稍后重试（本次未计抓取费用）。', code: 'SOURCE_UNAVAILABLE' }

type LookupResult = {
  query: string; matched: boolean
  suppliers: unknown[]; buyers: unknown[]
  notes: string; caveat: string; cost_cents: number
}

// POST { query } → 反查竞品的美国海关买家。计费：Firecrawl 抓取成本 + GLM 用量，均按 ×3（动态成本）。
// 计费/缓存只发生在「真无匹配」与「成功抽取」两类真实结果上；一切瞬时失败都不扣抓取费、不缓存、可免费重试。
export async function POST(req: Request) {
  try {
    const u = await requireUser()
    const body = await req.json().catch(() => ({}))
    const query = String(body?.query || '').trim().replace(/\s+/g, ' ')
    if (query.length < 2) return Response.json({ error: '请输入竞争对手的英文公司名（至少 2 个字符）' }, { status: 400 })
    if (query.length > 120) return Response.json({ error: '公司名过长' }, { status: 400 })
    const norm = query.toLowerCase()

    // 7 天缓存：同一用户查过同一竞品，直接返回，不重复抓取/扣费。
    const cachedRows = await sql`
      SELECT result FROM customs_lookups
      WHERE user_id = ${u.uid} AND query_norm = ${norm} AND created_at > now() - interval '7 days'
      ORDER BY id DESC LIMIT 1`
    if (cachedRows.length) {
      const r = (cachedRows[0].result || {}) as Record<string, unknown>
      return Response.json({ ...r, cached: true, cost_cents: 0 })
    }

    // 前置额度闸门：余额 ≤ 0 直接 402（不产生任何抓取成本）。
    const ctx: MeterCtx = { uid: u.uid, tool: 'customs', surcharge: CUSTOMS_SURCHARGE }
    await assertBalance(ctx)

    // 精确成本口径：只汇总本次（本工具、id 大于基线）真实扣费，避免被同用户并发的其它扣费（如冷邮件）串味。
    const baseRows = await sql`SELECT COALESCE(MAX(id), 0) AS mid FROM llm_usage`
    const startId = Number(baseRows[0]?.mid ?? 0)
    const costSince = async (): Promise<number> => {
      const rows = await sql`
        SELECT COALESCE(SUM(billed_cents), 0) AS c FROM llm_usage
        WHERE user_id = ${u.uid} AND tool = 'customs' AND id > ${startId}`
      return Number(rows[0]?.c ?? 0)
    }
    const saveAndReturn = async (result: LookupResult) => {
      await sql`INSERT INTO customs_lookups (user_id, query, query_norm, matched, buyers_count, result, cost_cents)
                VALUES (${u.uid}, ${query}, ${norm}, ${result.matched}, ${result.buyers.length}, ${JSON.stringify(result)}, ${result.cost_cents})`
      return Response.json({ ...result, cached: false })
    }

    let scrapes = 0
    // 1. 搜索抓取（失败或内容为空 = 数据源暂不可用；不扣费、不缓存）
    let searchMd = ''
    try { searchMd = trimCustomsMarkdown(await firecrawlScrape(searchUrl(query))); scrapes++ }
    catch { return Response.json(SOURCE_DOWN, { status: 503 }) }
    if (searchMd.length < 40) return Response.json(SOURCE_DOWN, { status: 503 })

    // 2. 快模型选出确实是该竞品的供应商档案 slug（glmChat 抛错=限流/超时等瞬时，交外层 errorResponse 映射 429/504，
    //    此时尚未 recordDataCost，故不扣抓取费、不缓存）
    const pickText = await glmChat(buildSlugPickPrompt(query, searchMd), { fast: true, meter: ctx, timeoutMs: 120000 })
    let picks: string[] = []
    try {
      const p = extractJson(pickText) as { slugs?: unknown }
      if (Array.isArray(p?.slugs)) picks = p.slugs.map(s => String(s).toLowerCase().replace(/^\/?supplier\//, '').trim())
    } catch { /* 选档解析失败 → 视为无匹配（下方按真结果处理） */ }
    const present = new Set(extractSupplierSlugs(searchMd))
    picks = [...new Set(picks.filter(s => present.has(s)))].slice(0, 2)

    // 真无匹配（搜索页有实质内容 + AI 未指认任何档案）→ 真实结果，扣费 + 缓存
    if (picks.length === 0) {
      await recordDataCost(ctx, 'customs-fetch', scrapes * FIRECRAWL_COST_CENTS)
      const result: LookupResult = {
        query, matched: false, suppliers: [], buyers: [],
        notes: '在美国海关海运进口数据中未找到该竞争对手的清晰匹配记录。可能其对美出口以空运/快递为主（本数据仅含海运），或报关抬头与所查名称不同；可换公司英文全称或已知别名再试。',
        caveat: COVERAGE_CAVEAT, cost_cents: await costSince(),
      }
      return saveAndReturn(result)
    }

    // 3. 抓取供应商档案页（最多 2 个）；全部失败 = 瞬时，不扣抓取费、不缓存
    const profiles: { slug: string; md: string }[] = []
    for (const slug of picks) {
      try {
        const md = trimCustomsMarkdown(await firecrawlScrape(supplierUrl(slug)))
        scrapes++
        if (md.length > 40) profiles.push({ slug, md })
      } catch { /* 单页失败跳过 */ }
    }
    if (profiles.length === 0) return Response.json(SOURCE_DOWN, { status: 503 })

    // 4. 主模型抽取美国买家（glmChat 抛错=瞬时→errorResponse；JSON 解析失败=瞬时格式问题→不扣抓取费不缓存，可免费重试）
    const extractText = await glmChat(buildBuyerExtractPrompt(query, profiles), { meter: ctx, timeoutMs: 240000 })
    let parsedRaw: unknown
    try { parsedRaw = extractJson(extractText) }
    catch { return Response.json({ error: 'AI 分析结果解析失败，请重试（本次未计抓取费用）。', code: 'PARSE_FAILED' }, { status: 502 }) }
    const parsed = parseBuyerExtract(parsedRaw)

    // 5. Firecrawl 抓取成本计费（GLM 用量已在 glmChat 内按 ×3 扣过）
    await recordDataCost(ctx, 'customs-fetch', scrapes * FIRECRAWL_COST_CENTS)
    const result: LookupResult = {
      query, matched: parsed.buyers.length > 0,
      suppliers: parsed.suppliers, buyers: parsed.buyers, notes: parsed.notes,
      caveat: COVERAGE_CAVEAT, cost_cents: await costSince(),
    }
    return saveAndReturn(result)
  } catch (e) { return errorResponse(e) }
}
