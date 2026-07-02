import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'node:fs'

const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL not set'); process.exit(1) }
const sql = neon(url)
const ddl = readFileSync('db/schema.sql', 'utf8')
// 按分号切句逐条执行（schema 内无函数体，简单切分安全）
for (const stmt of ddl.split(/;\s*[\r\n]/).map(s => s.trim()).filter(Boolean)) {
  await sql.query(stmt)
}
console.log('migrate done')
