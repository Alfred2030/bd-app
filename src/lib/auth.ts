import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET!)

export function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10)
}

export function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash)
}

export async function signToken(payload: { uid: number; email: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret())
}

export async function verifyToken(token: string): Promise<{ uid: number; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    return { uid: payload.uid as number, email: payload.email as string }
  } catch {
    return null
  }
}
