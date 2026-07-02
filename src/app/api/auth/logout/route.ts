import { authCookie } from '@/lib/session'

export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': authCookie('', 0),
    },
  })
}
