import { sql } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { assertCompanyOwner, errorResponse } from '@/lib/tenant'
import { hunterDomainSearch, extractDomain, type HunterPerson } from '@/lib/hunter'
import { companyKey } from '@/lib/ai'

// Hunter 可信度 → 邮箱四态：通用邮箱(info@/contact@)→catchall；具名邮箱按可信度分档。
function emailStatus(p: HunterPerson): string {
  if (p.type === 'generic') return 'catchall'
  if (p.confidence >= 90) return 'verified'
  if (p.confidence >= 50) return 'inferred'
  return 'invalid'
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireUser()
    const cid = Number((await ctx.params).id)
    await assertCompanyOwner(cid, u.uid)
    if (!process.env.HUNTER_API_KEY) return Response.json({ error: '邮箱查找服务未配置' }, { status: 500 })

    const [company] = await sql`SELECT name, website FROM companies WHERE id = ${cid}`
    const domain = extractDomain(company.website as string)
    if (!domain) return Response.json({ error: '该公司缺少官网域名，请先在目标客户库补全官网' }, { status: 400 })

    let people: HunterPerson[]
    try {
      people = await hunterDomainSearch(domain, 10)
    } catch (e) {
      if (e instanceof Error && e.message === 'HUNTER_QUOTA')
        return Response.json({ error: 'Hunter 本月免费额度已用尽，请稍后或升级套餐' }, { status: 402 })
      return Response.json({ error: '邮箱查找失败，可重试' }, { status: 502 })
    }

    // 已有联系人去重：按姓名归一化 + 邮箱
    const existing = await sql`SELECT lower(name) AS n, lower(email) AS e FROM contacts WHERE company_id = ${cid}`
    const haveName = new Set(existing.map(r => companyKey(String(r.n ?? ''))))
    const haveEmail = new Set(existing.map(r => String(r.e ?? '')).filter(Boolean))

    let inserted = 0
    let generic = 0
    for (const p of people) {
      const name = `${p.firstName} ${p.lastName}`.trim()
      const emailLc = p.email.toLowerCase()
      if (haveEmail.has(emailLc)) continue
      if (name && haveName.has(companyKey(name))) continue
      // 通用邮箱（无姓名）也录入但计数提示，标 catchall
      if (!name) generic++
      haveEmail.add(emailLc)
      if (name) haveName.add(companyKey(name))
      await sql`
        INSERT INTO contacts (company_id, name, title, linkedin_url, email, email_status, preferred_channel, notes)
        VALUES (${cid}, ${name || '(通用邮箱)'}, ${p.position}, '', ${p.email}, ${emailStatus(p)}, 'email',
          ${'Hunter 查得，可信度 ' + p.confidence})`
      inserted++
    }
    return Response.json({ inserted, found: people.length, generic })
  } catch (e) { return errorResponse(e) }
}
