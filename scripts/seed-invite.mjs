import { neon } from '@neondatabase/serverless'
import { randomBytes } from 'node:crypto'

const sql = neon(process.env.DATABASE_URL)
const code = process.argv[2] || `BD-${randomBytes(4).toString('hex').toUpperCase()}`
const maxUses = Number(process.argv[3] || 5)
await sql`INSERT INTO invite_codes (code, max_uses) VALUES (${code}, ${maxUses})
          ON CONFLICT (code) DO UPDATE SET max_uses = ${maxUses}`
console.log(`invite code: ${code} (max_uses=${maxUses})`)
