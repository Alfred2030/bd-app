import { z } from 'zod'
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertCompanyOwner, errorResponse } from '@/lib/tenant'
import { glmChat, extractJson } from '@/lib/glm'
import { buildFollowupPrompt } from '@/lib/ai'

const Out = z.object({ subject: z.string().min(1), body: z.string().min(1) })

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    const { projectId } = await assertCompanyOwner(cid, u.uid)
    const [project] = await sql`SELECT * FROM projects WHERE id = ${projectId}`
    const [company] = await sql`SELECT * FROM companies WHERE id = ${cid}`
    const [activity] = await sql`SELECT stage, last_touch_date FROM activities WHERE company_id = ${cid}`
    const text = await glmChat(buildFollowupPrompt(project as never, company as never, activity as never), { fast: true })
    return Response.json(Out.parse(extractJson(text)))
  } catch (e) { return errorResponse(e) }
}
