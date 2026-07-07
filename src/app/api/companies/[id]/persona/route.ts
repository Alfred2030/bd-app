import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertCompanyOwner, errorResponse } from '@/lib/tenant'
import { glmChat } from '@/lib/glm'
import { buildPersonaPrompt } from '@/lib/ai'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    const { projectId } = await assertCompanyOwner(cid, u.uid)
    const [project] = await sql`SELECT * FROM projects WHERE id = ${projectId}`
    const [company] = await sql`SELECT * FROM companies WHERE id = ${cid}`
    const text = await glmChat(buildPersonaPrompt(project as never, company as never), { fast: true })
    return Response.json({ text })
  } catch (e) { return errorResponse(e) }
}
