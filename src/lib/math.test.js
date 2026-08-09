import { describe, it, expect } from 'vitest'
import { clamp } from './math'

describe('clamp', () => {
  it('returns the value when already inside the range', () => {
    expect(clamp(3, 1, 4)).toBe(3)
    expect(clamp(2.5, 0, 5)).toBe(2.5)
  })

  it('clamps to the lower bound', () => {
    expect(clamp(0, 1, 4)).toBe(1)
    expect(clamp(-10, 0.1, 5)).toBe(0.1)
  })

  it('clamps to the upper bound', () => {
    expect(clamp(9, 1, 4)).toBe(4)
    expect(clamp(20, 3, 6)).toBe(6)
  })

  it('returns the bounds when the value equals them', () => {
    expect(clamp(1, 1, 4)).toBe(1)
    expect(clamp(4, 1, 4)).toBe(4)
  })

  it('matches the Math.max(min, Math.min(max, value)) idiom it replaces', () => {
    const cases = [
      [3 + 1, 3, 6],
      [-5, 0, 18],
      [8 | 0, 1, 4],
      [0, 0.1, 5],
      [4 + 1, 3, 5],
    ]
    for (const [v, lo, hi] of cases) {
      expect(clamp(v, lo, hi)).toBe(Math.max(lo, Math.min(hi, v)))
    }
  })

  it('propagates NaN like the raw idiom', () => {
    expect(Number.isNaN(clamp(NaN, 1, 4))).toBe(true)
  })
})
