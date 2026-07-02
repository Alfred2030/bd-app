import { z } from 'zod'
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertProjectOwner, errorResponse } from '@/lib/tenant'

const Body = z.object({
  name: z.string().min(1),
  country: z.string().default(''),
  city: z.string().default(''),
  website: z.string().default(''),
  competitorBrandsCarried: z.array(z.string()).default([]),
  mainDistribution: z.string().default(''),
  endIndustries: z.string().default(''),
  sizeEstimate: z.string().default(''),
  fitScore: z.number().int().min(1).max(5).default(3),
  priority: z.enum(['A', 'B', 'C']).default('B'),
  notes: z.string().default(''),
})

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const pid = Number((await ctx.params).id)
    await assertProjectOwner(pid, u.uid)
    const rows = await sql`
      SELECT c.*, a.stage FROM companies c
      LEFT JOIN activities a ON a.company_id = c.id
      WHERE c.project_id = ${pid}
      ORDER BY c.priority ASC, c.fit_score DESC, c.id DESC`
    return Response.json(rows)
  } catch (e) { return errorResponse(e) }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const pid = Number((await ctx.params).id)
    await assertProjectOwner(pid, u.uid)
    const parsed = Body.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return Response.json({ error: '参数不合法' }, { status: 400 })
    const b = parsed.data
    const rows = await sql`
      INSERT INTO companies (project_id, name, country, city, website, source,
        competitor_brands_carried, main_distribution, end_industries, size_estimate,
        fit_score, priority, verify_status, notes)
      VALUES (${pid}, ${b.name}, ${b.country}, ${b.city}, ${b.website}, 'manual',
        ${b.competitorBrandsCarried}, ${b.mainDistribution}, ${b.endIndustries}, ${b.sizeEstimate},
        ${b.fitScore}, ${b.priority}, 'unverified', ${b.notes})
      RETURNING id`
    await sql`INSERT INTO activities (company_id) VALUES (${rows[0].id}) ON CONFLICT DO NOTHING`
    return Response.json({ id: rows[0].id }, { status: 201 })
  } catch (e) { return errorResponse(e) }
}
