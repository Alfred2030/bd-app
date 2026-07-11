import { neon } from '@neondatabase/serverless'

// 统一计费台：bd-app 的 /admin 同时连三个 Neon 库，一处管全部工具的余额充值。
// 占位串仅防构建期崩（此时 env 未注入）；运行时用真实 env。
const PLACEHOLDER = 'postgresql://placeholder:placeholder@localhost/placeholder'
export const bdSql = neon(process.env.DATABASE_URL || PLACEHOLDER) // 外贸(users) + 法律(legal_accounts)
export const ivwSql = neon(process.env.INTERVIEW_DATABASE_URL || process.env.DATABASE_URL || PLACEHOLDER) // 面试(companies)
export const funikSql = neon(process.env.FUNIK_DATABASE_URL || process.env.DATABASE_URL || PLACEHOLDER) // 排产(companies)+财务(finance_accounts)
