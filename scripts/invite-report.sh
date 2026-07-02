#!/bin/bash
# 对账：列出所有邀请码使用情况 + 最近 20 个注册用户
cd "$(dirname "$0")/.." || exit 1
export $(grep DATABASE_URL .env.local)
node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
(async () => {
  console.log('=== 邀请码 ===');
  console.table(await sql.query('SELECT code, used_count, max_uses, created_at::date AS created FROM invite_codes ORDER BY created_at DESC'));
  console.log('=== 最近注册 ===');
  console.table(await sql.query('SELECT email, invite_code_used AS code, created_at::date AS created FROM users ORDER BY id DESC LIMIT 20'));
})();
"
