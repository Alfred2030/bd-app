import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertProjectOwner, errorResponse } from '@/lib/tenant'
import { parseImport } from '@/lib/xlsx'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const pid = Number((await ctx.params).id)
    await assertProjectOwner(pid, u.uid)
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return Response.json({ error: '缺少文件' }, { status: 400 })
    const { rows, errors } = parseImport(Buffer.from(await file.arrayBuffer()))
    let inserted = 0
    for (const r of rows) {
      const res = await sql`
        INSERT INTO companies (project_id, name, country, city, website, source, priority, notes)
        VALUES (${pid}, ${r.name}, ${r.country}, ${r.city}, ${r.website}, 'import', ${r.priority}, ${r.notes})
        RETURNING id`
      await sql`INSERT INTO activities (company_id) VALUES (${res[0].id}) ON CONFLICT DO NOTHING`
      inserted++
    }
    return Response.json({ inserted, errors })
  } catch (e) { return errorResponse(e) }
}
