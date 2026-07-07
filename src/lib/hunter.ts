// Hunter.io Domain Search：给公司域名，返回该公司的公开职业邮箱（含姓名/职位/可信度）。
// 合规的正规邮箱数据商，不爬 LinkedIn、不自动化任何账号。
export type HunterPerson = {
  firstName: string
  lastName: string
  position: string
  email: string
  confidence: number
  type: 'personal' | 'generic'
}

// 从 website 字段提取纯域名：去协议、去 www、去路径。
export function extractDomain(website: string): string {
  if (!website) return ''
  let d = website.trim().toLowerCase()
  d = d.replace(/^https?:\/\//, '').replace(/^www\./, '')
  d = d.split('/')[0].split('?')[0].split('#')[0]
  return d.includes('.') ? d : ''
}

export async function hunterDomainSearch(domain: string, limit = 10): Promise<HunterPerson[]> {
  const key = process.env.HUNTER_API_KEY
  if (!key) throw new Error('HUNTER_NOT_CONFIGURED')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20000)
  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=${limit}&api_key=${key}`
    const res = await fetch(url, { signal: ctrl.signal })
    const data = await res.json()
    if (!res.ok || data?.errors) {
      const msg = data?.errors?.[0]?.details || `Hunter ${res.status}`
      // 402/429 = 额度用尽/限流，向上层区分提示
      if (res.status === 402 || res.status === 429) throw new Error('HUNTER_QUOTA')
      throw new Error(msg)
    }
    const emails = Array.isArray(data?.data?.emails) ? data.data.emails : []
    return emails.map((e: Record<string, unknown>) => ({
      firstName: String(e.first_name ?? '').trim(),
      lastName: String(e.last_name ?? '').trim(),
      position: String(e.position ?? '').trim(),
      email: String(e.value ?? '').trim(),
      confidence: Number(e.confidence ?? 0),
      type: e.type === 'generic' ? 'generic' : 'personal',
    })).filter((p: HunterPerson) => p.email)
  } finally {
    clearTimeout(timer)
  }
}
