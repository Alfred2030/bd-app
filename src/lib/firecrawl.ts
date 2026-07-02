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
