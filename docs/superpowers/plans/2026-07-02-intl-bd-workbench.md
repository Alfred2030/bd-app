# CXODEX 国际市场开拓工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Funik 经销商开发方法论泛化为多租户在线工作台：项目向导 → AI 生成目标客户库 → 决策人管理 → 冷邮件工坊 → 30 天追踪看板，部署到 bd.cxodex.com。

**Architecture:** Next.js（App Router）全栈单体，API Route Handlers 做后端，Neon Postgres 持久化，GLM API 服务端调用做所有 AI 生成。邮箱+密码+邀请码注册，JWT 存 HttpOnly Cookie，所有业务查询经 project→user 链做租户隔离。

**Tech Stack:** Next.js 15 (TypeScript, App Router) · @neondatabase/serverless · bcryptjs · jose · zod · xlsx (SheetJS) · docx · vitest

## Global Constraints

- 设计文档：`docs/superpowers/specs/2026-07-02-intl-bd-workbench-design.md`（本计划的唯一需求来源）。
- **App 只生成、只管理，永不代发**任何邮件/LinkedIn 消息；冷邮件工坊与看板页面必须显示"本工具不代发，请人工发送"提示。
- AI 生成的公司线索入库时 `source='ai'`、`verify_status='unverified'`，UI 显示"AI 建议 · 待验证"。
- 邮箱状态四态枚举：`verified` / `inferred` / `catchall` / `invalid`；追踪阶段枚举：`2-待发送`,`3-草稿就绪`,`4-首触已发`,`5-跟进中`,`6-已回复`,`7-约电话/寄样`。
- 环境变量（`.env.local`，勿提交）：`DATABASE_URL`（Neon）、`JWT_SECRET`、`GLM_API_KEY`、`GLM_MODEL`（默认 `glm-4.6`，线上可换 glm-5.2）。
- 界面语言中文；AI 产出的冷邮件/LinkedIn 文案为英文。
- Windows/D 盘注意：若 `next build` 报 turbopack 相关错误，改用 `next build --webpack`（既有项目经验）。
- 所有 SQL 用参数化查询（neon tagged template 天然参数化）。
- 租户校验失败返回 404，不泄露资源存在性。
- 提交信息用 conventional commits（feat:/fix:/docs:/test:），每个任务至少一次提交。

## File Structure

```
bd-app/
├─ package.json / tsconfig.json / next.config.ts / vitest.config.ts / .env.example
├─ db/schema.sql                     — 全部建表语句（幂等）
├─ scripts/migrate.mjs               — 执行 schema.sql 到 Neon
├─ scripts/seed-invite.mjs           — 生成邀请码
├─ scripts/smoke.mjs                 — 全链路 API 冒烟脚本
├─ src/lib/db.ts                     — neon 客户端单例
├─ src/lib/auth.ts                   — 密码哈希 + JWT 签发/校验
├─ src/lib/session.ts                — 从 cookie 取当前用户 / requireUser
├─ src/lib/tenant.ts                 — assertProjectOwner / assertCompanyOwner
├─ src/lib/glm.ts                    — GLM chat 调用 + extractJson
├─ src/lib/ai.ts                     — 提示词构建 + zod 校验 + 坏行过滤
├─ src/lib/xlsx.ts                   — 五 tab 导出 + 导入解析
├─ src/lib/docx.ts                   — 邮件序列导出 Word
├─ src/app/api/auth/register/route.ts · login/route.ts · logout/route.ts · me/route.ts
├─ src/app/api/projects/route.ts · [id]/route.ts
├─ src/app/api/projects/[id]/companies/route.ts        — GET 列表 / POST 新增
├─ src/app/api/projects/[id]/companies/generate/route.ts — AI 生成候选
├─ src/app/api/projects/[id]/companies/import/route.ts   — xlsx 导入
├─ src/app/api/projects/[id]/export/route.ts              — xlsx 导出
├─ src/app/api/companies/[id]/route.ts                    — PATCH/DELETE
├─ src/app/api/companies/[id]/contacts/route.ts           — GET/POST
├─ src/app/api/companies/[id]/persona/route.ts            — AI 职位画像
├─ src/app/api/companies/[id]/drafts/route.ts             — GET/PUT
├─ src/app/api/companies/[id]/drafts/generate/route.ts    — AI 三封序列
├─ src/app/api/companies/[id]/drafts/export/route.ts      — docx 导出
├─ src/app/api/companies/[id]/activity/route.ts           — GET/PUT 追踪
├─ src/app/api/companies/[id]/followup/route.ts           — AI 跟进草稿
├─ src/app/api/contacts/[id]/route.ts                     — PATCH/DELETE
├─ src/app/page.tsx                  — 营销首页（免登录）
├─ src/app/login/page.tsx · register/page.tsx
├─ src/app/dashboard/page.tsx        — 项目列表
├─ src/app/projects/new/page.tsx     — 四步项目向导
├─ src/app/projects/[id]/companies/page.tsx
├─ src/app/projects/[id]/contacts/page.tsx
├─ src/app/projects/[id]/drafts/page.tsx
├─ src/app/projects/[id]/board/page.tsx
├─ src/app/projects/[id]/nav.tsx     — 项目内导航（客户端组件）
└─ src/app/globals.css               — 全站样式（单文件）
```

每个 lib 文件一个职责；页面均为客户端组件（`'use client'`），通过 fetch 调 API；API 层负责鉴权与租户隔离。

---

### Task 1: 项目脚手架 + vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`, `.gitignore`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`（占位，Task 12 重写）

**Interfaces:**
- Produces: 可 `npm run dev` / `npm run build` / `npm test` 的空项目骨架。

- [ ] **Step 1: 脚手架**

在 `D:\Projects\Cxodex\bd-app` 运行（目录里已有 docs/ 和 .git，create-next-app 允许非空目录报错时先把 docs 临时移出再移回，或用 `--yes` 配合）：

```powershell
npx create-next-app@15 . --typescript --app --eslint --no-tailwind --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

若因目录非空拒绝：`Move-Item docs ..\bd-app-docs-tmp`，脚手架完成后 `Move-Item ..\bd-app-docs-tmp\* docs` 并删除临时目录。

- [ ] **Step 2: 安装依赖**

```powershell
npm i @neondatabase/serverless bcryptjs jose zod xlsx docx
npm i -D vitest @types/bcryptjs
```

- [ ] **Step 3: vitest 配置与脚本**

创建 `vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
```

`package.json` 的 scripts 改为：

```json
{
  "dev": "next dev -p 3005",
  "build": "next build",
  "start": "next start -p 3005",
  "test": "vitest run",
  "migrate": "node scripts/migrate.mjs",
  "smoke": "node scripts/smoke.mjs"
}
```

- [ ] **Step 4: .env.example**

```
DATABASE_URL=postgres://user:pass@host/db?sslmode=require
JWT_SECRET=change-me-32-chars-minimum-secret
GLM_API_KEY=
GLM_MODEL=glm-4.6
```

确认 `.gitignore` 含 `.env*.local` 与 `node_modules`。

- [ ] **Step 5: 验证构建与测试跑通**

```powershell
npm run build
npm test
```

Expected: build 成功（如报 turbopack 错误，把 build script 改成 `next build --webpack` 再跑）；vitest 输出 "No test files found" 属正常（用 `vitest run --passWithNoTests` 或忽略退出码，后续任务会有测试）。把 `"test": "vitest run --passWithNoTests"` 定下来。

- [ ] **Step 6: Commit**

```powershell
git add -A; git commit -m "feat: scaffold Next.js app with vitest"
```

---

### Task 2: 数据库 schema + 迁移脚本 + db 客户端

**Files:**
- Create: `db/schema.sql`, `scripts/migrate.mjs`, `src/lib/db.ts`

**Interfaces:**
- Produces: `sql` 模板函数（`import { sql } from '@/lib/db'`，用法 `await sql\`SELECT ...\``）；七张表建好。

- [ ] **Step 1: 写 schema.sql（幂等，全量）**

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  invite_code_used TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  max_uses INT NOT NULL DEFAULT 1,
  used_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  product_desc TEXT NOT NULL DEFAULT '',
  competitor_brands TEXT[] NOT NULL DEFAULT '{}',
  value_props JSONB NOT NULL DEFAULT '{}',
  target_markets TEXT[] NOT NULL DEFAULT '{}',
  target_industries TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  competitor_brands_carried TEXT[] NOT NULL DEFAULT '{}',
  main_distribution TEXT NOT NULL DEFAULT '',
  end_industries TEXT NOT NULL DEFAULT '',
  size_estimate TEXT NOT NULL DEFAULT '',
  fit_score INT NOT NULL DEFAULT 3,
  priority TEXT NOT NULL DEFAULT 'B',
  verify_status TEXT NOT NULL DEFAULT 'unverified',
  status TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  linkedin_url TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  email_status TEXT NOT NULL DEFAULT 'inferred',
  phone TEXT NOT NULL DEFAULT '',
  preferred_channel TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS drafts (
  id SERIAL PRIMARY KEY,
  company_id INT UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email1 JSONB,
  email2 JSONB,
  email3 JSONB,
  linkedin_note TEXT NOT NULL DEFAULT '',
  linkedin_followup TEXT NOT NULL DEFAULT '',
  generated_at TIMESTAMPTZ,
  edited_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  company_id INT UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT '2-待发送',
  channel TEXT NOT NULL DEFAULT '',
  first_touch_date DATE,
  followup1_date DATE,
  followup2_date DATE,
  last_touch_date DATE,
  replied BOOLEAN NOT NULL DEFAULT false,
  next_action TEXT NOT NULL DEFAULT '',
  next_action_date DATE,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_companies_project ON companies(project_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
```

- [ ] **Step 2: scripts/migrate.mjs**

```js
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
```

- [ ] **Step 3: src/lib/db.ts**

```ts
import { neon } from '@neondatabase/serverless'

export const sql = neon(process.env.DATABASE_URL!)
```

- [ ] **Step 4: 建 Neon 库并跑迁移**

在 Neon 控制台（或复用现有 Neon 账号）建项目 `cxodex-bd`，把连接串写入 `.env.local` 的 `DATABASE_URL`。然后：

```powershell
$env:DATABASE_URL=(Get-Content .env.local | Select-String '^DATABASE_URL=').ToString().Substring(13); npm run migrate
```

Expected: 输出 `migrate done`；Neon 控制台可见 7 张表。

- [ ] **Step 5: Commit**

```powershell
git add db scripts/migrate.mjs src/lib/db.ts .env.example
git commit -m "feat: database schema, migration script, neon client"
```

---

### Task 3: 鉴权基础库（TDD）

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/auth.test.ts`

**Interfaces:**
- Produces: `hashPassword(pw): Promise<string>` · `verifyPassword(pw, hash): Promise<boolean>` · `signToken({uid, email}): Promise<string>` · `verifyToken(token): Promise<{uid:number,email:string}|null>`。后续 session/route 均依赖这些签名。

- [ ] **Step 1: 写失败测试 `src/lib/auth.test.ts`**

```ts
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
```

- [ ] **Step 2: 运行确认失败**

```powershell
npx vitest run src/lib/auth.test.ts
```

Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/lib/auth.ts`**

```ts
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
```

- [ ] **Step 4: 运行确认通过**

```powershell
npx vitest run src/lib/auth.test.ts
```

Expected: 4 passed。

- [ ] **Step 5: Commit**

```powershell
git add src/lib/auth.ts src/lib/auth.test.ts
git commit -m "feat: password hashing and JWT helpers with tests"
```

---

### Task 4: 会话与租户隔离辅助

**Files:**
- Create: `src/lib/session.ts`, `src/lib/tenant.ts`

**Interfaces:**
- Consumes: Task 3 的 `verifyToken`；Task 2 的 `sql`。
- Produces: `getUser(): Promise<{uid,email}|null>`（读 cookie `bd_token`）· `requireUser(): Promise<{uid,email}>`（未登录 throw `UnauthorizedError`）· `assertProjectOwner(projectId, uid): Promise<void>`（不属于则 throw `NotFoundError`）· `assertCompanyOwner(companyId, uid): Promise<{projectId:number}>`。API route 用 try/catch 把这两类错误映射为 401/404。

- [ ] **Step 1: 实现 `src/lib/session.ts`**

```ts
import { cookies } from 'next/headers'
import { verifyToken } from './auth'

export class UnauthorizedError extends Error {}

export const COOKIE_NAME = 'bd_token'

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
```

- [ ] **Step 2: 实现 `src/lib/tenant.ts`**

```ts
import { sql } from './db'

export class NotFoundError extends Error {}

export async function assertProjectOwner(projectId: number, uid: number): Promise<void> {
  const rows = await sql`SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${uid}`
  if (rows.length === 0) throw new NotFoundError()
}

export async function assertCompanyOwner(companyId: number, uid: number): Promise<{ projectId: number }> {
  const rows = await sql`
    SELECT c.project_id FROM companies c
    JOIN projects p ON p.id = c.project_id
    WHERE c.id = ${companyId} AND p.user_id = ${uid}`
  if (rows.length === 0) throw new NotFoundError()
  return { projectId: rows[0].project_id as number }
}

export function errorResponse(e: unknown): Response {
  const { UnauthorizedError } = require('./session') as typeof import('./session')
  if (e instanceof UnauthorizedError) return Response.json({ error: '未登录' }, { status: 401 })
  if (e instanceof NotFoundError) return Response.json({ error: '不存在' }, { status: 404 })
  console.error(e)
  return Response.json({ error: '服务器错误' }, { status: 500 })
}
```

注意：为避免 require 混用，把 `errorResponse` 改为直接 `import { UnauthorizedError } from './session'` 顶部导入（实现时用顶部 import，上面仅示意归属）。最终代码：

```ts
import { sql } from './db'
import { UnauthorizedError } from './session'

export class NotFoundError extends Error {}

export async function assertProjectOwner(projectId: number, uid: number): Promise<void> {
  const rows = await sql`SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${uid}`
  if (rows.length === 0) throw new NotFoundError()
}

export async function assertCompanyOwner(companyId: number, uid: number): Promise<{ projectId: number }> {
  const rows = await sql`
    SELECT c.project_id FROM companies c
    JOIN projects p ON p.id = c.project_id
    WHERE c.id = ${companyId} AND p.user_id = ${uid}`
  if (rows.length === 0) throw new NotFoundError()
  return { projectId: rows[0].project_id as number }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof UnauthorizedError) return Response.json({ error: '未登录' }, { status: 401 })
  if (e instanceof NotFoundError) return Response.json({ error: '不存在' }, { status: 404 })
  console.error(e)
  return Response.json({ error: '服务器错误' }, { status: 500 })
}
```

- [ ] **Step 3: 类型检查**

```powershell
npx tsc --noEmit
```

Expected: 无错误。

- [ ] **Step 4: Commit**

```powershell
git add src/lib/session.ts src/lib/tenant.ts
git commit -m "feat: session helpers and tenant isolation guards"
```

---

### Task 5: 鉴权 API（注册/登录/登出/me）

**Files:**
- Create: `src/app/api/auth/register/route.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/api/auth/me/route.ts`

**Interfaces:**
- Consumes: Task 2 `sql`，Task 3 auth，Task 4 `COOKIE_NAME`/`getUser`。
- Produces: `POST /api/auth/register {email,password,inviteCode}` → 201 设 cookie；`POST /api/auth/login {email,password}` → 200 设 cookie；`POST /api/auth/logout` → 清 cookie；`GET /api/auth/me` → `{uid,email}` 或 401。

- [ ] **Step 1: register/route.ts**

```ts
import { z } from 'zod'
import { sql } from '@/lib/db'
import { hashPassword, signToken } from '@/lib/auth'
import { COOKIE_NAME } from '@/lib/session'

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  inviteCode: z.string().min(1),
})

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: '参数不合法（密码至少 8 位）' }, { status: 400 })
  const { email, password, inviteCode } = parsed.data

  const codes = await sql`
    SELECT code FROM invite_codes
    WHERE code = ${inviteCode} AND used_count < max_uses
      AND (expires_at IS NULL OR expires_at > now())`
  if (codes.length === 0) return Response.json({ error: '邀请码无效或已用完' }, { status: 403 })

  const dup = await sql`SELECT id FROM users WHERE email = ${email}`
  if (dup.length > 0) return Response.json({ error: '邮箱已注册' }, { status: 409 })

  const hash = await hashPassword(password)
  const rows = await sql`
    INSERT INTO users (email, password_hash, invite_code_used)
    VALUES (${email}, ${hash}, ${inviteCode}) RETURNING id`
  await sql`UPDATE invite_codes SET used_count = used_count + 1 WHERE code = ${inviteCode}`

  const token = await signToken({ uid: rows[0].id as number, email })
  return new Response(JSON.stringify({ uid: rows[0].id, email }), {
    status: 201,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`,
    },
  })
}
```

- [ ] **Step 2: login/route.ts**

```ts
import { z } from 'zod'
import { sql } from '@/lib/db'
import { verifyPassword, signToken } from '@/lib/auth'
import { COOKIE_NAME } from '@/lib/session'

const Body = z.object({ email: z.string().email(), password: z.string() })

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: '参数不合法' }, { status: 400 })
  const { email, password } = parsed.data
  const rows = await sql`SELECT id, password_hash FROM users WHERE email = ${email}`
  if (rows.length === 0 || !(await verifyPassword(password, rows[0].password_hash as string)))
    return Response.json({ error: '邮箱或密码错误' }, { status: 401 })
  const token = await signToken({ uid: rows[0].id as number, email })
  return new Response(JSON.stringify({ uid: rows[0].id, email }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`,
    },
  })
}
```

- [ ] **Step 3: logout/route.ts 与 me/route.ts**

```ts
// logout/route.ts
import { COOKIE_NAME } from '@/lib/session'

export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`,
    },
  })
}
```

```ts
// me/route.ts
import { getUser } from '@/lib/session'

export async function GET() {
  const u = await getUser()
  if (!u) return Response.json({ error: '未登录' }, { status: 401 })
  return Response.json(u)
}
```

- [ ] **Step 4: 手动验证（dev server + curl 链）**

先造一个邀请码（临时 SQL，正式脚本在 Task 11）：在 Neon SQL editor 执行 `INSERT INTO invite_codes (code, max_uses) VALUES ('DEV-TEST', 100) ON CONFLICT DO NOTHING;`。然后：

```powershell
npm run dev
# 另开终端：
curl.exe -s -X POST http://localhost:3005/api/auth/register -H "Content-Type: application/json" -d '{\"email\":\"t1@test.com\",\"password\":\"password1\",\"inviteCode\":\"DEV-TEST\"}'
curl.exe -s -c cookies.txt -X POST http://localhost:3005/api/auth/login -H "Content-Type: application/json" -d '{\"email\":\"t1@test.com\",\"password\":\"password1\"}'
curl.exe -s -b cookies.txt http://localhost:3005/api/auth/me
```

Expected: 依次 201 / 200 / `{"uid":...,"email":"t1@test.com"}`。删除 cookies.txt。

- [ ] **Step 5: Commit**

```powershell
git add src/app/api/auth
git commit -m "feat: auth API (register with invite code, login, logout, me)"
```

---

### Task 6: 项目 API（CRUD）

**Files:**
- Create: `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts`

**Interfaces:**
- Consumes: `requireUser`、`assertProjectOwner`、`errorResponse`、`sql`。
- Produces: `GET /api/projects` → 项目数组；`POST /api/projects {name,productDesc,competitorBrands[],valueProps{priceAdvantage,proofPoints,riskFreeTerms},targetMarkets[],targetIndustries[]}` → 201 `{id}`；`GET/PATCH/DELETE /api/projects/:id`。

- [ ] **Step 1: projects/route.ts**

```ts
import { z } from 'zod'
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { errorResponse } from '@/lib/tenant'

const Body = z.object({
  name: z.string().min(1),
  productDesc: z.string().min(1),
  competitorBrands: z.array(z.string()).default([]),
  valueProps: z.object({
    priceAdvantage: z.string().default(''),
    proofPoints: z.string().default(''),
    riskFreeTerms: z.string().default(''),
  }).default({ priceAdvantage: '', proofPoints: '', riskFreeTerms: '' }),
  targetMarkets: z.array(z.string()).default([]),
  targetIndustries: z.array(z.string()).default([]),
})

export async function GET() {
  try {
    const u = await requireUser()
    const rows = await sql`
      SELECT id, name, product_desc, competitor_brands, value_props, target_markets, target_industries, created_at
      FROM projects WHERE user_id = ${u.uid} ORDER BY id DESC`
    return Response.json(rows)
  } catch (e) { return errorResponse(e) }
}

export async function POST(req: Request) {
  try {
    const u = await requireUser()
    const parsed = Body.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return Response.json({ error: '参数不合法' }, { status: 400 })
    const b = parsed.data
    const rows = await sql`
      INSERT INTO projects (user_id, name, product_desc, competitor_brands, value_props, target_markets, target_industries)
      VALUES (${u.uid}, ${b.name}, ${b.productDesc}, ${b.competitorBrands}, ${JSON.stringify(b.valueProps)}, ${b.targetMarkets}, ${b.targetIndustries})
      RETURNING id`
    return Response.json({ id: rows[0].id }, { status: 201 })
  } catch (e) { return errorResponse(e) }
}
```

- [ ] **Step 2: projects/[id]/route.ts**

```ts
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertProjectOwner, errorResponse } from '@/lib/tenant'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const id = Number((await ctx.params).id)
    await assertProjectOwner(id, u.uid)
    const rows = await sql`SELECT * FROM projects WHERE id = ${id}`
    return Response.json(rows[0])
  } catch (e) { return errorResponse(e) }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const id = Number((await ctx.params).id)
    await assertProjectOwner(id, u.uid)
    const b = await req.json()
    await sql`
      UPDATE projects SET
        name = COALESCE(${b.name ?? null}, name),
        product_desc = COALESCE(${b.productDesc ?? null}, product_desc),
        competitor_brands = COALESCE(${b.competitorBrands ?? null}, competitor_brands),
        value_props = COALESCE(${b.valueProps ? JSON.stringify(b.valueProps) : null}, value_props),
        target_markets = COALESCE(${b.targetMarkets ?? null}, target_markets),
        target_industries = COALESCE(${b.targetIndustries ?? null}, target_industries)
      WHERE id = ${id}`
    return Response.json({ ok: true })
  } catch (e) { return errorResponse(e) }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const id = Number((await ctx.params).id)
    await assertProjectOwner(id, u.uid)
    await sql`DELETE FROM projects WHERE id = ${id}`
    return Response.json({ ok: true })
  } catch (e) { return errorResponse(e) }
}
```

- [ ] **Step 3: 手动验证**

复用 Task 5 的 cookie：POST 一个项目 → GET 列表见到它 → 用另一账号 GET 该 id 得 404。

- [ ] **Step 4: Commit**

```powershell
git add src/app/api/projects
git commit -m "feat: project CRUD API with tenant isolation"
```

---

### Task 7: GLM 客户端 + AI 输出解析（TDD）

**Files:**
- Create: `src/lib/glm.ts`, `src/lib/ai.ts`, `src/lib/ai.test.ts`

**Interfaces:**
- Consumes: 环境变量 `GLM_API_KEY`/`GLM_MODEL`。
- Produces:
  - `glmChat(messages: {role:'system'|'user',content:string}[], opts?: {timeoutMs?:number}): Promise<string>`
  - `extractJson(text: string): unknown`（剥 ```json 围栏 / 截取首尾括号后 JSON.parse，失败 throw）
  - `CompanyRow` zod schema 与 `parseCompanies(raw: unknown): {rows: CompanyRow[], dropped: number}`（坏行丢弃计数）
  - `buildCompanyPrompt(project, market): messages` · `buildPersonaPrompt(project, company)` · `buildSequencePrompt(project, company, contact?)` · `buildFollowupPrompt(project, company, activity)`
  - `SequenceSchema`：`{email1:{subject,body}, email2:{...}, email3:{...}, linkedin_note, linkedin_followup}` 及 `parseSequence(raw)`。

- [ ] **Step 1: 写失败测试 `src/lib/ai.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { extractJson } from './glm'
import { parseCompanies, parseSequence } from './ai'

describe('extractJson', () => {
  it('parses fenced json', () => {
    expect(extractJson('前言```json\n[{"a":1}]\n```后记')).toEqual([{ a: 1 }])
  })
  it('parses bare json with noise', () => {
    expect(extractJson('答案如下 [{"a":1}] 完')).toEqual([{ a: 1 }])
  })
  it('throws on garbage', () => {
    expect(() => extractJson('没有 JSON')).toThrow()
  })
})

describe('parseCompanies', () => {
  it('keeps valid rows, drops bad rows', () => {
    const raw = [
      { name: 'Acme Tools GmbH', country: 'Germany', city: 'Köln', website: 'https://acme.de',
        competitor_brands_carried: ['BrandX'], main_distribution: 'cutting tools',
        end_industries: 'automotive', size_estimate: '50-100', fit_score: 4, priority: 'A', reason: 'carries BrandX' },
      { name: '', country: 'US' },            // 缺 name → 丢
      { name: 'NoScore Inc', country: 'US', fit_score: 99 }, // fit_score 越界 → 丢
    ]
    const { rows, dropped } = parseCompanies(raw)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Acme Tools GmbH')
    expect(dropped).toBe(2)
  })
  it('returns empty on non-array', () => {
    expect(parseCompanies({ nope: 1 })).toEqual({ rows: [], dropped: 0 })
  })
})

describe('parseSequence', () => {
  it('accepts full sequence', () => {
    const seq = {
      email1: { subject: 'S1', body: 'B1' },
      email2: { subject: 'S2', body: 'B2' },
      email3: { subject: 'S3', body: 'B3' },
      linkedin_note: 'hi', linkedin_followup: 'again',
    }
    expect(parseSequence(seq)).toEqual(seq)
  })
  it('throws when an email missing', () => {
    expect(() => parseSequence({ email1: { subject: 's', body: 'b' } })).toThrow()
  })
})
```

- [ ] **Step 2: 运行确认失败**

```powershell
npx vitest run src/lib/ai.test.ts
```

Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/lib/glm.ts`**

```ts
type Msg = { role: 'system' | 'user'; content: string }

export async function glmChat(messages: Msg[], opts: { timeoutMs?: number } = {}): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 60000)
  try {
    const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.GLM_MODEL || 'glm-4.6',
        messages,
        temperature: 0.6,
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`GLM API ${res.status}: ${await res.text()}`)
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string') throw new Error('GLM 返回格式异常')
    return content
  } finally {
    clearTimeout(timer)
  }
}

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  try { return JSON.parse(raw) } catch { /* fall through */ }
  const starts = [raw.indexOf('['), raw.indexOf('{')].filter(i => i >= 0)
  if (starts.length === 0) throw new Error('响应中未找到 JSON')
  const start = Math.min(...starts)
  const endChar = raw[start] === '[' ? ']' : '}'
  const end = raw.lastIndexOf(endChar)
  if (end <= start) throw new Error('响应中 JSON 不完整')
  return JSON.parse(raw.slice(start, end + 1))
}
```

- [ ] **Step 4: 实现 `src/lib/ai.ts`**

```ts
import { z } from 'zod'

export const CompanyRowSchema = z.object({
  name: z.string().min(1),
  country: z.string().default(''),
  city: z.string().default(''),
  website: z.string().default(''),
  competitor_brands_carried: z.array(z.string()).default([]),
  main_distribution: z.string().default(''),
  end_industries: z.string().default(''),
  size_estimate: z.string().default(''),
  fit_score: z.number().int().min(1).max(5).default(3),
  priority: z.enum(['A', 'B', 'C']).default('B'),
  reason: z.string().default(''),
})
export type CompanyRow = z.infer<typeof CompanyRowSchema>

export function parseCompanies(raw: unknown): { rows: CompanyRow[]; dropped: number } {
  if (!Array.isArray(raw)) return { rows: [], dropped: 0 }
  const rows: CompanyRow[] = []
  let dropped = 0
  for (const item of raw) {
    const r = CompanyRowSchema.safeParse(item)
    if (r.success) rows.push(r.data)
    else dropped++
  }
  return { rows, dropped }
}

const EmailSchema = z.object({ subject: z.string().min(1), body: z.string().min(1) })
export const SequenceSchema = z.object({
  email1: EmailSchema,
  email2: EmailSchema,
  email3: EmailSchema,
  linkedin_note: z.string().default(''),
  linkedin_followup: z.string().default(''),
})
export type Sequence = z.infer<typeof SequenceSchema>

export function parseSequence(raw: unknown): Sequence {
  return SequenceSchema.parse(raw)
}

type Project = {
  product_desc: string
  competitor_brands: string[]
  value_props: { priceAdvantage?: string; proofPoints?: string; riskFreeTerms?: string }
  target_industries: string[]
}
type Company = {
  name: string; country: string; website: string
  competitor_brands_carried: string[]; main_distribution: string; end_industries: string
}
type Msg = { role: 'system' | 'user'; content: string }

function projectContext(p: Project): string {
  return [
    `我方产品线：${p.product_desc}`,
    `竞品品牌：${p.competitor_brands.join(', ') || '（未填）'}`,
    `价格优势：${p.value_props.priceAdvantage || '（未填）'}`,
    `量化实证：${p.value_props.proofPoints || '（未填）'}`,
    `零风险条款：${p.value_props.riskFreeTerms || '（未填）'}`,
    `目标终端行业：${p.target_industries.join(', ') || '（未填）'}`,
  ].join('\n')
}

export function buildCompanyPrompt(p: Project, market: string): Msg[] {
  return [
    { role: 'system', content: '你是 B2B 国际渠道开发研究员。只输出 JSON 数组，不要输出任何其他文字。' },
    { role: 'user', content: `${projectContext(p)}

请基于你的行业知识，列出 ${market} 最多 15 家最可能分销此类产品、且很可能在售上述竞品品牌的经销商/分销商/贸易商（不要终端制造工厂）。
每家输出对象字段：name, country, city, website, competitor_brands_carried(字符串数组), main_distribution, end_industries, size_estimate, fit_score(1-5 整数), priority("A"/"B"/"C"), reason(一句话推荐理由)。
注意：这些信息可能过时或不准确，宁缺毋滥，不确定的字段留空字符串。只输出 JSON 数组。` },
  ]
}

export function buildPersonaPrompt(p: Project, c: Company): Msg[] {
  return [
    { role: 'system', content: '你是 B2B 销售研究顾问，用中文回答，简洁分点。' },
    { role: 'user', content: `${projectContext(p)}

目标公司：${c.name}（${c.country}），主营：${c.main_distribution || '未知'}，服务行业：${c.end_industries || '未知'}。
请给出：1) 该找的决策人职位画像（按优先级：采购总监/经理 > 品类/产品经理 > Sourcing Manager；小经销商找 Owner/BD），结合该公司规模给出具体建议；2) 3 条可直接粘贴到 LinkedIn 搜索框的英文搜索词；3) 邮箱验证注意事项（推测/catch-all 地址退信风险提示）。` },
  ]
}

export function buildSequencePrompt(p: Project, c: Company, contactName?: string): Msg[] {
  return [
    { role: 'system', content: 'You are a senior B2B cold-outreach copywriter. Output JSON only, no other text.' },
    { role: 'user', content: `Context (our side):
${projectContext(p)}

Target distributor: ${c.name} (${c.country}), carries competitor brands: ${c.competitor_brands_carried.join(', ') || 'unknown'}.
Contact name: ${contactName || '(unknown, use a neutral greeting)'}

Write a professional, concise, benefit-driven English cold-email sequence (3 emails) plus LinkedIn scripts:
- email1 (Day 0): open by naming the competitor brand(s) they carry ("I noticed you supply ..."), offer our equivalent products with the price advantage and quantified proof points above, and propose a FREE head-to-head cost-per-part test on their customer's own workpiece.
- email2 (+3 days): private-label / OEM angle — we can ship under their own brand.
- email3 (+7 days): zero-risk close using our risk-free terms (e.g. validation period, no-performance-no-deal, consignment stock).
- linkedin_note: connection request message, MAX 300 characters, same competitor hook.
- linkedin_followup: message after they accept.
Every email body must end with an unsubscribe line and a sender address placeholder "[Sender name, Company, Address]".
Output JSON: {"email1":{"subject":"...","body":"..."},"email2":{...},"email3":{...},"linkedin_note":"...","linkedin_followup":"..."}` },
  ]
}

export function buildFollowupPrompt(p: Project, c: Company, activity: { stage: string; last_touch_date: string | null }): Msg[] {
  return [
    { role: 'system', content: 'You are a senior B2B cold-outreach copywriter. Output JSON only: {"subject":"...","body":"..."}' },
    { role: 'user', content: `${projectContext(p)}

Target: ${c.name} (${c.country}), current stage: ${activity.stage}, last touch: ${activity.last_touch_date || 'unknown'}.
They have not replied for 3+ days. Write ONE short English follow-up email (under 120 words) that adds a new angle (a proof point or the risk-free offer) instead of "just checking in". End with an unsubscribe line and "[Sender name, Company, Address]".` },
  ]
}
```

- [ ] **Step 5: 运行确认通过**

```powershell
npx vitest run src/lib/ai.test.ts
```

Expected: 7 passed。

- [ ] **Step 6: Commit**

```powershell
git add src/lib/glm.ts src/lib/ai.ts src/lib/ai.test.ts
git commit -m "feat: GLM client, prompt builders, strict AI output parsing with tests"
```

---

### Task 8: 公司库 API（CRUD + AI 生成）

**Files:**
- Create: `src/app/api/projects/[id]/companies/route.ts`, `src/app/api/projects/[id]/companies/generate/route.ts`, `src/app/api/companies/[id]/route.ts`

**Interfaces:**
- Consumes: Task 4 守卫、Task 7 `glmChat`/`extractJson`/`parseCompanies`/`buildCompanyPrompt`。
- Produces: `GET /api/projects/:id/companies` → 数组（含 activity.stage 联查）；`POST` 手动新增（source='manual'）；`POST /api/projects/:id/companies/generate {market}` → `{inserted, dropped}`；`PATCH/DELETE /api/companies/:id`。每次新增公司同时 `INSERT INTO activities (company_id) VALUES (...) ON CONFLICT DO NOTHING`。

- [ ] **Step 1: companies/route.ts（列表 + 手动新增）**

```ts
import { z } from 'zod'
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertProjectOwner, errorResponse } from '@/lib/tenant'

const Body = z.object({
  name: z.string().min(1),
  country: z.string().default(''),
  city: z.string().default(''),
  website: z.string().default(''),
  competitorBrandsCarried: z.array(z.string()).default([]),
  mainDistribution: z.string().default(''),
  endIndustries: z.string().default(''),
  sizeEstimate: z.string().default(''),
  fitScore: z.number().int().min(1).max(5).default(3),
  priority: z.enum(['A', 'B', 'C']).default('B'),
  notes: z.string().default(''),
})

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const pid = Number((await ctx.params).id)
    await assertProjectOwner(pid, u.uid)
    const rows = await sql`
      SELECT c.*, a.stage FROM companies c
      LEFT JOIN activities a ON a.company_id = c.id
      WHERE c.project_id = ${pid}
      ORDER BY c.priority ASC, c.fit_score DESC, c.id DESC`
    return Response.json(rows)
  } catch (e) { return errorResponse(e) }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const pid = Number((await ctx.params).id)
    await assertProjectOwner(pid, u.uid)
    const parsed = Body.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return Response.json({ error: '参数不合法' }, { status: 400 })
    const b = parsed.data
    const rows = await sql`
      INSERT INTO companies (project_id, name, country, city, website, source,
        competitor_brands_carried, main_distribution, end_industries, size_estimate,
        fit_score, priority, verify_status, notes)
      VALUES (${pid}, ${b.name}, ${b.country}, ${b.city}, ${b.website}, 'manual',
        ${b.competitorBrandsCarried}, ${b.mainDistribution}, ${b.endIndustries}, ${b.sizeEstimate},
        ${b.fitScore}, ${b.priority}, 'unverified', ${b.notes})
      RETURNING id`
    await sql`INSERT INTO activities (company_id) VALUES (${rows[0].id}) ON CONFLICT DO NOTHING`
    return Response.json({ id: rows[0].id }, { status: 201 })
  } catch (e) { return errorResponse(e) }
}
```

- [ ] **Step 2: companies/generate/route.ts**

```ts
import { z } from 'zod'
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertProjectOwner, errorResponse } from '@/lib/tenant'
import { glmChat, extractJson } from '@/lib/glm'
import { parseCompanies, buildCompanyPrompt } from '@/lib/ai'

const Body = z.object({ market: z.string().min(1) })

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const pid = Number((await ctx.params).id)
    await assertProjectOwner(pid, u.uid)
    const parsed = Body.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return Response.json({ error: '请选择目标市场' }, { status: 400 })

    const projects = await sql`SELECT * FROM projects WHERE id = ${pid}`
    const text = await glmChat(buildCompanyPrompt(projects[0] as never, parsed.data.market))
    const { rows, dropped } = parseCompanies(extractJson(text))

    let inserted = 0
    for (const r of rows) {
      const res = await sql`
        INSERT INTO companies (project_id, name, country, city, website, source,
          competitor_brands_carried, main_distribution, end_industries, size_estimate,
          fit_score, priority, verify_status, notes)
        VALUES (${pid}, ${r.name}, ${r.country || parsed.data.market}, ${r.city}, ${r.website}, 'ai',
          ${r.competitor_brands_carried}, ${r.main_distribution}, ${r.end_industries}, ${r.size_estimate},
          ${r.fit_score}, ${r.priority}, 'unverified', ${r.reason})
        RETURNING id`
      await sql`INSERT INTO activities (company_id) VALUES (${res[0].id}) ON CONFLICT DO NOTHING`
      inserted++
    }
    return Response.json({ inserted, dropped })
  } catch (e) { return errorResponse(e) }
}
```

- [ ] **Step 3: companies/[id]/route.ts（PATCH 行内编辑 + DELETE）**

```ts
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertCompanyOwner, errorResponse } from '@/lib/tenant'

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const id = Number((await ctx.params).id)
    await assertCompanyOwner(id, u.uid)
    const b = await req.json()
    await sql`
      UPDATE companies SET
        name = COALESCE(${b.name ?? null}, name),
        country = COALESCE(${b.country ?? null}, country),
        city = COALESCE(${b.city ?? null}, city),
        website = COALESCE(${b.website ?? null}, website),
        competitor_brands_carried = COALESCE(${b.competitorBrandsCarried ?? null}, competitor_brands_carried),
        main_distribution = COALESCE(${b.mainDistribution ?? null}, main_distribution),
        end_industries = COALESCE(${b.endIndustries ?? null}, end_industries),
        size_estimate = COALESCE(${b.sizeEstimate ?? null}, size_estimate),
        fit_score = COALESCE(${b.fitScore ?? null}, fit_score),
        priority = COALESCE(${b.priority ?? null}, priority),
        verify_status = COALESCE(${b.verifyStatus ?? null}, verify_status),
        status = COALESCE(${b.status ?? null}, status),
        notes = COALESCE(${b.notes ?? null}, notes)
      WHERE id = ${id}`
    return Response.json({ ok: true })
  } catch (e) { return errorResponse(e) }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const id = Number((await ctx.params).id)
    await assertCompanyOwner(id, u.uid)
    await sql`DELETE FROM companies WHERE id = ${id}`
    return Response.json({ ok: true })
  } catch (e) { return errorResponse(e) }
}
```

- [ ] **Step 4: 手动验证**

dev server + 登录 cookie：POST 手动新增一家公司 → GET 列表可见且 stage 为 `2-待发送`；配好 `GLM_API_KEY` 后 POST generate `{"market":"Germany"}` → 返回 `{inserted:>0}` 且列表出现 source='ai'、verify_status='unverified' 的行。

- [ ] **Step 5: Commit**

```powershell
git add src/app/api/projects src/app/api/companies
git commit -m "feat: company library API with AI candidate generation"
```

---

### Task 9: 决策人 / 冷邮件 / 追踪 API

**Files:**
- Create: `src/app/api/companies/[id]/contacts/route.ts`, `src/app/api/contacts/[id]/route.ts`, `src/app/api/companies/[id]/persona/route.ts`, `src/app/api/companies/[id]/drafts/route.ts`, `src/app/api/companies/[id]/drafts/generate/route.ts`, `src/app/api/companies/[id]/activity/route.ts`, `src/app/api/companies/[id]/followup/route.ts`

**Interfaces:**
- Consumes: Task 4 守卫，Task 7 的 `buildPersonaPrompt`/`buildSequencePrompt`/`buildFollowupPrompt`/`parseSequence`。
- Produces:
  - `GET/POST /api/companies/:id/contacts`；`PATCH/DELETE /api/contacts/:id`
  - `POST /api/companies/:id/persona` → `{text}`（中文画像，不入库，前端展示）
  - `GET /api/companies/:id/drafts` → drafts 行或 null；`PUT` 保存编辑（写 `edited_at=now()`）
  - `POST /api/companies/:id/drafts/generate` → 生成并 upsert，返回完整 drafts
  - `GET /api/companies/:id/activity`；`PUT` 更新阶段/日期/回复/下一步（写 `updated_at=now()`，任何日期字段更新时同步 `last_touch_date`由前端传入）
  - `POST /api/companies/:id/followup` → `{subject, body}`（不入库）

- [ ] **Step 1: contacts 两个 route**

```ts
// src/app/api/companies/[id]/contacts/route.ts
import { z } from 'zod'
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertCompanyOwner, errorResponse } from '@/lib/tenant'

const Body = z.object({
  name: z.string().default(''),
  title: z.string().default(''),
  linkedinUrl: z.string().default(''),
  email: z.string().default(''),
  emailStatus: z.enum(['verified', 'inferred', 'catchall', 'invalid']).default('inferred'),
  phone: z.string().default(''),
  preferredChannel: z.string().default(''),
  notes: z.string().default(''),
})

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    await assertCompanyOwner(cid, u.uid)
    return Response.json(await sql`SELECT * FROM contacts WHERE company_id = ${cid} ORDER BY id`)
  } catch (e) { return errorResponse(e) }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    await assertCompanyOwner(cid, u.uid)
    const parsed = Body.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return Response.json({ error: '参数不合法' }, { status: 400 })
    const b = parsed.data
    const rows = await sql`
      INSERT INTO contacts (company_id, name, title, linkedin_url, email, email_status, phone, preferred_channel, notes)
      VALUES (${cid}, ${b.name}, ${b.title}, ${b.linkedinUrl}, ${b.email}, ${b.emailStatus}, ${b.phone}, ${b.preferredChannel}, ${b.notes})
      RETURNING id`
    return Response.json({ id: rows[0].id }, { status: 201 })
  } catch (e) { return errorResponse(e) }
}
```

```ts
// src/app/api/contacts/[id]/route.ts
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { NotFoundError, errorResponse } from '@/lib/tenant'

async function assertContactOwner(contactId: number, uid: number): Promise<void> {
  const rows = await sql`
    SELECT ct.id FROM contacts ct
    JOIN companies c ON c.id = ct.company_id
    JOIN projects p ON p.id = c.project_id
    WHERE ct.id = ${contactId} AND p.user_id = ${uid}`
  if (rows.length === 0) throw new NotFoundError()
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const id = Number((await ctx.params).id)
    await assertContactOwner(id, u.uid)
    const b = await req.json()
    await sql`
      UPDATE contacts SET
        name = COALESCE(${b.name ?? null}, name),
        title = COALESCE(${b.title ?? null}, title),
        linkedin_url = COALESCE(${b.linkedinUrl ?? null}, linkedin_url),
        email = COALESCE(${b.email ?? null}, email),
        email_status = COALESCE(${b.emailStatus ?? null}, email_status),
        phone = COALESCE(${b.phone ?? null}, phone),
        preferred_channel = COALESCE(${b.preferredChannel ?? null}, preferred_channel),
        notes = COALESCE(${b.notes ?? null}, notes)
      WHERE id = ${id}`
    return Response.json({ ok: true })
  } catch (e) { return errorResponse(e) }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const id = Number((await ctx.params).id)
    await assertContactOwner(id, u.uid)
    await sql`DELETE FROM contacts WHERE id = ${id}`
    return Response.json({ ok: true })
  } catch (e) { return errorResponse(e) }
}
```

- [ ] **Step 2: persona/route.ts**

```ts
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertCompanyOwner, errorResponse } from '@/lib/tenant'
import { glmChat } from '@/lib/glm'
import { buildPersonaPrompt } from '@/lib/ai'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    const { projectId } = await assertCompanyOwner(cid, u.uid)
    const [project] = await sql`SELECT * FROM projects WHERE id = ${projectId}`
    const [company] = await sql`SELECT * FROM companies WHERE id = ${cid}`
    const text = await glmChat(buildPersonaPrompt(project as never, company as never))
    return Response.json({ text })
  } catch (e) { return errorResponse(e) }
}
```

- [ ] **Step 3: drafts 两个 route**

```ts
// src/app/api/companies/[id]/drafts/route.ts
import { z } from 'zod'
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertCompanyOwner, errorResponse } from '@/lib/tenant'
import { SequenceSchema } from '@/lib/ai'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    await assertCompanyOwner(cid, u.uid)
    const rows = await sql`SELECT * FROM drafts WHERE company_id = ${cid}`
    return Response.json(rows[0] ?? null)
  } catch (e) { return errorResponse(e) }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    await assertCompanyOwner(cid, u.uid)
    const parsed = SequenceSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return Response.json({ error: '草稿格式不合法' }, { status: 400 })
    const s = parsed.data
    await sql`
      INSERT INTO drafts (company_id, email1, email2, email3, linkedin_note, linkedin_followup, edited_at)
      VALUES (${cid}, ${JSON.stringify(s.email1)}, ${JSON.stringify(s.email2)}, ${JSON.stringify(s.email3)}, ${s.linkedin_note}, ${s.linkedin_followup}, now())
      ON CONFLICT (company_id) DO UPDATE SET
        email1 = EXCLUDED.email1, email2 = EXCLUDED.email2, email3 = EXCLUDED.email3,
        linkedin_note = EXCLUDED.linkedin_note, linkedin_followup = EXCLUDED.linkedin_followup,
        edited_at = now()`
    return Response.json({ ok: true })
  } catch (e) { return errorResponse(e) }
}
```

```ts
// src/app/api/companies/[id]/drafts/generate/route.ts
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertCompanyOwner, errorResponse } from '@/lib/tenant'
import { glmChat, extractJson } from '@/lib/glm'
import { buildSequencePrompt, parseSequence } from '@/lib/ai'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    const { projectId } = await assertCompanyOwner(cid, u.uid)
    const [project] = await sql`SELECT * FROM projects WHERE id = ${projectId}`
    const [company] = await sql`SELECT * FROM companies WHERE id = ${cid}`
    const [contact] = await sql`SELECT name FROM contacts WHERE company_id = ${cid} ORDER BY id LIMIT 1`
    const text = await glmChat(buildSequencePrompt(project as never, company as never, contact?.name as string | undefined))
    const s = parseSequence(extractJson(text))
    await sql`
      INSERT INTO drafts (company_id, email1, email2, email3, linkedin_note, linkedin_followup, generated_at)
      VALUES (${cid}, ${JSON.stringify(s.email1)}, ${JSON.stringify(s.email2)}, ${JSON.stringify(s.email3)}, ${s.linkedin_note}, ${s.linkedin_followup}, now())
      ON CONFLICT (company_id) DO UPDATE SET
        email1 = EXCLUDED.email1, email2 = EXCLUDED.email2, email3 = EXCLUDED.email3,
        linkedin_note = EXCLUDED.linkedin_note, linkedin_followup = EXCLUDED.linkedin_followup,
        generated_at = now()`
    // 阶段推进到 3-草稿就绪（仅当当前还是 2-待发送）
    await sql`UPDATE activities SET stage = '3-草稿就绪', updated_at = now()
              WHERE company_id = ${cid} AND stage = '2-待发送'`
    const rows = await sql`SELECT * FROM drafts WHERE company_id = ${cid}`
    return Response.json(rows[0])
  } catch (e) { return errorResponse(e) }
}
```

- [ ] **Step 4: activity/route.ts 与 followup/route.ts**

```ts
// src/app/api/companies/[id]/activity/route.ts
import { z } from 'zod'
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertCompanyOwner, errorResponse } from '@/lib/tenant'

const STAGES = ['2-待发送', '3-草稿就绪', '4-首触已发', '5-跟进中', '6-已回复', '7-约电话/寄样'] as const
const Body = z.object({
  stage: z.enum(STAGES).optional(),
  channel: z.string().optional(),
  firstTouchDate: z.string().nullable().optional(),
  followup1Date: z.string().nullable().optional(),
  followup2Date: z.string().nullable().optional(),
  lastTouchDate: z.string().nullable().optional(),
  replied: z.boolean().optional(),
  nextAction: z.string().optional(),
  nextActionDate: z.string().nullable().optional(),
  notes: z.string().optional(),
})

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    await assertCompanyOwner(cid, u.uid)
    const rows = await sql`SELECT * FROM activities WHERE company_id = ${cid}`
    return Response.json(rows[0] ?? null)
  } catch (e) { return errorResponse(e) }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    await assertCompanyOwner(cid, u.uid)
    const parsed = Body.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return Response.json({ error: '参数不合法' }, { status: 400 })
    const b = parsed.data
    await sql`
      INSERT INTO activities (company_id) VALUES (${cid}) ON CONFLICT DO NOTHING`
    await sql`
      UPDATE activities SET
        stage = COALESCE(${b.stage ?? null}, stage),
        channel = COALESCE(${b.channel ?? null}, channel),
        first_touch_date = COALESCE(${b.firstTouchDate ?? null}, first_touch_date),
        followup1_date = COALESCE(${b.followup1Date ?? null}, followup1_date),
        followup2_date = COALESCE(${b.followup2Date ?? null}, followup2_date),
        last_touch_date = COALESCE(${b.lastTouchDate ?? null}, last_touch_date),
        replied = COALESCE(${b.replied ?? null}, replied),
        next_action = COALESCE(${b.nextAction ?? null}, next_action),
        next_action_date = COALESCE(${b.nextActionDate ?? null}, next_action_date),
        notes = COALESCE(${b.notes ?? null}, notes),
        updated_at = now()
      WHERE company_id = ${cid}`
    return Response.json({ ok: true })
  } catch (e) { return errorResponse(e) }
}
```

```ts
// src/app/api/companies/[id]/followup/route.ts
import { z } from 'zod'
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertCompanyOwner, errorResponse } from '@/lib/tenant'
import { glmChat, extractJson } from '@/lib/glm'
import { buildFollowupPrompt } from '@/lib/ai'

const Out = z.object({ subject: z.string().min(1), body: z.string().min(1) })

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    const { projectId } = await assertCompanyOwner(cid, u.uid)
    const [project] = await sql`SELECT * FROM projects WHERE id = ${projectId}`
    const [company] = await sql`SELECT * FROM companies WHERE id = ${cid}`
    const [activity] = await sql`SELECT stage, last_touch_date FROM activities WHERE company_id = ${cid}`
    const text = await glmChat(buildFollowupPrompt(project as never, company as never, activity as never))
    return Response.json(Out.parse(extractJson(text)))
  } catch (e) { return errorResponse(e) }
}
```

- [ ] **Step 5: 手动验证**

对 Task 8 建的公司：POST contact → GET 可见；POST drafts/generate（需 GLM key）→ 返回三封邮件且 activity 阶段变 `3-草稿就绪`；PUT activity `{"stage":"4-首触已发","firstTouchDate":"2026-07-02","lastTouchDate":"2026-07-02"}` → GET 确认。

- [ ] **Step 6: Commit**

```powershell
git add src/app/api/companies src/app/api/contacts
git commit -m "feat: contacts, drafts (AI sequence), activity tracking, followup APIs"
```

---

### Task 10: xlsx 导入导出 + docx 导出（TDD）

**Files:**
- Create: `src/lib/xlsx.ts`, `src/lib/xlsx.test.ts`, `src/lib/docx.ts`, `src/app/api/projects/[id]/export/route.ts`, `src/app/api/projects/[id]/companies/import/route.ts`, `src/app/api/companies/[id]/drafts/export/route.ts`

**Interfaces:**
- Consumes: Task 2 `sql`，Task 4 守卫。
- Produces:
  - `buildWorkbook(data: {project, companies, contacts, activities}): Buffer` — 五 tab：`1-项目上下文`、`2-目标客户库`、`3-决策人`、`4-30天追踪`、`看板`（对齐原 Funik tracker 结构，第一 tab 由"海关反查"泛化为项目上下文）。
  - `parseImport(buf: Buffer): {rows: ImportRow[], errors: string[]}` — 读第一个 sheet，列名匹配 `公司名称/国家/城市/官网/优先级/备注`，坏行入 errors。
  - `buildSequenceDocx(companyName: string, drafts): Promise<Buffer>`。
  - `GET /api/projects/:id/export` → xlsx 下载；`POST /api/projects/:id/companies/import`（multipart file）→ `{inserted, errors[]}`；`GET /api/companies/:id/drafts/export` → docx 下载。

- [ ] **Step 1: 写失败测试 `src/lib/xlsx.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { buildWorkbook, parseImport } from './xlsx'

const sample = {
  project: { name: 'P', product_desc: 'tools', competitor_brands: ['X'], value_props: {}, target_markets: ['DE'], target_industries: [] },
  companies: [{ id: 1, name: 'Acme', country: 'DE', city: '', website: '', source: 'ai', competitor_brands_carried: ['X'], main_distribution: '', end_industries: '', size_estimate: '', fit_score: 4, priority: 'A', verify_status: 'unverified', status: '', notes: '' }],
  contacts: [{ company_id: 1, name: 'Jo', title: 'Buyer', linkedin_url: '', email: 'jo@acme.de', email_status: 'inferred', phone: '', preferred_channel: '', notes: '' }],
  activities: [{ company_id: 1, stage: '2-待发送', channel: '', first_touch_date: null, followup1_date: null, followup2_date: null, last_touch_date: null, replied: false, next_action: '', next_action_date: null, notes: '' }],
}

describe('buildWorkbook', () => {
  it('produces 5 tabs with company row', () => {
    const buf = buildWorkbook(sample as never)
    const wb = XLSX.read(buf)
    expect(wb.SheetNames).toEqual(['1-项目上下文', '2-目标客户库', '3-决策人', '4-30天追踪', '看板'])
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['2-目标客户库'])
    expect(rows[0]['公司名称']).toBe('Acme')
  })
})

describe('parseImport', () => {
  it('reads rows and reports bad ones', () => {
    const ws = XLSX.utils.json_to_sheet([
      { 公司名称: 'Beta GmbH', 国家: 'Germany', 城市: 'Berlin', 官网: 'https://beta.de', 优先级: 'A', 备注: '' },
      { 公司名称: '', 国家: 'US' },
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const { rows, errors } = parseImport(buf)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Beta GmbH')
    expect(errors).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 运行确认失败**

```powershell
npx vitest run src/lib/xlsx.test.ts
```

Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/lib/xlsx.ts`**

```ts
import * as XLSX from 'xlsx'

type AnyRow = Record<string, unknown>
export type ImportRow = { name: string; country: string; city: string; website: string; priority: 'A' | 'B' | 'C'; notes: string }

export function buildWorkbook(data: { project: AnyRow; companies: AnyRow[]; contacts: AnyRow[]; activities: AnyRow[] }): Buffer {
  const wb = XLSX.utils.book_new()
  const p = data.project
  const vp = (p.value_props ?? {}) as AnyRow

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
    项目: p.name, 产品线: p.product_desc,
    竞品品牌: (p.competitor_brands as string[] ?? []).join(', '),
    价格优势: vp.priceAdvantage ?? '', 量化实证: vp.proofPoints ?? '', 零风险条款: vp.riskFreeTerms ?? '',
    目标市场: (p.target_markets as string[] ?? []).join(', '),
    目标行业: (p.target_industries as string[] ?? []).join(', '),
  }]), '1-项目上下文')

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.companies.map((c, i) => ({
    序号: i + 1, 公司名称: c.name, '国家/地区': c.country, 城市: c.city, 官网: c.website,
    来源: c.source === 'ai' ? 'AI建议·待验证' : c.source === 'import' ? '导入' : '手动',
    在售竞品: (c.competitor_brands_carried as string[] ?? []).join(', '),
    主营分销: c.main_distribution, 服务终端行业: c.end_industries, '规模(估)': c.size_estimate,
    '契合度1-5': c.fit_score, '优先级A/B/C': c.priority,
    验证状态: c.verify_status, 状态: c.status, 备注: c.notes,
  }))), '2-目标客户库')

  const companyName = new Map(data.companies.map(c => [c.id, c.name]))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.contacts.map((t, i) => ({
    序号: i + 1, 公司: companyName.get(t.company_id) ?? '', 姓名: t.name, '职位/角色': t.title,
    'LinkedIn URL': t.linkedin_url, 邮箱: t.email, 邮箱状态: t.email_status, 电话: t.phone,
    优先渠道: t.preferred_channel, 备注: t.notes,
  }))), '3-决策人')

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.activities.map((a, i) => ({
    序号: i + 1, 公司: companyName.get(a.company_id) ?? '', 阶段: a.stage, 渠道: a.channel,
    首触日期: a.first_touch_date ?? '', 跟进1: a.followup1_date ?? '', 跟进2: a.followup2_date ?? '',
    最近触达: a.last_touch_date ?? '', 是否回复: a.replied ? '是' : '否',
    下一步动作: a.next_action, 下一步日期: a.next_action_date ?? '', 备注: a.notes,
  }))), '4-30天追踪')

  const stages = ['2-待发送', '3-草稿就绪', '4-首触已发', '5-跟进中', '6-已回复', '7-约电话/寄样']
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stages.map(s => ({
    阶段: s, 公司数: data.activities.filter(a => a.stage === s).length,
  }))), '看板')

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export function parseImport(buf: Buffer): { rows: ImportRow[]; errors: string[] } {
  const wb = XLSX.read(buf)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<AnyRow>(sheet)
  const rows: ImportRow[] = []
  const errors: string[] = []
  raw.forEach((r, i) => {
    const name = String(r['公司名称'] ?? '').trim()
    if (!name) { errors.push(`第 ${i + 2} 行：缺少公司名称`); return }
    const pr = String(r['优先级'] ?? 'B').trim().toUpperCase()
    rows.push({
      name,
      country: String(r['国家'] ?? r['国家/地区'] ?? '').trim(),
      city: String(r['城市'] ?? '').trim(),
      website: String(r['官网'] ?? '').trim(),
      priority: (['A', 'B', 'C'].includes(pr) ? pr : 'B') as 'A' | 'B' | 'C',
      notes: String(r['备注'] ?? '').trim(),
    })
  })
  return { rows, errors }
}
```

- [ ] **Step 4: 运行确认通过**

```powershell
npx vitest run src/lib/xlsx.test.ts
```

Expected: 2 passed。

- [ ] **Step 5: 实现 `src/lib/docx.ts`**

```ts
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx'

type Email = { subject: string; body: string }
type Drafts = { email1: Email; email2: Email; email3: Email; linkedin_note: string; linkedin_followup: string }

export async function buildSequenceDocx(companyName: string, d: Drafts): Promise<Buffer> {
  const emailSection = (title: string, e: Email) => [
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(title)] }),
    new Paragraph({ children: [new TextRun({ text: `Subject: ${e.subject}`, bold: true })] }),
    ...e.body.split('\n').map(line => new Paragraph({ children: [new TextRun(line)] })),
  ]
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`Cold Email Sequence — ${companyName}`)] }),
        new Paragraph({ children: [new TextRun('（本文档由 CXODEX 国际市场开拓工作台生成，请人工发送，工具不代发。）')] }),
        ...emailSection('Email 1 · Day 0 (competitor hook)', d.email1),
        ...emailSection('Email 2 · +3 days (OEM / private label)', d.email2),
        ...emailSection('Email 3 · +7 days (zero-risk close)', d.email3),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('LinkedIn connection note (≤300 chars)')] }),
        new Paragraph({ children: [new TextRun(d.linkedin_note)] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('LinkedIn follow-up after accept')] }),
        new Paragraph({ children: [new TextRun(d.linkedin_followup)] }),
      ],
    }],
  })
  return Buffer.from(await Packer.toBuffer(doc))
}
```

- [ ] **Step 6: 三个 API route**

```ts
// src/app/api/projects/[id]/export/route.ts
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertProjectOwner, errorResponse } from '@/lib/tenant'
import { buildWorkbook } from '@/lib/xlsx'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const pid = Number((await ctx.params).id)
    await assertProjectOwner(pid, u.uid)
    const [project] = await sql`SELECT * FROM projects WHERE id = ${pid}`
    const companies = await sql`SELECT * FROM companies WHERE project_id = ${pid} ORDER BY id`
    const contacts = await sql`
      SELECT ct.* FROM contacts ct JOIN companies c ON c.id = ct.company_id
      WHERE c.project_id = ${pid} ORDER BY ct.id`
    const activities = await sql`
      SELECT a.* FROM activities a JOIN companies c ON c.id = a.company_id
      WHERE c.project_id = ${pid} ORDER BY a.id`
    const buf = buildWorkbook({ project, companies, contacts, activities } as never)
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="bd-tracker-${pid}.xlsx"`,
      },
    })
  } catch (e) { return errorResponse(e) }
}
```

```ts
// src/app/api/projects/[id]/companies/import/route.ts
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertProjectOwner, errorResponse } from '@/lib/tenant'
import { parseImport } from '@/lib/xlsx'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const pid = Number((await ctx.params).id)
    await assertProjectOwner(pid, u.uid)
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return Response.json({ error: '缺少文件' }, { status: 400 })
    const { rows, errors } = parseImport(Buffer.from(await file.arrayBuffer()))
    let inserted = 0
    for (const r of rows) {
      const res = await sql`
        INSERT INTO companies (project_id, name, country, city, website, source, priority, notes)
        VALUES (${pid}, ${r.name}, ${r.country}, ${r.city}, ${r.website}, 'import', ${r.priority}, ${r.notes})
        RETURNING id`
      await sql`INSERT INTO activities (company_id) VALUES (${res[0].id}) ON CONFLICT DO NOTHING`
      inserted++
    }
    return Response.json({ inserted, errors })
  } catch (e) { return errorResponse(e) }
}
```

```ts
// src/app/api/companies/[id]/drafts/export/route.ts
import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertCompanyOwner, errorResponse } from '@/lib/tenant'
import { buildSequenceDocx } from '@/lib/docx'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    await assertCompanyOwner(cid, u.uid)
    const [d] = await sql`SELECT * FROM drafts WHERE company_id = ${cid}`
    if (!d || !d.email1) return Response.json({ error: '尚无草稿' }, { status: 404 })
    const [c] = await sql`SELECT name FROM companies WHERE id = ${cid}`
    const buf = await buildSequenceDocx(c.name as string, d as never)
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="sequence-${cid}.docx"`,
      },
    })
  } catch (e) { return errorResponse(e) }
}
```

- [ ] **Step 7: 跑全部测试 + 类型检查**

```powershell
npm test; npx tsc --noEmit
```

Expected: 全部通过。

- [ ] **Step 8: Commit**

```powershell
git add src/lib/xlsx.ts src/lib/xlsx.test.ts src/lib/docx.ts src/app/api
git commit -m "feat: xlsx 5-tab export/import and docx sequence export with tests"
```

---

### Task 11: 邀请码脚本 + 全链路冒烟脚本

**Files:**
- Create: `scripts/seed-invite.mjs`, `scripts/smoke.mjs`

**Interfaces:**
- Consumes: 全部已有 API。
- Produces: `npm run smoke` 一键验证注册→建项目→手动加公司→加联系人→更新追踪→导出 xlsx 的链路（AI 端点因消耗额度不进冒烟，单独人工验证）。

- [ ] **Step 1: scripts/seed-invite.mjs**

```js
import { neon } from '@neondatabase/serverless'
import { randomBytes } from 'node:crypto'

const sql = neon(process.env.DATABASE_URL)
const code = process.argv[2] || `BD-${randomBytes(4).toString('hex').toUpperCase()}`
const maxUses = Number(process.argv[3] || 5)
await sql`INSERT INTO invite_codes (code, max_uses) VALUES (${code}, ${maxUses})
          ON CONFLICT (code) DO UPDATE SET max_uses = ${maxUses}`
console.log(`invite code: ${code} (max_uses=${maxUses})`)
```

- [ ] **Step 2: scripts/smoke.mjs**

```js
const BASE = process.env.SMOKE_BASE || 'http://localhost:3005'
const email = `smoke-${Date.now()}@test.local`
let cookie = ''

async function call(method, path, body, expectStatus) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  if (res.status !== expectStatus) {
    console.error(`FAIL ${method} ${path} → ${res.status} (want ${expectStatus}):`, await res.text())
    process.exit(1)
  }
  console.log(`ok   ${method} ${path} → ${res.status}`)
  const ct = res.headers.get('content-type') || ''
  return ct.includes('json') ? res.json() : res.arrayBuffer()
}

const invite = process.env.SMOKE_INVITE || 'DEV-TEST'
await call('POST', '/api/auth/register', { email, password: 'password1', inviteCode: invite }, 201)
await call('GET', '/api/auth/me', null, 200)
const proj = await call('POST', '/api/projects', {
  name: '冒烟项目', productDesc: '超硬刀具',
  competitorBrands: ['BrandX'], targetMarkets: ['Germany'], targetIndustries: ['automotive'],
  valueProps: { priceAdvantage: '1/3 价格', proofPoints: '寿命+100%', riskFreeTerms: '90天验证' },
}, 201)
const comp = await call('POST', `/api/projects/${proj.id}/companies`, { name: 'Smoke GmbH', country: 'Germany' }, 201)
await call('POST', `/api/companies/${comp.id}/contacts`, { name: 'Jo Smoke', title: 'Buyer', email: 'jo@smoke.de', emailStatus: 'inferred' }, 201)
await call('PUT', `/api/companies/${comp.id}/activity`, { stage: '4-首触已发', firstTouchDate: '2026-07-02', lastTouchDate: '2026-07-02' }, 200)
const xlsxBuf = await call('GET', `/api/projects/${proj.id}/export`, null, 200)
if (xlsxBuf.byteLength < 1000) { console.error('FAIL export too small'); process.exit(1) }
await call('DELETE', `/api/projects/${proj.id}`, null, 200)
console.log('SMOKE PASS')
```

- [ ] **Step 3: 运行**

```powershell
node scripts/seed-invite.mjs DEV-TEST 100   # 需 $env:DATABASE_URL
npm run dev
# 另开终端：
npm run smoke
```

Expected: 逐行 `ok`，最后 `SMOKE PASS`。

- [ ] **Step 4: Commit**

```powershell
git add scripts
git commit -m "feat: invite seeding and end-to-end API smoke script"
```

---

### Task 12: UI — 全局样式 + 营销首页 + 登录/注册

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- Create: `src/app/login/page.tsx`, `src/app/register/page.tsx`

**Interfaces:**
- Consumes: `/api/auth/*`。
- Produces: 免登录首页（方法论介绍 + 注册/登录入口）；登录/注册页成功后跳 `/dashboard`。

- [ ] **Step 1: layout.tsx 与 globals.css**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CXODEX 国际市场开拓工作台',
  description: '竞品信号法：AI 辅助的海外经销商开发全流程工作台',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
```

`globals.css`（单文件极简设计系统，深色主题、卡片、表格、按钮、badge、表单，约 150 行）：

```css
:root {
  --bg: #0e1117; --panel: #171c26; --border: #2a3244;
  --text: #e6e9f0; --muted: #8b94a7; --accent: #3b82f6; --accent2: #22c55e;
  --danger: #ef4444; --warn: #f59e0b;
}
* { box-sizing: border-box; margin: 0; }
body { background: var(--bg); color: var(--text); font: 15px/1.6 -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
a { color: var(--accent); text-decoration: none; }
.container { max-width: 1200px; margin: 0 auto; padding: 24px; }
.card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 16px; }
.btn { display: inline-block; background: var(--accent); color: #fff; border: 0; border-radius: 8px; padding: 8px 16px; cursor: pointer; font-size: 14px; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn.secondary { background: transparent; border: 1px solid var(--border); color: var(--text); }
.btn.danger { background: var(--danger); }
input, select, textarea { background: #0b0e14; color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 14px; width: 100%; }
label { display: block; margin: 10px 0 4px; color: var(--muted); font-size: 13px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { border-bottom: 1px solid var(--border); padding: 8px 6px; text-align: left; vertical-align: top; }
th { color: var(--muted); font-weight: 500; white-space: nowrap; }
.badge { display: inline-block; border-radius: 999px; padding: 1px 8px; font-size: 12px; border: 1px solid var(--border); }
.badge.ai { color: var(--warn); border-color: var(--warn); }
.badge.ok { color: var(--accent2); border-color: var(--accent2); }
.badge.bad { color: var(--danger); border-color: var(--danger); }
.notice { background: rgba(245,158,11,.1); border: 1px solid var(--warn); border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.topnav { display: flex; gap: 16px; align-items: center; padding: 14px 24px; border-bottom: 1px solid var(--border); }
.topnav .spacer { flex: 1; }
.error { color: var(--danger); font-size: 13px; margin-top: 8px; }
h1 { font-size: 26px; margin-bottom: 8px; } h2 { font-size: 18px; margin-bottom: 12px; }
.muted { color: var(--muted); }
```

- [ ] **Step 2: 营销首页 page.tsx**

```tsx
import Link from 'next/link'

export default function Home() {
  return (
    <div className="container" style={{ maxWidth: 860 }}>
      <div style={{ padding: '60px 0 30px' }}>
        <h1>CXODEX 国际市场开拓工作台</h1>
        <p className="muted" style={{ fontSize: 17 }}>
          用"竞品信号法"开发海外经销商：找到已经在卖竞品的渠道商，用竞品钩子首触，
          以价格优势 + 量化实证 + 零风险条款打开对话。源自超硬刀具行业已验证的出海打法，适用于任何 B2B 产品。
        </p>
        <p style={{ marginTop: 20 }}>
          <Link className="btn" href="/register">邀请码注册</Link>{' '}
          <Link className="btn secondary" href="/login">登录</Link>
        </p>
      </div>
      <div className="grid2">
        <div className="card"><h2>① 目标客户库</h2><p className="muted">AI 按目标市场生成候选经销商（标注"AI 建议 · 待验证"），支持手动录入与 Excel 导入导出。</p></div>
        <div className="card"><h2>② 决策人定位</h2><p className="muted">AI 生成职位画像与 LinkedIn 搜索话术；联系方式人工核实录入，邮箱四态标注控制退信风险。</p></div>
        <div className="card"><h2>③ 冷邮件工坊</h2><p className="muted">一键生成英文三封序列（竞品钩子 / OEM 贴牌 / 零风险收尾）+ LinkedIn 文案，可编辑导出 Word。</p></div>
        <div className="card"><h2>④ 30 天追踪看板</h2><p className="muted">阶段漏斗、超 3 天未跟进提醒、一键生成跟进草稿。工具只生成不代发，发送永远由你人工执行。</p></div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: login/page.tsx 与 register/page.tsx（客户端表单）**

```tsx
// src/app/login/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Login() {
  const r = useRouter()
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    setBusy(false)
    if (res.ok) r.push('/dashboard')
    else setErr((await res.json()).error || '登录失败')
  }
  return (
    <div className="container" style={{ maxWidth: 400, paddingTop: 80 }}>
      <div className="card">
        <h1>登录</h1>
        <form onSubmit={submit}>
          <label>邮箱</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label>密码</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          {err && <p className="error">{err}</p>}
          <p style={{ marginTop: 16 }}><button className="btn" disabled={busy}>登录</button></p>
        </form>
        <p className="muted" style={{ marginTop: 12 }}>没有账号？<Link href="/register">邀请码注册</Link></p>
      </div>
    </div>
  )
}
```

```tsx
// src/app/register/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Register() {
  const r = useRouter()
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [inviteCode, setInviteCode] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, inviteCode }) })
    setBusy(false)
    if (res.ok) r.push('/dashboard')
    else setErr((await res.json()).error || '注册失败')
  }
  return (
    <div className="container" style={{ maxWidth: 400, paddingTop: 80 }}>
      <div className="card">
        <h1>邀请码注册</h1>
        <form onSubmit={submit}>
          <label>邀请码</label><input value={inviteCode} onChange={e => setInviteCode(e.target.value)} required />
          <label>邮箱</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label>密码（至少 8 位）</label><input type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
          {err && <p className="error">{err}</p>}
          <p style={{ marginTop: 16 }}><button className="btn" disabled={busy}>注册</button></p>
        </form>
        <p className="muted" style={{ marginTop: 12 }}>已有账号？<Link href="/login">登录</Link></p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 构建 + 浏览器验证**

```powershell
npm run build; npm run dev
```

浏览器打开 http://localhost:3005 检查首页/注册/登录三页；用 DEV-TEST 邀请码走一遍注册跳转 /dashboard（暂 404，Task 13 补）。

- [ ] **Step 5: Commit**

```powershell
git add src/app
git commit -m "feat: global styles, marketing homepage, login and register pages"
```

---

### Task 13: UI — 项目列表 + 四步项目向导 + 项目内导航

**Files:**
- Create: `src/app/dashboard/page.tsx`, `src/app/projects/new/page.tsx`, `src/app/projects/[id]/nav.tsx`

**Interfaces:**
- Consumes: `/api/projects`、`/api/auth/me`、`/api/auth/logout`。
- Produces: `/dashboard` 项目卡片列表 + 新建入口；`/projects/new` 四步向导（产品→竞品→价值主张→市场行业）提交后跳 `/projects/[id]/companies`；`<ProjectNav id={..} active={..}/>` 组件供四个项目页共用（含导出 xlsx 链接与退出登录）。

- [ ] **Step 1: dashboard/page.tsx**

```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Project = { id: number; name: string; product_desc: string; target_markets: string[]; created_at: string }

export default function Dashboard() {
  const r = useRouter()
  const [projects, setProjects] = useState<Project[] | null>(null)
  useEffect(() => {
    fetch('/api/projects').then(async res => {
      if (res.status === 401) { r.push('/login'); return }
      setProjects(await res.json())
    })
  }, [r])
  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); r.push('/') }
  return (
    <>
      <div className="topnav">
        <strong>CXODEX 国际市场开拓</strong><span className="spacer" />
        <button className="btn secondary" onClick={logout}>退出</button>
      </div>
      <div className="container">
        <h1>我的项目</h1>
        <p style={{ margin: '12px 0' }}><Link className="btn" href="/projects/new">+ 新建开拓项目</Link></p>
        {projects === null ? <p className="muted">加载中…</p> :
          projects.length === 0 ? <div className="card muted">还没有项目，点上方新建。</div> :
          projects.map(p => (
            <Link key={p.id} href={`/projects/${p.id}/companies`}>
              <div className="card">
                <h2>{p.name}</h2>
                <p className="muted">{p.product_desc}</p>
                <p className="muted">市场：{p.target_markets.join('、') || '未设置'}</p>
              </div>
            </Link>
          ))}
      </div>
    </>
  )
}
```

- [ ] **Step 2: projects/new/page.tsx（四步向导）**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STEPS = ['产品线', '竞品品牌', '价值主张', '目标市场与行业']

export default function NewProject() {
  const r = useRouter()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(''); const [productDesc, setProductDesc] = useState('')
  const [brands, setBrands] = useState(''); const [markets, setMarkets] = useState(''); const [industries, setIndustries] = useState('')
  const [priceAdvantage, setPriceAdvantage] = useState(''); const [proofPoints, setProofPoints] = useState(''); const [riskFreeTerms, setRiskFreeTerms] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)

  const splitList = (s: string) => s.split(/[,，、\n]/).map(x => x.trim()).filter(Boolean)

  async function submit() {
    setBusy(true); setErr('')
    const res = await fetch('/api/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, productDesc,
        competitorBrands: splitList(brands),
        targetMarkets: splitList(markets),
        targetIndustries: splitList(industries),
        valueProps: { priceAdvantage, proofPoints, riskFreeTerms },
      }),
    })
    setBusy(false)
    if (res.ok) { const { id } = await res.json(); r.push(`/projects/${id}/companies`) }
    else setErr((await res.json()).error || '创建失败')
  }

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <h1>新建开拓项目</h1>
      <p className="muted">第 {step + 1} / 4 步：{STEPS[step]}</p>
      <div className="card">
        {step === 0 && (<>
          <label>项目名称</label><input value={name} onChange={e => setName(e.target.value)} placeholder="如：PCBN 刀片欧洲开拓" />
          <label>产品线描述（卖什么、优势是什么）</label>
          <textarea rows={4} value={productDesc} onChange={e => setProductDesc(e.target.value)} placeholder="如：PCBN 车削刀片，用于淬硬钢/铸铁加工…" />
        </>)}
        {step === 1 && (<>
          <label>竞品品牌（逗号或换行分隔，这是冷邮件的首触钩子）</label>
          <textarea rows={4} value={brands} onChange={e => setBrands(e.target.value)} placeholder="如：Sumitomo, Element Six, Kennametal" />
        </>)}
        {step === 2 && (<>
          <label>价格优势</label><input value={priceAdvantage} onChange={e => setPriceAdvantage(e.target.value)} placeholder="如：同级性能约为竞品 1/3 价格" />
          <label>量化实证（客户实测数据）</label><input value={proofPoints} onChange={e => setProofPoints(e.target.value)} placeholder="如：刀具寿命 +30~200%，效率 +20~50%" />
          <label>零风险条款</label><input value={riskFreeTerms} onChange={e => setRiskFreeTerms(e.target.value)} placeholder="如：90 天验证 / 不达标不成交 / 寄售" />
        </>)}
        {step === 3 && (<>
          <label>目标市场（国家，逗号分隔）</label>
          <input value={markets} onChange={e => setMarkets(e.target.value)} placeholder="如：Germany, USA, Italy, Poland" />
          <label>目标终端行业</label>
          <input value={industries} onChange={e => setIndustries(e.target.value)} placeholder="如：automotive, bearings, gears" />
        </>)}
        {err && <p className="error">{err}</p>}
        <p style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          {step > 0 && <button className="btn secondary" onClick={() => setStep(step - 1)}>上一步</button>}
          {step < 3 && <button className="btn" disabled={step === 0 && (!name || !productDesc)} onClick={() => setStep(step + 1)}>下一步</button>}
          {step === 3 && <button className="btn" disabled={busy || !name || !productDesc} onClick={submit}>创建项目</button>}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: projects/[id]/nav.tsx**

```tsx
'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const TABS = [
  { key: 'companies', label: '目标客户库' },
  { key: 'contacts', label: '决策人' },
  { key: 'drafts', label: '冷邮件工坊' },
  { key: 'board', label: '30天看板' },
]

export default function ProjectNav({ id, active }: { id: string; active: string }) {
  const r = useRouter()
  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); r.push('/') }
  return (
    <div className="topnav">
      <Link href="/dashboard"><strong>← 项目</strong></Link>
      {TABS.map(t => (
        <Link key={t.key} href={`/projects/${id}/${t.key}`}
          style={{ color: active === t.key ? 'var(--text)' : 'var(--muted)', fontWeight: active === t.key ? 600 : 400 }}>
          {t.label}
        </Link>
      ))}
      <span className="spacer" />
      <a className="btn secondary" href={`/api/projects/${id}/export`}>导出 Excel</a>
      <button className="btn secondary" onClick={logout}>退出</button>
    </div>
  )
}
```

- [ ] **Step 4: 构建 + 浏览器验证**

`npm run build` 通过；浏览器登录 → dashboard → 新建向导四步 → 提交后跳转 companies 页（暂 404，Task 14 补）。

- [ ] **Step 5: Commit**

```powershell
git add src/app/dashboard src/app/projects
git commit -m "feat: dashboard, 4-step project wizard, project nav"
```

---

### Task 14: UI — 目标客户库页

**Files:**
- Create: `src/app/projects/[id]/companies/page.tsx`

**Interfaces:**
- Consumes: `/api/projects/:id/companies`（GET/POST）、`/companies/generate`、`/companies/import`、`/api/companies/:id`（PATCH/DELETE）、`ProjectNav`。
- Produces: 表格页——AI 生成按钮（选市场）、手动新增表单（折叠）、xlsx 导入、行内改优先级/验证状态、删除。

- [ ] **Step 1: 实现页面**

```tsx
'use client'
import { useCallback, useEffect, useState, use } from 'react'
import ProjectNav from '../nav'

type Company = {
  id: number; name: string; country: string; city: string; website: string; source: string
  competitor_brands_carried: string[]; main_distribution: string; end_industries: string
  size_estimate: string; fit_score: number; priority: string; verify_status: string; notes: string; stage: string | null
}
type Project = { target_markets: string[] }

export default function CompaniesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [companies, setCompanies] = useState<Company[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [market, setMarket] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState(''); const [newCountry, setNewCountry] = useState('')

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([
      fetch(`/api/projects/${id}/companies`).then(r => r.json()),
      fetch(`/api/projects/${id}`).then(r => r.json()),
    ])
    setCompanies(c); setProject(p)
    if (!market && p.target_markets?.length) setMarket(p.target_markets[0])
  }, [id, market])
  useEffect(() => { load() }, [load])

  async function generate() {
    if (!market) { setMsg('请先选择市场'); return }
    setBusy(true); setMsg('AI 生成中（约 30–60 秒）…')
    const res = await fetch(`/api/projects/${id}/companies/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ market }),
    })
    setBusy(false)
    if (res.ok) { const { inserted, dropped } = await res.json(); setMsg(`已生成 ${inserted} 家候选${dropped ? `（丢弃 ${dropped} 条不合规行）` : ''}，均为"AI 建议 · 待验证"`); load() }
    else setMsg((await res.json()).error || '生成失败，可重试')
  }

  async function addManual() {
    if (!newName) return
    const res = await fetch(`/api/projects/${id}/companies`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, country: newCountry }),
    })
    if (res.ok) { setNewName(''); setNewCountry(''); setShowAdd(false); load() }
  }

  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    const fd = new FormData(); fd.append('file', f)
    const res = await fetch(`/api/projects/${id}/companies/import`, { method: 'POST', body: fd })
    const j = await res.json()
    setMsg(res.ok ? `导入 ${j.inserted} 家${j.errors?.length ? `，${j.errors.length} 行有误：${j.errors.slice(0, 3).join('；')}` : ''}` : j.error)
    load(); e.target.value = ''
  }

  async function patch(cid: number, body: Record<string, unknown>) {
    await fetch(`/api/companies/${cid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    load()
  }
  async function del(cid: number) {
    if (!confirm('删除这家公司及其联系人/草稿/追踪记录？')) return
    await fetch(`/api/companies/${cid}`, { method: 'DELETE' }); load()
  }

  return (
    <>
      <ProjectNav id={id} active="companies" />
      <div className="container">
        <h1>目标客户库 <span className="muted" style={{ fontSize: 14 }}>{companies.length} 家</span></h1>
        <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select style={{ width: 180 }} value={market} onChange={e => setMarket(e.target.value)}>
            <option value="">选择市场…</option>
            {project?.target_markets?.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button className="btn" disabled={busy} onClick={generate}>AI 生成候选经销商</button>
          <button className="btn secondary" onClick={() => setShowAdd(!showAdd)}>+ 手动添加</button>
          <label className="btn secondary" style={{ width: 'auto', margin: 0 }}>
            导入 Excel<input type="file" accept=".xlsx" style={{ display: 'none' }} onChange={importFile} />
          </label>
          {msg && <span className="muted">{msg}</span>}
        </div>
        {showAdd && (
          <div className="card" style={{ display: 'flex', gap: 8 }}>
            <input placeholder="公司名称" value={newName} onChange={e => setNewName(e.target.value)} />
            <input placeholder="国家" value={newCountry} onChange={e => setNewCountry(e.target.value)} />
            <button className="btn" onClick={addManual}>保存</button>
          </div>
        )}
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>公司</th><th>国家/城市</th><th>在售竞品</th><th>契合</th><th>优先级</th><th>验证</th><th>阶段</th><th>备注</th><th></th></tr></thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>{' '}
                    {c.source === 'ai' && <span className="badge ai">AI 建议 · 待验证</span>}
                    {c.website && <div><a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" className="muted">{c.website}</a></div>}
                  </td>
                  <td>{c.country}{c.city ? ` / ${c.city}` : ''}</td>
                  <td>{c.competitor_brands_carried.join(', ')}</td>
                  <td>{c.fit_score}</td>
                  <td>
                    <select value={c.priority} onChange={e => patch(c.id, { priority: e.target.value })} style={{ width: 56 }}>
                      <option>A</option><option>B</option><option>C</option>
                    </select>
                  </td>
                  <td>
                    <select value={c.verify_status} onChange={e => patch(c.id, { verifyStatus: e.target.value })} style={{ width: 100 }}>
                      <option value="unverified">待验证</option>
                      <option value="verified">已验证</option>
                      <option value="rejected">已排除</option>
                    </select>
                  </td>
                  <td>{c.stage ?? '—'}</td>
                  <td style={{ maxWidth: 260 }} className="muted">{c.notes}</td>
                  <td><button className="btn danger" style={{ padding: '2px 8px' }} onClick={() => del(c.id)}>删</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: 构建 + 浏览器验证**

`npm run build` 通过；浏览器：AI 生成一批（配 key）→ 表格出现带黄色"AI 建议 · 待验证"badge 的行 → 改优先级/验证状态即时保存 → 导入 Task 10 测试造的 xlsx → 删除一行。

- [ ] **Step 3: Commit**

```powershell
git add src/app/projects
git commit -m "feat: company library page with AI generation, import, inline edit"
```

---

### Task 15: UI — 决策人页 + 冷邮件工坊页

**Files:**
- Create: `src/app/projects/[id]/contacts/page.tsx`, `src/app/projects/[id]/drafts/page.tsx`

**Interfaces:**
- Consumes: companies 列表、`/api/companies/:id/contacts|persona|drafts|drafts/generate|drafts/export`、`/api/contacts/:id`。
- Produces: 决策人页（左列公司选择、右侧联系人表 + AI 画像面板）；工坊页（左列公司选择、右侧三封邮件 + LinkedIn 文案编辑器，生成/保存/复制/导出 Word，顶部合规提示）。

- [ ] **Step 1: contacts/page.tsx**

```tsx
'use client'
import { useCallback, useEffect, useState, use } from 'react'
import ProjectNav from '../nav'

type Company = { id: number; name: string; country: string; priority: string }
type Contact = { id: number; name: string; title: string; linkedin_url: string; email: string; email_status: string; notes: string }
const STATUS_LABEL: Record<string, string> = { verified: '已验证', inferred: '推测', catchall: '通用', invalid: '无效' }

export default function ContactsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [companies, setCompanies] = useState<Company[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [persona, setPersona] = useState(''); const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ name: '', title: '', linkedinUrl: '', email: '', emailStatus: 'inferred' })

  useEffect(() => {
    fetch(`/api/projects/${id}/companies`).then(r => r.json()).then((cs: Company[]) => {
      setCompanies(cs); if (cs.length && sel === null) setSel(cs[0].id)
    })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadContacts = useCallback(async () => {
    if (sel === null) return
    setContacts(await fetch(`/api/companies/${sel}/contacts`).then(r => r.json()))
  }, [sel])
  useEffect(() => { setPersona(''); loadContacts() }, [loadContacts])

  async function genPersona() {
    setBusy(true); setPersona('AI 生成中…')
    const res = await fetch(`/api/companies/${sel}/persona`, { method: 'POST' })
    setBusy(false)
    setPersona(res.ok ? (await res.json()).text : '生成失败，可重试')
  }
  async function addContact() {
    const res = await fetch(`/api/companies/${sel}/contacts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
    })
    if (res.ok) { setF({ name: '', title: '', linkedinUrl: '', email: '', emailStatus: 'inferred' }); loadContacts() }
  }
  async function setStatus(cid: number, emailStatus: string) {
    await fetch(`/api/contacts/${cid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emailStatus }) })
    loadContacts()
  }
  async function delContact(cid: number) {
    await fetch(`/api/contacts/${cid}`, { method: 'DELETE' }); loadContacts()
  }

  return (
    <>
      <ProjectNav id={id} active="contacts" />
      <div className="container">
        <h1>决策人</h1>
        <p className="notice">邮箱只人工录入并标注状态；"推测/通用"地址有退信风险，发送前请核实。本工具不代发。</p>
        <div className="grid2">
          <div className="card">
            <label>选择公司</label>
            <select value={sel ?? ''} onChange={e => setSel(Number(e.target.value))}>
              {companies.map(c => <option key={c.id} value={c.id}>[{c.priority}] {c.name}（{c.country}）</option>)}
            </select>
            <p style={{ marginTop: 12 }}><button className="btn" disabled={busy || sel === null} onClick={genPersona}>AI：该找谁 + LinkedIn 搜索话术</button></p>
            {persona && <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, marginTop: 10 }} className="muted">{persona}</pre>}
          </div>
          <div className="card">
            <h2>联系人</h2>
            <table>
              <thead><tr><th>姓名/职位</th><th>邮箱</th><th>状态</th><th></th></tr></thead>
              <tbody>
                {contacts.map(t => (
                  <tr key={t.id}>
                    <td>{t.name}<div className="muted">{t.title}</div>{t.linkedin_url && <a href={t.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a>}</td>
                    <td>{t.email}</td>
                    <td>
                      <select value={t.email_status} onChange={e => setStatus(t.id, e.target.value)} style={{ width: 90 }}>
                        {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td><button className="btn danger" style={{ padding: '2px 8px' }} onClick={() => delContact(t.id)}>删</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h2 style={{ marginTop: 16 }}>新增</h2>
            <input placeholder="姓名" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} style={{ marginBottom: 6 }} />
            <input placeholder="职位" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} style={{ marginBottom: 6 }} />
            <input placeholder="LinkedIn URL" value={f.linkedinUrl} onChange={e => setF({ ...f, linkedinUrl: e.target.value })} style={{ marginBottom: 6 }} />
            <input placeholder="邮箱" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} style={{ marginBottom: 6 }} />
            <button className="btn" disabled={sel === null} onClick={addContact}>添加联系人</button>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: drafts/page.tsx**

```tsx
'use client'
import { useCallback, useEffect, useState, use } from 'react'
import ProjectNav from '../nav'

type Company = { id: number; name: string; country: string; priority: string }
type Email = { subject: string; body: string }
type Drafts = { email1: Email | null; email2: Email | null; email3: Email | null; linkedin_note: string; linkedin_followup: string } | null
const EMPTY: Email = { subject: '', body: '' }

export default function DraftsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [companies, setCompanies] = useState<Company[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [e1, setE1] = useState<Email>(EMPTY); const [e2, setE2] = useState<Email>(EMPTY); const [e3, setE3] = useState<Email>(EMPTY)
  const [note, setNote] = useState(''); const [followup, setFollowup] = useState('')
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch(`/api/projects/${id}/companies`).then(r => r.json()).then((cs: Company[]) => {
      setCompanies(cs); if (cs.length && sel === null) setSel(cs[0].id)
    })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (sel === null) return
    const d: Drafts = await fetch(`/api/companies/${sel}/drafts`).then(r => r.json())
    setE1(d?.email1 ?? EMPTY); setE2(d?.email2 ?? EMPTY); setE3(d?.email3 ?? EMPTY)
    setNote(d?.linkedin_note ?? ''); setFollowup(d?.linkedin_followup ?? ''); setMsg('')
  }, [sel])
  useEffect(() => { load() }, [load])

  async function generate() {
    setBusy(true); setMsg('AI 生成中（约 30–60 秒）…')
    const res = await fetch(`/api/companies/${sel}/drafts/generate`, { method: 'POST' })
    setBusy(false)
    if (res.ok) { setMsg('已生成，可编辑后保存'); load() }
    else setMsg((await res.json()).error || '生成失败，可重试（已填内容未丢失）')
  }
  async function save() {
    const res = await fetch(`/api/companies/${sel}/drafts`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email1: e1, email2: e2, email3: e3, linkedin_note: note, linkedin_followup: followup }),
    })
    setMsg(res.ok ? '已保存' : '保存失败：三封邮件的主题和正文都不能为空')
  }
  function copy(text: string) { navigator.clipboard.writeText(text); setMsg('已复制到剪贴板') }

  const editor = (label: string, v: Email, set: (e: Email) => void) => (
    <div className="card">
      <h2>{label} <button className="btn secondary" style={{ float: 'right', padding: '2px 10px' }} onClick={() => copy(`Subject: ${v.subject}\n\n${v.body}`)}>复制</button></h2>
      <label>Subject</label><input value={v.subject} onChange={e => set({ ...v, subject: e.target.value })} />
      <label>Body</label><textarea rows={8} value={v.body} onChange={e => set({ ...v, body: e.target.value })} />
    </div>
  )

  return (
    <>
      <ProjectNav id={id} active="drafts" />
      <div className="container">
        <h1>冷邮件工坊</h1>
        <p className="notice"><strong>本工具只生成草稿，不代发。</strong>请用你自己的邮箱/LinkedIn 人工发送；冷邮件建议独立发件域名 + SPF/DKIM/DMARC + 小批量，遵守 CAN-SPAM/GDPR。</p>
        <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select style={{ width: 320 }} value={sel ?? ''} onChange={e => setSel(Number(e.target.value))}>
            {companies.map(c => <option key={c.id} value={c.id}>[{c.priority}] {c.name}（{c.country}）</option>)}
          </select>
          <button className="btn" disabled={busy || sel === null} onClick={generate}>AI 生成三封序列</button>
          <button className="btn secondary" disabled={sel === null} onClick={save}>保存编辑</button>
          <a className="btn secondary" href={sel !== null ? `/api/companies/${sel}/drafts/export` : '#'}>导出 Word</a>
          {msg && <span className="muted">{msg}</span>}
        </div>
        {editor('Email 1 · Day 0（竞品钩子）', e1, setE1)}
        {editor('Email 2 · +3 天（OEM/贴牌）', e2, setE2)}
        {editor('Email 3 · +7 天（零风险收尾）', e3, setE3)}
        <div className="card">
          <h2>LinkedIn 文案 <button className="btn secondary" style={{ float: 'right', padding: '2px 10px' }} onClick={() => copy(note)}>复制连接语</button></h2>
          <label>连接请求（≤300 字符，当前 {note.length}）</label>
          <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} />
          <label>通过后跟进</label>
          <textarea rows={4} value={followup} onChange={e => setFollowup(e.target.value)} />
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: 构建 + 浏览器验证**

`npm run build`；浏览器：决策人页 AI 画像 + 增删联系人 + 邮箱状态切换；工坊页生成序列 → 编辑 → 保存 → 复制 → 导出 Word 打开检查（含退订与合规提示行）。

- [ ] **Step 4: Commit**

```powershell
git add src/app/projects
git commit -m "feat: contacts page with AI persona, cold-email workshop page"
```

---

### Task 16: UI — 30 天追踪看板

**Files:**
- Create: `src/app/projects/[id]/board/page.tsx`

**Interfaces:**
- Consumes: companies 列表（含 stage）、`/api/companies/:id/activity`（GET/PUT）、`/api/companies/:id/followup`。
- Produces: 漏斗统计条 + 全公司追踪表（阶段下拉、日期、回复勾选、下一步）+ "超 3 天未跟进且未回复"红区（每行"AI 跟进草稿"按钮弹出结果供复制）。

- [ ] **Step 1: 实现页面**

```tsx
'use client'
import { useCallback, useEffect, useState, use } from 'react'
import ProjectNav from '../nav'

const STAGES = ['2-待发送', '3-草稿就绪', '4-首触已发', '5-跟进中', '6-已回复', '7-约电话/寄样']
type Row = {
  id: number; name: string; country: string; priority: string; stage: string | null
  activity?: { stage: string; first_touch_date: string | null; last_touch_date: string | null; replied: boolean; next_action: string; next_action_date: string | null }
}

export default function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [rows, setRows] = useState<Row[]>([])
  const [followup, setFollowup] = useState<{ company: string; subject: string; body: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const companies: Row[] = await fetch(`/api/projects/${id}/companies`).then(r => r.json())
    const withActivity = await Promise.all(companies.map(async c => ({
      ...c, activity: await fetch(`/api/companies/${c.id}/activity`).then(r => r.json()),
    })))
    setRows(withActivity)
  }, [id])
  useEffect(() => { load() }, [load])

  async function put(cid: number, body: Record<string, unknown>) {
    await fetch(`/api/companies/${cid}/activity`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    load()
  }
  async function genFollowup(c: Row) {
    setBusy(true)
    const res = await fetch(`/api/companies/${c.id}/followup`, { method: 'POST' })
    setBusy(false)
    if (res.ok) { const j = await res.json(); setFollowup({ company: c.name, ...j }) }
  }

  const today = new Date()
  const overdue = rows.filter(r => {
    const a = r.activity
    if (!a || a.replied || !a.last_touch_date) return false
    if (a.stage === '2-待发送' || a.stage === '3-草稿就绪') return false
    return (today.getTime() - new Date(a.last_touch_date).getTime()) / 86400000 >= 3
  })

  return (
    <>
      <ProjectNav id={id} active="board" />
      <div className="container">
        <h1>30 天追踪看板</h1>
        <p className="notice">首触/跟进由你人工发送后，回来这里更新阶段与日期。工具不代发。</p>
        <div className="card" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {STAGES.map(s => (
            <div key={s} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{rows.filter(r => r.activity?.stage === s).length}</div>
              <div className="muted" style={{ fontSize: 12 }}>{s}</div>
            </div>
          ))}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent2)' }}>{rows.filter(r => r.activity?.replied).length}</div>
            <div className="muted" style={{ fontSize: 12 }}>已回复（30天目标：3+ 实质对话）</div>
          </div>
        </div>
        {overdue.length > 0 && (
          <div className="card" style={{ borderColor: 'var(--danger)' }}>
            <h2 style={{ color: 'var(--danger)' }}>⚠ 超 3 天未跟进（{overdue.length}）</h2>
            {overdue.map(c => (
              <p key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>[{c.priority}] {c.name} · 最近触达 {c.activity?.last_touch_date}</span>
                <button className="btn secondary" disabled={busy} onClick={() => genFollowup(c)}>AI 跟进草稿</button>
              </p>
            ))}
          </div>
        )}
        {followup && (
          <div className="card" style={{ borderColor: 'var(--warn)' }}>
            <h2>跟进草稿 — {followup.company}
              <button className="btn secondary" style={{ float: 'right', padding: '2px 10px' }}
                onClick={() => { navigator.clipboard.writeText(`Subject: ${followup.subject}\n\n${followup.body}`) }}>复制</button>
            </h2>
            <p><strong>Subject:</strong> {followup.subject}</p>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{followup.body}</pre>
          </div>
        )}
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>公司</th><th>阶段</th><th>首触</th><th>最近触达</th><th>回复</th><th>下一步</th><th>下一步日期</th></tr></thead>
            <tbody>
              {rows.map(c => {
                const a = c.activity
                return (
                  <tr key={c.id}>
                    <td><strong>[{c.priority}] {c.name}</strong><div className="muted">{c.country}</div></td>
                    <td>
                      <select value={a?.stage ?? STAGES[0]} onChange={e => put(c.id, { stage: e.target.value })}>
                        {STAGES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td><input type="date" value={a?.first_touch_date ?? ''} onChange={e => put(c.id, { firstTouchDate: e.target.value || null })} style={{ width: 140 }} /></td>
                    <td><input type="date" value={a?.last_touch_date ?? ''} onChange={e => put(c.id, { lastTouchDate: e.target.value || null })} style={{ width: 140 }} /></td>
                    <td><input type="checkbox" checked={a?.replied ?? false} onChange={e => put(c.id, { replied: e.target.checked, ...(e.target.checked ? { stage: '6-已回复' } : {}) })} style={{ width: 'auto' }} /></td>
                    <td><input defaultValue={a?.next_action ?? ''} onBlur={e => put(c.id, { nextAction: e.target.value })} style={{ width: 160 }} /></td>
                    <td><input type="date" value={a?.next_action_date ?? ''} onChange={e => put(c.id, { nextActionDate: e.target.value || null })} style={{ width: 140 }} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
```

注意：`activity` API 返回的日期是 ISO 字符串（可能带时间），date input 需要 `YYYY-MM-DD`。实现时加工具函数 `const d = (s: string | null) => (s ? String(s).slice(0, 10) : '')` 并用于三个 date input 的 value。

- [ ] **Step 2: 构建 + 浏览器验证**

`npm run build`；浏览器：改阶段/日期即时保存；把一家公司的最近触达改成 4 天前 → 红区出现 → 点"AI 跟进草稿"得到英文跟进邮件可复制；勾"回复"后阶段自动变 `6-已回复`、漏斗数字刷新。

- [ ] **Step 3: 全量回归**

```powershell
npm test; npx tsc --noEmit; npm run build; npm run smoke
```

Expected: 全部通过 + SMOKE PASS。

- [ ] **Step 4: Commit**

```powershell
git add src/app/projects
git commit -m "feat: 30-day tracking board with funnel, overdue alerts, AI follow-up"
```

---

### Task 17: 部署到 bd.cxodex.com

**Files:**
- Create: `docs/deploy.md`（记录以下全部命令与配置，便于重部署）

**Interfaces:**
- Consumes: 完整可构建的仓库。
- Produces: 线上 https://bd.cxodex.com （香港 43.160.214.195，PM2 进程 `bd-app` 端口 3005）。

- [ ] **Step 1: 线上环境准备**

Cloudflare/DNS 处给 `bd.cxodex.com` 加 A 记录指向 `43.160.214.195`。Neon 建生产分支或复用库；准备生产 `JWT_SECRET`（32+ 随机字符）与 `GLM_API_KEY`。

- [ ] **Step 2: 上传与构建（服务器上）**

```bash
# 本地打包源码（排除 node_modules/.next），scp 或 git 推到服务器 /var/apps/bd-app
cd /var/apps/bd-app
cat > .env.local <<'EOF'
DATABASE_URL=<生产 Neon 连接串>
JWT_SECRET=<生产密钥>
GLM_API_KEY=<key>
GLM_MODEL=glm-4.6
EOF
npm ci
node scripts/migrate.mjs        # 需 export DATABASE_URL=... 或用 dotenv 方式
node scripts/seed-invite.mjs BD-LAUNCH 20
npm run build
pm2 start npm --name bd-app -- start
pm2 save
```

- [ ] **Step 3: Nginx server 块（参照 interview 的既有配置）**

```nginx
server {
    listen 443 ssl http2;
    server_name bd.cxodex.com;
    ssl_certificate     /etc/letsencrypt/live/bd.cxodex.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bd.cxodex.com/privkey.pem;
    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

`certbot --nginx -d bd.cxodex.com` 签证书；`nginx -t && systemctl reload nginx`。Cookie 需加 `Secure`：上线前把 Task 5 两处 `Set-Cookie` 追加 `; Secure`（或按 `NODE_ENV==='production'` 拼接）。

- [ ] **Step 4: 线上验收**

```bash
SMOKE_BASE=https://bd.cxodex.com SMOKE_INVITE=BD-LAUNCH node scripts/smoke.mjs
```

Expected: SMOKE PASS。浏览器完整走一遍：注册 → 向导 → AI 生成候选 → 画像 → 序列 → 看板 → 导出 Excel/Word。

- [ ] **Step 5: 收尾 Commit + 更新记忆**

```powershell
git add docs/deploy.md
git commit -m "docs: production deployment runbook for bd.cxodex.com"
```

并在用户记忆库新增 `cxodex-bd-app.md`（路径、Vercel/PM2、域名、邀请码机制），更新 MEMORY.md 索引。

---

## Self-Review 结果

- **Spec coverage**：营销首页(T12)、四步向导(T13)、目标客户库+AI生成+导入导出(T8/T10/T14)、决策人+画像(T9/T15)、冷邮件工坊+docx(T9/T10/T15)、看板+逾期提醒+AI跟进(T16)、邀请码多租户(T2/T5/T11)、租户隔离404(T4)、合规提示(T12/T15/T16 notice + docx/邮件模板退订行)、GLM 超时/重试/防抖(T7 timeout + 前端 busy 锁 + 错误可重试文案)、部署(T17)——设计文档各节均有对应任务。非目标清单未实现任何项，符合 YAGNI。
- **Placeholder scan**：无 TBD/TODO；所有代码步骤给出完整代码；部署密钥用 `<...>` 占位属运行时机密，非计划缺口。
- **Type consistency**：`COOKIE_NAME`/`requireUser`/`assertProjectOwner`/`assertCompanyOwner`/`errorResponse`/`glmChat`/`extractJson`/`parseCompanies`/`parseSequence`/`buildWorkbook`/`parseImport`/`buildSequenceDocx` 的签名在定义任务与消费任务一致；阶段/邮箱状态枚举全计划统一。
