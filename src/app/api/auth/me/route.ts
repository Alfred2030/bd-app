import { getUser } from '@/lib/session'

export async function GET() {
  const u = await getUser()
  if (!u) return Response.json({ error: '未登录' }, { status: 401 })
  return Response.json(u)
}
