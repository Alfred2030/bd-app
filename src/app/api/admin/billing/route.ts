import { requireUser } from '@/lib/session'
import { NotFoundError, errorResponse } from '@/lib/tenant'
import { bdSql, ivwSql, funikSql } from '@/lib/db-multi'

async function requireAdmin(): Promise<void> {
  const u = await requireUser()
  const admin = process.env.ADMIN_EMAIL
  if (!admin || u.email !== admin) throw new NotFoundError()
}

type Acct = { key: string; name: string; balance_cents: number; spent_cents: number; metering: boolean }
type Group = { tool: string; label: string; tier: number; keyLabel: string; accounts?: Acct[]; error?: string }

async function safe(fn: () => Promise<Acct[]>): Promise<{ accounts?: Acct[]; error?: string }> {
  try { return { accounts: await fn() } } catch (e) { return { error: (e as Error).message } }
}
const rowsToAccts = (rows: Record<string, unknown>[]): Acct[] =>
  rows.map((r) => ({
    key: String(r.key), name: String(r.name || r.key),
    balance_cents: Number(r.balance_cents || 0), spent_cents: Number(r.spent || 0),
    metering: r.metering === undefined ? true : !!r.metering,
  }))

// 统一计费台总览：跨 3 个 Neon 库汇总 5 个工具的余额/已用。仅 ADMIN_EMAIL 可见。
export async function GET() {
  try {
    await requireAdmin()
    const groups: Group[] = []

    const bd = await safe(async () => rowsToAccts(await bdSql`
      SELECT u.email AS key, u.email AS name, u.balance_cents, u.metering_enabled AS metering,
        (SELECT COALESCE(SUM(billed_cents),0) FROM llm_usage WHERE user_id = u.id) AS spent
      FROM users u ORDER BY u.id DESC LIMIT 200`))
    groups.push({ tool: 'bd', label: '外贸抢单神器', tier: 299, keyLabel: '邮箱', ...bd })

    const ivw = await safe(async () => rowsToAccts(await ivwSql`
      SELECT c.id::text AS key, c.name, c.balance_cents, c.metering_enabled AS metering,
        (SELECT COALESCE(SUM(billed_cents),0) FROM llm_usage WHERE company_id = c.id) AS spent
      FROM companies c ORDER BY c.created_at DESC LIMIT 200`))
    groups.push({ tool: 'interview', label: 'AI 快速面试', tier: 299, keyLabel: '公司', ...ivw })

    const sched = await safe(async () => rowsToAccts(await funikSql`
      SELECT c.id::text AS key, c.name, c.balance_cents, c.metering_enabled AS metering,
        (SELECT COALESCE(SUM(billed_cents),0) FROM llm_usage WHERE company_id = c.id) AS spent
      FROM companies c ORDER BY c.created_at DESC LIMIT 200`))
    groups.push({ tool: 'scheduling', label: 'AI 智能排产', tier: 299, keyLabel: '公司', ...sched })

    const fin = await safe(async () => rowsToAccts(await funikSql`
      SELECT fa.email AS key, fa.email AS name, fa.balance_cents, fa.metering_enabled AS metering,
        (SELECT COALESCE(SUM(billed_cents),0) FROM finance_usage WHERE email = fa.email) AS spent
      FROM finance_accounts fa ORDER BY fa.created_at DESC LIMIT 200`))
    groups.push({ tool: 'finance', label: '财务分析', tier: 299, keyLabel: '邮箱', ...fin })

    const legal = await safe(async () => rowsToAccts(await bdSql`
      SELECT la.email AS key, la.email AS name, la.balance_cents, la.metering_enabled AS metering,
        (SELECT COALESCE(SUM(billed_cents),0) FROM legal_usage WHERE email = la.email) AS spent
      FROM legal_accounts la ORDER BY la.created_at DESC LIMIT 200`))
    groups.push({ tool: 'legal', label: '法律审查', tier: 99, keyLabel: '邮箱', ...legal })

    return Response.json({ groups })
  } catch (e) { return errorResponse(e) }
}

// 充值：{ tool, key, yuan }。按工具写对应库/表。
export async function POST(req: Request) {
  try {
    await requireAdmin()
    const b = await req.json().catch(() => ({}))
    const tool = String(b?.tool || '')
    const key = String(b?.key || '').trim()
    const yuan = Number(b?.yuan)
    if (!key) return Response.json({ error: '缺少账号(邮箱/公司)' }, { status: 400 })
    if (!(yuan > 0 && yuan <= 100000)) return Response.json({ error: '金额不合法（1–100000 元）' }, { status: 400 })
    const cents = Math.round(yuan * 100)
    const note = String(b?.note || 'admin-topup')

    if (tool === 'bd') {
      const rows = await bdSql`UPDATE users SET balance_cents = balance_cents + ${cents} WHERE email = ${key} RETURNING id, balance_cents`
      if (!rows.length) return Response.json({ error: '用户不存在' }, { status: 404 })
      await bdSql`INSERT INTO balance_txns (user_id, delta_cents, reason, ref, balance_after) VALUES (${rows[0].id}, ${cents}, 'topup', ${note}, ${Number(rows[0].balance_cents)})`
      return Response.json({ balance_cents: Number(rows[0].balance_cents) })
    }
    if (tool === 'legal') {
      const rows = await bdSql`UPDATE legal_accounts SET balance_cents = balance_cents + ${cents} WHERE email = ${key} RETURNING balance_cents`
      if (!rows.length) return Response.json({ error: '账户不存在（该邮箱还没用过法律工具）' }, { status: 404 })
      return Response.json({ balance_cents: Number(rows[0].balance_cents) })
    }
    if (tool === 'finance') {
      const rows = await funikSql`UPDATE finance_accounts SET balance_cents = balance_cents + ${cents} WHERE email = ${key} RETURNING balance_cents`
      if (!rows.length) return Response.json({ error: '账户不存在（该邮箱还没用过财务工具）' }, { status: 404 })
      return Response.json({ balance_cents: Number(rows[0].balance_cents) })
    }
    if (tool === 'interview' || tool === 'scheduling') {
      const db = tool === 'interview' ? ivwSql : funikSql
      const rows = await db`UPDATE companies SET balance_cents = balance_cents + ${cents} WHERE id::text = ${key} RETURNING id, balance_cents`
      if (!rows.length) return Response.json({ error: '公司不存在' }, { status: 404 })
      await db`INSERT INTO balance_txns (company_id, delta_cents, reason, ref, balance_after) VALUES (${rows[0].id}, ${cents}, 'topup', ${note}, ${Number(rows[0].balance_cents)})`
      return Response.json({ balance_cents: Number(rows[0].balance_cents) })
    }
    return Response.json({ error: '未知工具' }, { status: 400 })
  } catch (e) { return errorResponse(e) }
}
