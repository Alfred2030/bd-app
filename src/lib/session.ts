import { cookies } from 'next/headers'
import { verifyToken } from './auth'

export class UnauthorizedError extends Error {}

export const COOKIE_NAME = 'bd_token'

export function authCookie(token: string, maxAge = 604800): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`
}

export async function getUser(): Promise<{ uid: number; email: string } | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

export async function requireUser(): Promise<{ uid: number; email: string }> {
  const u = await getUser()
  if (!u) throw new UnauthorizedError()
  return u
}
