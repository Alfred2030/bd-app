import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { NotFoundError, errorResponse } from '@/lib/tenant'

async function requireAdmin(): Promise<void> {
  const u = await requireUser()
  const admin = process.env.ADMIN_EMAIL
  if (!admin || u.email !== admin) throw new NotFoundError()
}

// 管理员账单总览：逐用户余额 + 本月/累计应收 + 成本 + token（对账用，管理员可见）。
export async function GET() {
  try {
    await requireAdmin()
    const users = await sql`
      SELECT u.id, u.email, u.balance_cents, u.metering_enabled,
        COALESCE(SUM(lu.billed_cents) FILTER (WHERE lu.created_at >= date_trunc('month', now())), 0) AS month_billed,
        COALESCE(SUM(lu.billed_cents), 0) AS total_billed,
        COALESCE(SUM(lu.glm_cost_cents), 0) AS total_cost,
        COALESCE(SUM(lu.prompt_tokens + lu.completion_tokens), 0) AS total_tokens,
        COUNT(lu.id) AS calls
      FROM users u LEFT JOIN llm_usage lu ON lu.user_id = u.id
      GROUP BY u.id, u.email, u.balance_cents, u.metering_enabled
      ORDER BY u.id DESC LIMIT 100`
    return Response.json({ users })
  } catch (e) { return errorResponse(e) }
}

// 充值（topup，默认 ¥299）/ 计量开关（toggle）。
export async function POST(req: Request) {
  try {
    await requireAdmin()
    const b = await req.json().catch(() => ({}))
    const email = String(b?.email || '')
    if (!email) return Response.json({ error: '缺少邮箱' }, { status: 400 })

    if (b.action === 'topup') {
      const yuan = Number(b.yuan)
      if (!(yuan > 0 && yuan <= 100000)) return Response.json({ error: '金额不合法（1–100000 元）' }, { status: 400 })
      const cents = Math.round(yuan * 100)
      const rows = await sql`UPDATE users SET balance_cents = balance_cents + ${cents} WHERE email = ${email} RETURNING id, balance_cents`
      if (!rows.length) return Response.json({ error: '用户不存在' }, { status: 404 })
      await sql`
        INSERT INTO balance_txns (user_id, delta_cents, reason, ref, balance_after)
        VALUES (${rows[0].id}, ${cents}, 'topup', ${String(b.note || 'admin')}, ${Number(rows[0].balance_cents)})`
      return Response.json({ balance_cents: Number(rows[0].balance_cents) })
    }

    if (b.action === 'toggle') {
      const rows = await sql`UPDATE users SET metering_enabled = ${!!b.enabled} WHERE email = ${email} RETURNING metering_enabled`
      if (!rows.length) return Response.json({ error: '用户不存在' }, { status: 404 })
      return Response.json({ metering_enabled: rows[0].metering_enabled })
    }

    return Response.json({ error: '未知操作' }, { status: 400 })
  } catch (e) { return errorResponse(e) }
}
