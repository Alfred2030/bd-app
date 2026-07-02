import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { NotFoundError, errorResponse } from '@/lib/tenant'

async function assertContactOwner(contactId: number, uid: number): Promise<void> {
  const rows = await sql`
    SELECT ct.id FROM contacts ct
    JOIN companies c ON c.id = ct.company_id
    JOIN projects p ON p.id = c.project_id
    WHERE ct.id = ${contactId} AND p.user_id = ${uid}`
  if (rows.length === 0) throw new NotFoundError()
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const id = Number((await ctx.params).id)
    await assertContactOwner(id, u.uid)
    const b = await req.json().catch(() => null)
    if (!b || typeof b !== 'object') return Response.json({ error: '参数不合法' }, { status: 400 })
    if (b.emailStatus != null && !['verified', 'inferred', 'catchall', 'invalid'].includes(b.emailStatus))
      return Response.json({ error: '邮箱状态不合法' }, { status: 400 })
    await sql`
      UPDATE contacts SET
        name = COALESCE(${b.name ?? null}, name),
        title = COALESCE(${b.title ?? null}, title),
        linkedin_url = COALESCE(${b.linkedinUrl ?? null}, linkedin_url),
        email = COALESCE(${b.email ?? null}, email),
        email_status = COALESCE(${b.emailStatus ?? null}, email_status),
        phone = COALESCE(${b.phone ?? null}, phone),
        preferred_channel = COALESCE(${b.preferredChannel ?? null}, preferred_channel),
        notes = COALESCE(${b.notes ?? null}, notes)
      WHERE id = ${id}`
    return Response.json({ ok: true })
  } catch (e) { return errorResponse(e) }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const id = Number((await ctx.params).id)
    await assertContactOwner(id, u.uid)
    await sql`DELETE FROM contacts WHERE id = ${id}`
    return Response.json({ ok: true })
  } catch (e) { return errorResponse(e) }
}
