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
    const text = await glmChat(buildCompanyPrompt(projects[0] as never, parsed.data.market), { fast: true })
    const { rows, dropped } = parseCompanies(extractJson(text))

    const capped = rows.slice(0, 20)
    let inserted = 0
    let failed = 0
    for (const r of capped) {
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
    return Response.json({ inserted, dropped: dropped + (rows.length - capped.length) + failed })
  } catch (e) { return errorResponse(e) }
}
