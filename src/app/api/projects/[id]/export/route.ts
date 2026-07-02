import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertProjectOwner, errorResponse } from '@/lib/tenant'
import { buildWorkbook } from '@/lib/xlsx'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const pid = Number((await ctx.params).id)
    await assertProjectOwner(pid, u.uid)
    const [project] = await sql`SELECT * FROM projects WHERE id = ${pid}`
    const companies = await sql`SELECT * FROM companies WHERE project_id = ${pid} ORDER BY id`
    const contacts = await sql`
      SELECT ct.* FROM contacts ct JOIN companies c ON c.id = ct.company_id
      WHERE c.project_id = ${pid} ORDER BY ct.id`
    const activities = await sql`
      SELECT a.* FROM activities a JOIN companies c ON c.id = a.company_id
      WHERE c.project_id = ${pid} ORDER BY a.id`
    const buf = buildWorkbook({ project, companies, contacts, activities } as never)
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="bd-tracker-${pid}.xlsx"`,
      },
    })
  } catch (e) { return errorResponse(e) }
}
