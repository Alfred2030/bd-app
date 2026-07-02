import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertCompanyOwner, errorResponse } from '@/lib/tenant'

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const id = Number((await ctx.params).id)
    await assertCompanyOwner(id, u.uid)
    const b = await req.json().catch(() => null)
    if (!b || typeof b !== 'object') return Response.json({ error: '参数不合法' }, { status: 400 })
    if (b.priority != null && !['A', 'B', 'C'].includes(b.priority))
      return Response.json({ error: '优先级不合法' }, { status: 400 })
    if (b.verifyStatus != null && !['unverified', 'verified', 'rejected'].includes(b.verifyStatus))
      return Response.json({ error: '验证状态不合法' }, { status: 400 })
    if (b.fitScore != null && (!Number.isInteger(b.fitScore) || b.fitScore < 1 || b.fitScore > 5))
      return Response.json({ error: '契合度需为 1-5 整数' }, { status: 400 })
    await sql`
      UPDATE companies SET
        name = COALESCE(${b.name ?? null}, name),
        country = COALESCE(${b.country ?? null}, country),
        city = COALESCE(${b.city ?? null}, city),
        website = COALESCE(${b.website ?? null}, website),
        competitor_brands_carried = COALESCE(${b.competitorBrandsCarried ?? null}, competitor_brands_carried),
        main_distribution = COALESCE(${b.mainDistribution ?? null}, main_distribution),
        end_industries = COALESCE(${b.endIndustries ?? null}, end_industries),
        size_estimate = COALESCE(${b.sizeEstimate ?? null}, size_estimate),
        fit_score = COALESCE(${b.fitScore ?? null}, fit_score),
        priority = COALESCE(${b.priority ?? null}, priority),
        verify_status = COALESCE(${b.verifyStatus ?? null}, verify_status),
        status = COALESCE(${b.status ?? null}, status),
        notes = COALESCE(${b.notes ?? null}, notes)
      WHERE id = ${id}`
    return Response.json({ ok: true })
  } catch (e) { return errorResponse(e) }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const id = Number((await ctx.params).id)
    await assertCompanyOwner(id, u.uid)
    await sql`DELETE FROM companies WHERE id = ${id}`
    return Response.json({ ok: true })
  } catch (e) { return errorResponse(e) }
}
