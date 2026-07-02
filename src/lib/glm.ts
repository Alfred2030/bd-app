type Msg = { role: 'system' | 'user'; content: string }

export async function glmChat(messages: Msg[], opts: { timeoutMs?: number } = {}): Promise<string> {
  const ctrl = new AbortController()
  // GLM-5.2 推理模型单次生成可达 3 分钟+，默认放宽到 5 分钟
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 300000)
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
  for (const open of ['[', '{'] as const) {
    const start = raw.indexOf(open)
    if (start < 0) continue
    const close = open === '[' ? ']' : '}'
    const end = raw.lastIndexOf(close)
    if (end <= start) continue
    try { return JSON.parse(raw.slice(start, end + 1)) } catch { /* try next */ }
  }
  throw new Error('响应中未找到 JSON')
}
