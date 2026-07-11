// LLM 计费口径：成本基准 0.0125 元/千（1.25 分/1K，存 model_rates 表）× 系数 2 = 应收 0.025 元/千。
// 金额单位统一为「分」。（2026-07-10 修正：此前基准误写 2.5 分/1K，应收被翻倍成 0.05 元/千。）
export const SURCHARGE = 2

// 单价：分 / 1000 tokens（输入、输出分开计价）。
export type Rate = { in: number; out: number }

// 给定单价与 tokens，算 GLM 成本与应收（含手续费），单位分、保留小数。
// surcharge 可按工具覆盖（默认全局 SURCHARGE=2）；如「竞争对手客户海关数据」用 3。
export function costCents(rate: Rate, promptTokens: number, completionTokens: number, surcharge: number = SURCHARGE): { glm: number; billed: number } {
  const pt = Number.isFinite(promptTokens) && promptTokens > 0 ? promptTokens : 0
  const ct = Number.isFinite(completionTokens) && completionTokens > 0 ? completionTokens : 0
  const s = Number.isFinite(surcharge) && surcharge > 0 ? surcharge : SURCHARGE
  const glm = (pt / 1000) * rate.in + (ct / 1000) * rate.out
  return { glm, billed: glm * s }
}

// 分 → 元（展示用），保留两位。
export function centsToYuan(cents: number): string {
  return (Number(cents) / 100).toFixed(2)
}
