import { neon } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}
const sql = neon(url)
try {
  const result = await sql.query('SELECT table_name FROM information_schema.tables WHERE table_schema = $1', ['public'])
  const tables = result.map(x => x.table_name).sort()
  console.log('Tables:', tables.join(','))
  // 校验必需表是否齐全（随迁移增加而扩展），不再硬编码总数。
  const required = [
    'users', 'invite_codes', 'projects', 'companies', 'contacts', 'drafts', 'activities',
    'model_rates', 'llm_usage', 'balance_txns', 'customs_lookups',
  ]
  const missing = required.filter(t => !tables.includes(t))
  if (missing.length === 0) {
    console.log(`✓ All ${required.length} required tables present (${tables.length} total)`)
  } else {
    console.error(`✗ Missing tables: ${missing.join(', ')}`)
    process.exit(1)
  }
} catch (error) {
  console.error('Error:', error.message)
  process.exit(1)
}
