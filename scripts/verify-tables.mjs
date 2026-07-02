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
  if (tables.length === 7) {
    console.log('✓ All 7 tables created successfully')
  } else {
    console.error(`✗ Expected 7 tables, found ${tables.length}`)
    process.exit(1)
  }
} catch (error) {
  console.error('Error:', error.message)
  process.exit(1)
}
