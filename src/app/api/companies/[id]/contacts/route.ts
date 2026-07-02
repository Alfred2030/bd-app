import { z } from 'zod'
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertCompanyOwner, errorResponse } from '@/lib/tenant'

const Body = z.object({
  name: z.string().default(''),
  title: z.string().default(''),
  linkedinUrl: z.string().default(''),
  email: z.string().default(''),
  emailStatus: z.enum(['verified', 'inferred', 'catchall', 'invalid']).default('inferred'),
  phone: z.string().default(''),
  preferredChannel: z.string().default(''),
  notes: z.string().default(''),
})

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    await assertCompanyOwner(cid, u.uid)
    return Response.json(await sql`SELECT * FROM contacts WHERE company_id = ${cid} ORDER BY id`)
  } catch (e) { return errorResponse(e) }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    await assertCompanyOwner(cid, u.uid)
    const parsed = Body.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return Response.json({ error: '参数不合法' }, { status: 400 })
    const b = parsed.data
    const rows = await sql`
      INSERT INTO contacts (company_id, name, title, linkedin_url, email, email_status, phone, preferred_channel, notes)
      VALUES (${cid}, ${b.name}, ${b.title}, ${b.linkedinUrl}, ${b.email}, ${b.emailStatus}, ${b.phone}, ${b.preferredChannel}, ${b.notes})
      RETURNING id`
    return Response.json({ id: rows[0].id }, { status: 201 })
  } catch (e) { return errorResponse(e) }
}
