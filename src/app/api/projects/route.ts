import { z } from 'zod'
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { errorResponse } from '@/lib/tenant'

const Body = z.object({
  name: z.string().min(1),
  productDesc: z.string().min(1),
  competitorBrands: z.array(z.string()).default([]),
  valueProps: z.object({
    priceAdvantage: z.string().default(''),
    proofPoints: z.string().default(''),
    riskFreeTerms: z.string().default(''),
  }).default({ priceAdvantage: '', proofPoints: '', riskFreeTerms: '' }),
  targetMarkets: z.array(z.string()).default([]),
  targetIndustries: z.array(z.string()).default([]),
})

export async function GET() {
  try {
    const u = await requireUser()
    const rows = await sql`
      SELECT id, name, product_desc, competitor_brands, value_props, target_markets, target_industries, created_at
      FROM projects WHERE user_id = ${u.uid} ORDER BY id DESC`
    return Response.json(rows)
  } catch (e) { return errorResponse(e) }
}

export async function POST(req: Request) {
  try {
    const u = await requireUser()
    const parsed = Body.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return Response.json({ error: '参数不合法' }, { status: 400 })
    const b = parsed.data
    const rows = await sql`
      INSERT INTO projects (user_id, name, product_desc, competitor_brands, value_props, target_markets, target_industries)
      VALUES (${u.uid}, ${b.name}, ${b.productDesc}, ${b.competitorBrands}, ${JSON.stringify(b.valueProps)}, ${b.targetMarkets}, ${b.targetIndustries})
      RETURNING id`
    return Response.json({ id: rows[0].id }, { status: 201 })
  } catch (e) { return errorResponse(e) }
}
