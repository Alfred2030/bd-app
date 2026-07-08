import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertCompanyOwner, errorResponse } from '@/lib/tenant'
import { glmChat, extractJson } from '@/lib/glm'
import { buildSequencePrompt, parseSequence, SEQUENCE_LANGUAGES } from '@/lib/ai'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    const { projectId } = await assertCompanyOwner(cid, u.uid)
    const body = await req.json().catch(() => ({}))
    const language = typeof body?.language === 'string' && body.language in SEQUENCE_LANGUAGES ? body.language : 'en'
    const [project] = await sql`SELECT * FROM projects WHERE id = ${projectId}`
    const [company] = await sql`SELECT * FROM companies WHERE id = ${cid}`
    const [contact] = await sql`SELECT name FROM contacts WHERE company_id = ${cid} ORDER BY id LIMIT 1`
    const text = await glmChat(buildSequencePrompt(project as never, company as never, contact?.name as string | undefined, language), { meter: { uid: u.uid, tool: 'bd' } })
    const s = parseSequence(extractJson(text))
    await sql`
      INSERT INTO drafts (company_id, email1, email2, email3, linkedin_note, linkedin_followup, generated_at)
      VALUES (${cid}, ${JSON.stringify(s.email1)}, ${JSON.stringify(s.email2)}, ${JSON.stringify(s.email3)}, ${s.linkedin_note}, ${s.linkedin_followup}, now())
      ON CONFLICT (company_id) DO UPDATE SET
        email1 = EXCLUDED.email1, email2 = EXCLUDED.email2, email3 = EXCLUDED.email3,
        linkedin_note = EXCLUDED.linkedin_note, linkedin_followup = EXCLUDED.linkedin_followup,
        generated_at = now()`
    // 阶段推进到 3-草稿就绪（仅当当前还是 2-待发送）
    await sql`UPDATE activities SET stage = '3-草稿就绪', updated_at = now()
              WHERE company_id = ${cid} AND stage = '2-待发送'`
    const rows = await sql`SELECT * FROM drafts WHERE company_id = ${cid}`
    return Response.json(rows[0])
  } catch (e) { return errorResponse(e) }
}
