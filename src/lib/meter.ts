import { sql } from './db'
import { costCents, SURCHARGE, type Rate } from './pricing'

// 预付费余额耗尽（≤0）且该用户计量开启时抛出；上层（tenant.errorResponse）映射为 402「余额不足，请充值」。
// 这是「自动停止开关」的落点：闸门在每次 GLM 调用之前拦截，不产生新费用。
export class QuotaExceededError extends Error {}

export type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
// surcharge：该次计费的手续系数，按工具覆盖（默认全局 SURCHARGE=2）；「竞争对手客户海关数据」用 3。
export type MeterCtx = { uid: number; tool: string; surcharge?: number }

// model_rates 进程级缓存（5 分钟）。改价后最多 5 分钟生效，或重启 pm2 立即生效。
let rateCache: { at: number; map: Map<string, Rate> } | null = null
async function getRates(): Promise<Map<string, Rate>> {
  if (rateCache && Date.now() - rateCache.at < 300_000) return rateCache.map
  const rows = await sql`SELECT model, in_per_1k, out_per_1k FROM model_rates`
  const map = new Map<string, Rate>()
  for (const r of rows) map.set(String(r.model), { in: Number(r.in_per_1k), out: Number(r.out_per_1k) })
  rateCache = { at: Date.now(), map }
  return map
}
async function rateFor(model: string): Promise<Rate> {
  const m = await getRates()
  return m.get(model) || m.get('default') || { in: 1.25, out: 1.25 } // 兜底=统一成本基准 1.25 分/1K
}

// 前置额度闸门：计量开启且余额 ≤ 0 → 拒绝调用（自动停止）。用户不存在则放行（老账号未初始化余额=0 会被拦，
// 故新老账号统一：余额 0 即停。管理员先充值再用。）
export async function assertBalance(ctx: MeterCtx): Promise<void> {
  const rows = await sql`SELECT balance_cents, metering_enabled FROM users WHERE id = ${ctx.uid}`
  if (rows.length === 0) return
  const enabled = rows[0].metering_enabled as boolean
  const bal = Number(rows[0].balance_cents)
  if (enabled && bal <= 0) throw new QuotaExceededError('余额不足，AI 功能已暂停')
}

// 后置扣费记账：算成本×2 → 原子扣余额 → 写用量流水 + 余额流水。
// 计量失败绝不阻断主流程（用户已拿到 AI 结果），仅记日志供事后对账。
export async function recordUsage(ctx: MeterCtx, model: string, usage: Usage): Promise<void> {
  try {
    const pt = Math.max(0, Math.round(usage.prompt_tokens || 0))
    const ct = Math.max(0, Math.round(usage.completion_tokens || 0))
    if (pt === 0 && ct === 0) return // 没有可计费用量（异常响应等），跳过
    const rate = await rateFor(model)
    const { glm, billed } = costCents(rate, pt, ct, ctx.surcharge ?? SURCHARGE)
    // 计量关闭的账户只记用量(billed=0)、不扣费
    const urows = await sql`SELECT metering_enabled FROM users WHERE id = ${ctx.uid}`
    const enabled = urows.length === 0 ? true : (urows[0].metering_enabled as boolean)
    const ins = await sql`
      INSERT INTO llm_usage (user_id, tool, model, prompt_tokens, completion_tokens, glm_cost_cents, billed_cents)
      VALUES (${ctx.uid}, ${ctx.tool}, ${model}, ${pt}, ${ct}, ${glm}, ${enabled ? billed : 0})
      RETURNING id`
    if (enabled) {
      const upd = await sql`
        UPDATE users SET balance_cents = balance_cents - ${billed} WHERE id = ${ctx.uid}
        RETURNING balance_cents`
      const after = upd.length ? Number(upd[0].balance_cents) : 0
      await sql`
        INSERT INTO balance_txns (user_id, delta_cents, reason, ref, balance_after)
        VALUES (${ctx.uid}, ${-billed}, 'usage', ${'llm_usage#' + ins[0].id}, ${after})`
    }
  } catch (e) {
    console.error('meter recordUsage failed (non-blocking):', e)
  }
}

// 固定成本计费（非 token 类，如外部海关数据抓取）：把该次外部数据获取成本(分)按同一系数计费并扣余额，
// 写入同一 llm_usage/balance_txns 流水（tool 区分、model 记来源标签）。同样非阻断。
export async function recordDataCost(ctx: MeterCtx, item: string, dataCents: number): Promise<void> {
  try {
    const cost = Number.isFinite(dataCents) && dataCents > 0 ? dataCents : 0
    if (cost === 0) return
    const billed = cost * (ctx.surcharge ?? SURCHARGE)
    const urows = await sql`SELECT metering_enabled FROM users WHERE id = ${ctx.uid}`
    const enabled = urows.length === 0 ? true : (urows[0].metering_enabled as boolean)
    const ins = await sql`
      INSERT INTO llm_usage (user_id, tool, model, prompt_tokens, completion_tokens, glm_cost_cents, billed_cents)
      VALUES (${ctx.uid}, ${ctx.tool}, ${item}, 0, 0, ${cost}, ${enabled ? billed : 0})
      RETURNING id`
    if (enabled) {
      const upd = await sql`
        UPDATE users SET balance_cents = balance_cents - ${billed} WHERE id = ${ctx.uid}
        RETURNING balance_cents`
      const after = upd.length ? Number(upd[0].balance_cents) : 0
      await sql`
        INSERT INTO balance_txns (user_id, delta_cents, reason, ref, balance_after)
        VALUES (${ctx.uid}, ${-billed}, 'usage', ${'llm_usage#' + ins[0].id}, ${after})`
    }
  } catch (e) {
    console.error('meter recordDataCost failed (non-blocking):', e)
  }
}
