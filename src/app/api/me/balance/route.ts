import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { errorResponse } from '@/lib/tenant'

// 用户端只看金额（余额 / 累计已用），不暴露 token 数——token 明细仅管理员后台可见。
export async function GET() {
  try {
    const u = await requireUser()
    const rows = await sql`
      SELECT u.balance_cents, u.metering_enabled,
        COALESCE((SELECT SUM(billed_cents) FROM llm_usage WHERE user_id = u.id), 0) AS spent_cents
      FROM users u WHERE u.id = ${u.uid}`
    const r = rows[0] || {}
    return Response.json({
      balance_cents: Number(r.balance_cents || 0),
      spent_cents: Number(r.spent_cents || 0),
      metering_enabled: r.metering_enabled ?? true,
    })
  } catch (e) { return errorResponse(e) }
}
