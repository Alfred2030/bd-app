import { describe, it, expect } from 'vitest'
import { costCents, SURCHARGE, centsToYuan } from './pricing'

describe('pricing 计费口径', () => {
  it('手续系数为 2', () => {
    expect(SURCHARGE).toBe(2)
  })
  it('输入/输出分别计价，应收 = 成本 × 2', () => {
    const rate = { in: 2.5, out: 2.5 } // 分 / 1K tokens（统一单价 0.025 元/千）
    const { glm, billed } = costCents(rate, 1000, 1000)
    expect(glm).toBeCloseTo(5, 6) // 2.5 + 2.5
    expect(billed).toBeCloseTo(10, 6) // 5 × 2
  })
  it('部分 token 按比例', () => {
    const { glm } = costCents({ in: 0.1, out: 0.3 }, 500, 2000)
    expect(glm).toBeCloseTo(0.05 + 0.6, 6)
  })
  it('0 或非法 token → 0', () => {
    expect(costCents({ in: 1, out: 1 }, 0, 0).billed).toBe(0)
    expect(costCents({ in: 1, out: 1 }, -5, NaN).billed).toBe(0)
  })
  it('分转元展示', () => {
    expect(centsToYuan(29900)).toBe('299.00')
    expect(centsToYuan(35)).toBe('0.35')
  })
})
