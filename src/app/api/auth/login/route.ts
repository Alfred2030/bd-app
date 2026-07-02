import { z } from 'zod'
import { sql } from '@/lib/db'
import { verifyPassword, signToken } from '@/lib/auth'
import { COOKIE_NAME } from '@/lib/session'

const Body = z.object({ email: z.string().email(), password: z.string() })

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: '参数不合法' }, { status: 400 })
  const { email, password } = parsed.data
  const rows = await sql`SELECT id, password_hash FROM users WHERE email = ${email}`
  if (rows.length === 0 || !(await verifyPassword(password, rows[0].password_hash as string)))
    return Response.json({ error: '邮箱或密码错误' }, { status: 401 })
  const token = await signToken({ uid: rows[0].id as number, email })
  return new Response(JSON.stringify({ uid: rows[0].id, email }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`,
    },
  })
}
