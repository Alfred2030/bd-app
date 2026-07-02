# CXODEX 国际市场开拓工作台

竞品信号法（Competitor-Signal BD）出海业务开发工作台。基于 Next.js 15 + Neon (Postgres) + GLM（智谱 AI）构建：从目标市场/竞品切入，AI 辅助生成候选经销商、决策人画像、冷邮件序列与跟进草稿，并提供 30 天追踪看板与 Excel/Word 导出。

**铁律：工具只生成内容，不代发任何邮件/消息。** 所有邮件、LinkedIn 文案均需人工复制后自行发送。

## 技术栈

- Next.js 15（App Router）+ React 19 + TypeScript
- Neon Serverless Postgres（`@neondatabase/serverless`）
- GLM（智谱 AI）用于候选生成、文案与画像
- zod 校验、jose 签发会话 JWT、bcryptjs 密码哈希
- Vitest 单测

## 环境准备

```bash
npm i
```

复制 `.env.example` 为 `.env.local` 并填入：

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | Neon Postgres 连接串（含 `sslmode=require`） |
| `JWT_SECRET` | 会话签名密钥，至少 32 位随机字符串 |
| `GLM_API_KEY` | 智谱 GLM API Key |
| `GLM_MODEL` | 使用的 GLM 模型名，如 `glm-4.6` |

初始化数据库结构：

```bash
npm run migrate
```

生成一个邀请码（注册需要邀请码）：

```bash
node scripts/seed-invite.mjs <CODE> <uses>
```

## 本地开发

```bash
npm run dev
```

默认监听端口 **3005**（见 `package.json` 的 `dev`/`start` 脚本）。

## 测试

单元测试：

```bash
npm test
```

端到端冒烟测试（注册 → 建项目 → 生成候选 → 联系人 → 追踪 → 导出 → 删除项目）：

```bash
SMOKE_BASE=http://localhost:3005 SMOKE_INVITE=<邀请码> npm run smoke
```

`SMOKE_BASE` 默认为 `http://localhost:3005`；`SMOKE_INVITE` 默认为 `DEV-TEST`。

## 生产构建

```bash
npm run build
npm start
```
