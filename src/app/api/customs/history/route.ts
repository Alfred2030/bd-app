import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { errorResponse } from '@/lib/tenant'

// 当前用户最近的海关反查记录（列表用；点击可在 7 天缓存内免费复看）。
export async function GET() {
  try {
    const u = await requireUser()
    const rows = await sql`
      SELECT query, matched, buyers_count, created_at
      FROM customs_lookups WHERE user_id = ${u.uid}
      ORDER BY id DESC LIMIT 20`
    return Response.json(rows.map(r => ({
      query: String(r.query),
      matched: !!r.matched,
      buyers_count: Number(r.buyers_count || 0),
      created_at: r.created_at,
    })))
  } catch (e) { return errorResponse(e) }
}
