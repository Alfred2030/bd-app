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
    // cur is guaranteed to exist after the ensure-INSERT above.
    const [cur] = await sql`SELECT * FROM activities WHERE company_id = ${cid}`
    const pick = <T,>(v: T | undefined, curV: T): T => (v === undefined ? curV : v)
    await sql`
      UPDATE activities SET
        stage = ${pick(b.stage, cur.stage)},
        channel = ${pick(b.channel, cur.channel)},
        first_touch_date = ${pick(b.firstTouchDate, cur.first_touch_date)},
        followup1_date = ${pick(b.followup1Date, cur.followup1_date)},
        followup2_date = ${pick(b.followup2Date, cur.followup2_date)},
        last_touch_date = ${pick(b.lastTouchDate, cur.last_touch_date)},
        replied = ${pick(b.replied, cur.replied)},
        next_action = ${pick(b.nextAction, cur.next_action)},
        next_action_date = ${pick(b.nextActionDate, cur.next_action_date)},
        notes = ${pick(b.notes, cur.notes)},
        updated_at = now()
      WHERE company_id = ${cid}`
    return Response.json({ ok: true })
  } catch (e) { return errorResponse(e) }
}
