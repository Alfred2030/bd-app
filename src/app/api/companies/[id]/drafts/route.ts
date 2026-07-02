import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertCompanyOwner, errorResponse } from '@/lib/tenant'
import { SequenceSchema } from '@/lib/ai'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    await assertCompanyOwner(cid, u.uid)
    const rows = await sql`SELECT * FROM drafts WHERE company_id = ${cid}`
    return Response.json(rows[0] ?? null)
  } catch (e) { return errorResponse(e) }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    await assertCompanyOwner(cid, u.uid)
    const parsed = SequenceSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return Response.json({ error: '草稿格式不合法' }, { status: 400 })
    const s = parsed.data
    await sql`
      INSERT INTO drafts (company_id, email1, email2, email3, linkedin_note, linkedin_followup, edited_at)
      VALUES (${cid}, ${JSON.stringify(s.email1)}, ${JSON.stringify(s.email2)}, ${JSON.stringify(s.email3)}, ${s.linkedin_note}, ${s.linkedin_followup}, now())
      ON CONFLICT (company_id) DO UPDATE SET
        email1 = EXCLUDED.email1, email2 = EXCLUDED.email2, email3 = EXCLUDED.email3,
        linkedin_note = EXCLUDED.linkedin_note, linkedin_followup = EXCLUDED.linkedin_followup,
        edited_at = now()`
    return Response.json({ ok: true })
  } catch (e) { return errorResponse(e) }
}
