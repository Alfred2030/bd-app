export type SearchResult = { title: string; description: string; url: string }

export async function firecrawlSearch(query: string, limit = 5): Promise<SearchResult[]> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 30000)
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({ query, limit }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`Firecrawl ${res.status}: ${await res.text()}`)
    const data = await res.json()
    const items = Array.isArray(data?.data) ? data.data : []
    return items
      .map((r: Record<string, unknown>) => ({
        title: String(r.title ?? ''),
        description: String(r.description ?? ''),
        url: String(r.url ?? ''),
      }))
      .filter((r: SearchResult) => r.url)
  } finally {
    clearTimeout(timer)
  }
}

// 渲染并抓取单个页面为 markdown（用于「竞争对手客户海关数据」抓取海关公开记录页）。
// waitFor 给前端 JS 渲染时间；失败抛错由上层处理。返回纯 markdown（可能为空串）。
export async function firecrawlScrape(url: string, waitFor = 6000): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 60000)
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true, waitFor }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`Firecrawl ${res.status}: ${await res.text().catch(() => '')}`)
    const data = await res.json()
    const md = data?.data?.markdown
    return typeof md === 'string' ? md : ''
  } finally {
    clearTimeout(timer)
  }
}
