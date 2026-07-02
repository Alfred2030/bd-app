import { z } from 'zod'
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertCompanyOwner, errorResponse } from '@/lib/tenant'

const STAGES = ['2-待发送', '3-草稿就绪', '4-首触已发', '5-跟进中', '6-已回复', '7-约电话/寄样'] as const
const Body = z.object({
  stage: z.enum(STAGES).optional(),
  channel: z.string().optional(),
  firstTouchDate: z.string().nullable().optional(),
  followup1Date: z.string().nullable().optional(),
  followup2Date: z.string().nullable().optional(),
  lastTouchDate: z.string().nullable().optional(),
  replied: z.boolean().optional(),
  nextAction: z.string().optional(),
  nextActionDate: z.string().nullable().optional(),
  notes: z.string().optional(),
})

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    await assertCompanyOwner(cid, u.uid)
    const rows = await sql`SELECT * FROM activities WHERE company_id = ${cid}`
    return Response.json(rows[0] ?? null)
  } catch (e) { return errorResponse(e) }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    await assertCompanyOwner(cid, u.uid)
    const parsed = Body.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return Response.json({ error: '参数不合法' }, { status: 400 })
    const b = parsed.data
    await sql`
      INSERT INTO activities (company_id) VALUES (${cid}) ON CONFLICT DO NOTHING`
    await sql`
      UPDATE activities SET
        stage = COALESCE(${b.stage ?? null}, stage),
        channel = COALESCE(${b.channel ?? null}, channel),
        first_touch_date = COALESCE(${b.firstTouchDate ?? null}, first_touch_date),
        followup1_date = COALESCE(${b.followup1Date ?? null}, followup1_date),
        followup2_date = COALESCE(${b.followup2Date ?? null}, followup2_date),
        last_touch_date = COALESCE(${b.lastTouchDate ?? null}, last_touch_date),
        replied = COALESCE(${b.replied ?? null}, replied),
        next_action = COALESCE(${b.nextAction ?? null}, next_action),
        next_action_date = COALESCE(${b.nextActionDate ?? null}, next_action_date),
        notes = COALESCE(${b.notes ?? null}, notes),
        updated_at = now()
      WHERE company_id = ${cid}`
    return Response.json({ ok: true })
  } catch (e) { return errorResponse(e) }
}
