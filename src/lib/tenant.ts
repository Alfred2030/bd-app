import { sql } from './db'
import { UnauthorizedError } from './session'
import { GlmRateLimitError } from './glm'
import { QuotaExceededError } from './meter'

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
  // 预付费余额耗尽（自动停止）：引导用户去充值页扫码续充
  if (e instanceof QuotaExceededError) {
    return Response.json({ error: 'AI 余额不足，功能已暂停。请前往「充值」页扫码预充值后继续使用。', code: 'INSUFFICIENT_BALANCE' }, { status: 402 })
  }
  // AI 账户限流（429 / 智谱 code 1302）：给用户可操作的提示，而非笼统「服务器错误」
  if (e instanceof GlmRateLimitError || (e instanceof Error && /GLM API 429|1302|速率限制/.test(e.message))) {
    console.error('GLM rate limited:', e instanceof Error ? e.message : e)
    return Response.json({ error: 'AI 服务繁忙（已达调用频率上限），请等 10–20 秒再试；同时开多个标签一起生成更容易触发限流，建议一个个来。' }, { status: 429 })
  }
  // AI 超时/中断
  if (e instanceof Error && (e.name === 'AbortError' || /aborted|timeout|超时/i.test(e.message))) {
    console.error('GLM timeout:', e.message)
    return Response.json({ error: 'AI 生成超时（模型排队较久），请稍后重试。' }, { status: 504 })
  }
  console.error(e)
  return Response.json({ error: '服务器错误' }, { status: 500 })
}
