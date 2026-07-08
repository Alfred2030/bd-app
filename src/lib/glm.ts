import { assertBalance, recordUsage, type MeterCtx, type Usage } from './meter'

type Msg = { role: 'system' | 'user'; content: string }

// GLM 达到账户速率限制（429 / code 1302）时抛出，供上层返回「AI 繁忙请重试」而非「服务器错误」。
export class GlmRateLimitError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
// 退避：3s / 8s / 15s（+抖动），429 立即返回故重试成本低
const backoffMs = (attempt: number) => [3000, 8000, 15000][attempt] + Math.floor(Math.random() * 1500)

type Once = { ok: true; content: string; usage: Usage } | { ok: false; status: number; body: string }

async function callOnce(model: string, messages: Msg[], timeoutMs: number): Promise<Once> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GLM_API_KEY}` },
      body: JSON.stringify({ model, messages, temperature: 0.6 }),
      signal: ctrl.signal,
    })
    if (!res.ok) return { ok: false, status: res.status, body: await res.text().catch(() => '') }
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string') throw new Error('GLM 返回格式异常')
    return { ok: true, content, usage: (data?.usage ?? {}) as Usage }
  } finally {
    clearTimeout(timer)
  }
}

// 主模型（GLM-5.2/4.6 推理）用于创意任务（冷邮件文案）；快模型（air）用于结构化任务。
// 429（账户限流）/ 5xx / 网络超时会自动退避重试；共 4 次尝试。多标签同时点生成最易触发限流。
export async function glmChat(messages: Msg[], opts: { timeoutMs?: number; fast?: boolean; model?: string; meter?: MeterCtx } = {}): Promise<string> {
  const model = opts.model
    || (opts.fast ? (process.env.GLM_FAST_MODEL || 'glm-4-air') : (process.env.GLM_MODEL || 'glm-4.6'))
  const timeoutMs = opts.timeoutMs ?? 300000
  const maxAttempts = 4
  // 前置额度闸门（自动停止）：余额 ≤ 0 抛 QuotaExceededError，不发起任何 GLM 调用。
  if (opts.meter) await assertBalance(opts.meter)
  let last: Error | null = null
  for (let i = 0; i < maxAttempts; i++) {
    let r: Once | null = null
    try { r = await callOnce(model, messages, timeoutMs) }
    catch (e) { last = e as Error }               // fetch abort / 网络 / 格式异常
    if (r && r.ok) {
      // 后置扣费记账（非阻断）：按真实 usage 计费并扣余额。
      if (opts.meter) await recordUsage(opts.meter, model, r.usage)
      return r.content
    }
    const status = r ? r.status : null
    if (r && !r.ok) last = new Error(`GLM API ${status}: ${r.body}`)
    const retryable = r === null || status === 429 || (status != null && status >= 500)
    if (retryable && i < maxAttempts - 1) { await sleep(backoffMs(i)); continue }
    if (status === 429) throw new GlmRateLimitError(`GLM API 429: ${r?.body ?? ''}`)
    throw last ?? new Error('GLM 调用失败')
  }
  throw last ?? new Error('GLM 调用失败')
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
