import { z } from 'zod'
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertProjectOwner, errorResponse } from '@/lib/tenant'
import { glmChat, extractJson } from '@/lib/glm'
import { parseCompanies, buildCompanyPrompt } from '@/lib/ai'

const Body = z.object({ market: z.string().min(1) })

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const pid = Number((await ctx.params).id)
    await assertProjectOwner(pid, u.uid)
    const parsed = Body.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return Response.json({ error: '请选择目标市场' }, { status: 400 })

    const projects = await sql`SELECT * FROM projects WHERE id = ${pid}`
    // 经销商生成需真实行业知识（分清经销商 vs 品牌制造商），显式用 glm-4.6 保质量；
    // 决策人提取/画像/跟进等读文本/写建议任务用更快的 air（见各自路由 fast:true）。
    const text = await glmChat(buildCompanyPrompt(projects[0] as never, parsed.data.market), { model: 'glm-4.6' })
    const { rows, dropped } = parseCompanies(extractJson(text))

    // 去重：同名（不分大小写）在本批内或库中已存在的跳过，避免 AI 吐重复项重复入库
    const existing = await sql`SELECT lower(name) AS n FROM companies WHERE project_id = ${pid}`
    const seen = new Set<string>(existing.map(e => e.n as string))
    let inserted = 0
    let failed = 0
    let duplicate = 0
    for (const r of rows.slice(0, 20)) {
      const key = r.name.trim().toLowerCase()
      if (seen.has(key)) { duplicate++; continue }
      seen.add(key)
      try {
        const res = await sql`
          INSERT INTO companies (project_id, name, country, city, website, source,
            competitor_brands_carried, main_distribution, end_industries, size_estimate,
            fit_score, priority, verify_status, notes)
          VALUES (${pid}, ${r.name}, ${r.country || parsed.data.market}, ${r.city}, ${r.website}, 'ai',
            ${r.competitor_brands_carried}, ${r.main_distribution}, ${r.end_industries}, ${r.size_estimate},
            ${r.fit_score}, ${r.priority}, 'unverified', ${r.reason})
          RETURNING id`
        await sql`INSERT INTO activities (company_id) VALUES (${res[0].id}) ON CONFLICT DO NOTHING`
        inserted++
      } catch (rowErr) {
        console.error('generate row insert failed:', rowErr)
        failed++
      }
    }
    return Response.json({ inserted, dropped: dropped + failed, duplicate })
  } catch (e) { return errorResponse(e) }
}
