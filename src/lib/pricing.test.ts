import { describe, it, expect } from 'vitest'
import { costCents, SURCHARGE, centsToYuan } from './pricing'

describe('pricing 计费口径', () => {
  it('手续系数为 1.25', () => {
    expect(SURCHARGE).toBe(1.25)
  })
  it('输入/输出分别计价，应收 = 成本 × 1.25', () => {
    const rate = { in: 0.08, out: 0.2 } // 分 / 1K tokens
    const { glm, billed } = costCents(rate, 1000, 1000)
    expect(glm).toBeCloseTo(0.28, 6) // 0.08 + 0.2
    expect(billed).toBeCloseTo(0.35, 6) // 0.28 × 1.25
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
