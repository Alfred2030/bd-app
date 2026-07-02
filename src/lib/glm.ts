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
