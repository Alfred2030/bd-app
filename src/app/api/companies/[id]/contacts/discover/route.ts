import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertCompanyOwner, errorResponse } from '@/lib/tenant'
import { glmChat, extractJson } from '@/lib/glm'
import { buildContactExtractionPrompt, parseContactCandidates } from '@/lib/ai'
import { firecrawlSearch, type SearchResult } from '@/lib/firecrawl'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    const { projectId } = await assertCompanyOwner(cid, u.uid)
    if (!process.env.FIRECRAWL_API_KEY) return Response.json({ error: '检索服务未配置' }, { status: 500 })

    const [project] = await sql`SELECT * FROM projects WHERE id = ${projectId}`
    const [company] = await sql`SELECT * FROM companies WHERE id = ${cid}`

    const name = company.name as string
    const queries = [
      `site:linkedin.com/in "${name}" purchasing OR sourcing OR procurement OR "product manager"`,
      `"${name}" ${company.country || ''} purchasing manager OR sourcing manager OR owner`,
    ]
    const settled = await Promise.allSettled(queries.map(q => firecrawlSearch(q, 5)))
    const seen = new Set<string>()
    const results: SearchResult[] = []
    for (const s of settled) {
      if (s.status !== 'fulfilled') continue
      for (const r of s.value) {
        if (seen.has(r.url)) continue
        seen.add(r.url)
        results.push(r)
      }
    }
    if (results.length === 0) {
      if (settled.every(s => s.status === 'rejected')) return Response.json({ error: '检索服务暂不可用，请稍后重试' }, { status: 502 })
      return Response.json({ inserted: 0, found: 0 })
    }

    const prompt = buildContactExtractionPrompt(project as never, company as never, results)
    let parsed: unknown = []
    try {
      parsed = extractJson(await glmChat(prompt, { fast: true }))
    } catch {
      // GLM 偶发输出解释文字而非 JSON：重试一次，再失败按"未找到"处理
      try { parsed = extractJson(await glmChat(prompt, { fast: true })) } catch { parsed = [] }
    }
    const { rows } = parseContactCandidates(parsed)
    const candidates = rows.slice(0, 5)

    const existing = await sql`SELECT lower(name) AS n FROM contacts WHERE company_id = ${cid}`
    const have = new Set(existing.map(e => e.n as string))
    let inserted = 0
    for (const r of candidates) {
      if (have.has(r.name.toLowerCase())) continue
      const linkedin = r.linkedin_url.includes('linkedin.com/') ? r.linkedin_url : ''
      await sql`
        INSERT INTO contacts (company_id, name, title, linkedin_url, email, email_status, preferred_channel, notes)
        VALUES (${cid}, ${r.name}, ${r.title}, ${linkedin}, '', 'inferred', ${linkedin ? 'linkedin' : ''},
          ${'AI 检索·待核实' + (r.reason ? '：' + r.reason : '')})`
      inserted++
    }
    return Response.json({ inserted, found: candidates.length })
  } catch (e) { return errorResponse(e) }
}
