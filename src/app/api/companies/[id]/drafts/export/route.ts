import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertCompanyOwner, errorResponse } from '@/lib/tenant'
import { buildSequenceDocx } from '@/lib/docx'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    await assertCompanyOwner(cid, u.uid)
    const [d] = await sql`SELECT * FROM drafts WHERE company_id = ${cid}`
    if (!d || !d.email1) return Response.json({ error: '尚无草稿' }, { status: 404 })
    const [c] = await sql`SELECT name FROM companies WHERE id = ${cid}`
    const buf = await buildSequenceDocx(c.name as string, d as never)
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="sequence-${cid}.docx"`,
      },
    })
  } catch (e) { return errorResponse(e) }
}
