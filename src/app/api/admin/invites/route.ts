import { randomBytes } from 'node:crypto'
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { NotFoundError, errorResponse } from '@/lib/tenant'

async function requireAdmin(): Promise<void> {
  const u = await requireUser()
  const admin = process.env.ADMIN_EMAIL
  if (!admin || u.email !== admin) throw new NotFoundError()
}

export async function GET() {
  try {
    await requireAdmin()
    const codes = await sql`
      SELECT code, used_count, max_uses, created_at::date AS created
      FROM invite_codes ORDER BY created_at DESC, code DESC LIMIT 50`
    const users = await sql`
      SELECT email, invite_code_used, created_at::date AS created
      FROM users ORDER BY id DESC LIMIT 20`
    return Response.json({ codes, users })
  } catch (e) { return errorResponse(e) }
}

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const b = await req.json().catch(() => ({}))
    const maxUses = Number.isInteger(b?.maxUses) && b.maxUses >= 1 && b.maxUses <= 100 ? b.maxUses : 1
    const code = `BD-${randomBytes(4).toString('hex').toUpperCase()}`
    await sql`INSERT INTO invite_codes (code, max_uses) VALUES (${code}, ${maxUses})`
    return Response.json({ code, maxUses }, { status: 201 })
  } catch (e) { return errorResponse(e) }
}
