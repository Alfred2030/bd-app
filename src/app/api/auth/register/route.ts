import { z } from 'zod'
import { sql } from '@/lib/db'
import { hashPassword, signToken } from '@/lib/auth'
import { COOKIE_NAME } from '@/lib/session'

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  inviteCode: z.string().min(1),
})

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: '参数不合法（密码至少 8 位）' }, { status: 400 })
  const { email, password, inviteCode } = parsed.data

  const codes = await sql`
    SELECT code FROM invite_codes
    WHERE code = ${inviteCode} AND used_count < max_uses
      AND (expires_at IS NULL OR expires_at > now())`
  if (codes.length === 0) return Response.json({ error: '邀请码无效或已用完' }, { status: 403 })

  const dup = await sql`SELECT id FROM users WHERE email = ${email}`
  if (dup.length > 0) return Response.json({ error: '邮箱已注册' }, { status: 409 })

  const hash = await hashPassword(password)
  const rows = await sql`
    INSERT INTO users (email, password_hash, invite_code_used)
    VALUES (${email}, ${hash}, ${inviteCode}) RETURNING id`
  await sql`UPDATE invite_codes SET used_count = used_count + 1 WHERE code = ${inviteCode}`

  const token = await signToken({ uid: rows[0].id as number, email })
  return new Response(JSON.stringify({ uid: rows[0].id, email }), {
    status: 201,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`,
    },
  })
}
