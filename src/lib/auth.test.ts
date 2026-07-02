import { describe, it, expect, beforeAll } from 'vitest'
import { hashPassword, verifyPassword, signToken, verifyToken } from './auth'

beforeAll(() => { process.env.JWT_SECRET = 'test-secret-at-least-32-characters!!' })

describe('password', () => {
  it('hashes and verifies', async () => {
    const h = await hashPassword('s3cret')
    expect(h).not.toBe('s3cret')
    expect(await verifyPassword('s3cret', h)).toBe(true)
    expect(await verifyPassword('wrong', h)).toBe(false)
  })
})

describe('jwt', () => {
  it('signs and verifies round-trip', async () => {
    const t = await signToken({ uid: 7, email: 'a@b.com' })
    const p = await verifyToken(t)
    expect(p?.uid).toBe(7)
    expect(p?.email).toBe('a@b.com')
  })
  it('rejects garbage', async () => {
    expect(await verifyToken('not.a.jwt')).toBeNull()
  })
})
