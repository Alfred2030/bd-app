// LLM 计费口径：应收 = GLM 实际成本 × 2（与统一单价 0.025 元/千tokens 配套）。金额单位统一为「分」。
export const SURCHARGE = 2

// 单价：分 / 1000 tokens（输入、输出分开计价）。
export type Rate = { in: number; out: number }

// 给定单价与 tokens，算 GLM 成本与应收（含手续费），单位分、保留小数。
export function costCents(rate: Rate, promptTokens: number, completionTokens: number): { glm: number; billed: number } {
  const pt = Number.isFinite(promptTokens) && promptTokens > 0 ? promptTokens : 0
  const ct = Number.isFinite(completionTokens) && completionTokens > 0 ? completionTokens : 0
  const glm = (pt / 1000) * rate.in + (ct / 1000) * rate.out
  return { glm, billed: glm * SURCHARGE }
}

// 分 → 元（展示用），保留两位。
export function centsToYuan(cents: number): string {
  return (Number(cents) / 100).toFixed(2)
}
