import { sql } from './db'
import { UnauthorizedError } from './session'

export class NotFoundError extends Error {}

export async function assertProjectOwner(projectId: number, uid: number): Promise<void> {
  const rows = await sql`SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${uid}`
  if (rows.length === 0) throw new NotFoundError()
}

export async function assertCompanyOwner(companyId: number, uid: number): Promise<{ projectId: number }> {
  const rows = await sql`
    SELECT c.project_id FROM companies c
    JOIN projects p ON p.id = c.project_id
    WHERE c.id = ${companyId} AND p.user_id = ${uid}`
  if (rows.length === 0) throw new NotFoundError()
  return { projectId: rows[0].project_id as number }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof UnauthorizedError) return Response.json({ error: '未登录' }, { status: 401 })
  if (e instanceof NotFoundError) return Response.json({ error: '不存在' }, { status: 404 })
  console.error(e)
  return Response.json({ error: '服务器错误' }, { status: 500 })
}
