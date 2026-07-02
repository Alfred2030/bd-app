import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertProjectOwner, errorResponse } from '@/lib/tenant'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const id = Number((await ctx.params).id)
    await assertProjectOwner(id, u.uid)
    const rows = await sql`SELECT * FROM projects WHERE id = ${id}`
    return Response.json(rows[0])
  } catch (e) { return errorResponse(e) }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const id = Number((await ctx.params).id)
    await assertProjectOwner(id, u.uid)
    const b = await req.json()
    await sql`
      UPDATE projects SET
        name = COALESCE(${b.name ?? null}, name),
        product_desc = COALESCE(${b.productDesc ?? null}, product_desc),
        competitor_brands = COALESCE(${b.competitorBrands ?? null}, competitor_brands),
        value_props = COALESCE(${b.valueProps ? JSON.stringify(b.valueProps) : null}, value_props),
        target_markets = COALESCE(${b.targetMarkets ?? null}, target_markets),
        target_industries = COALESCE(${b.targetIndustries ?? null}, target_industries)
      WHERE id = ${id}`
    return Response.json({ ok: true })
  } catch (e) { return errorResponse(e) }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const id = Number((await ctx.params).id)
    await assertProjectOwner(id, u.uid)
    await sql`DELETE FROM projects WHERE id = ${id}`
    return Response.json({ ok: true })
  } catch (e) { return errorResponse(e) }
}
