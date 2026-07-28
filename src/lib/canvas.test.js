import { describe, it, expect } from 'vitest'
import { fitText, roundRect } from './canvas'

// A minimal Canvas 2D stub: text width is 10px per character, which is enough
// to exercise the measure-and-trim loop without a real rendering context.
function makeCtx() {
  const calls = []
  return {
    calls,
    measureText: (s) => ({ width: s.length * 10 }),
    beginPath: () => calls.push(['beginPath']),
    moveTo: (...a) => calls.push(['moveTo', ...a]),
    arcTo: (...a) => calls.push(['arcTo', ...a]),
    closePath: () => calls.push(['closePath']),
  }
}

describe('fitText', () => {
  it('returns the text unchanged when it already fits', () => {
    const ctx = makeCtx()
    expect(fitText(ctx, 'Ada', 100)).toBe('Ada')
  })

  it('truncates and appends an ellipsis when the text is too wide', () => {
    const ctx = makeCtx()
    // maxWidth 55 fits 5 chars ('Ada L' = 50) plus the ellipsis (60 > 55 fails),
    // so it trims down until 'Ada…' (40) fits.
    const out = fitText(ctx, 'Ada Lovelace', 55)
    expect(out.endsWith('…')).toBe(true)
    expect(ctx.measureText(out).width).toBeLessThanOrEqual(55)
  })

  it('never trims below a single character before the ellipsis', () => {
    const ctx = makeCtx()
    expect(fitText(ctx, 'Ada', 1)).toBe('A…')
  })
})

describe('roundRect', () => {
  it('traces a closed path clamped to half the shorter side', () => {
    const ctx = makeCtx()
    roundRect(ctx, 0, 0, 20, 10, 999)
    const arcs = ctx.calls.filter((c) => c[0] === 'arcTo')
    // radius is clamped to min(999, 20/2, 10/2) = 5
    expect(arcs).toHaveLength(4)
    expect(ctx.calls[0]).toEqual(['beginPath'])
    expect(ctx.calls.at(-1)).toEqual(['closePath'])
    expect(ctx.calls[1]).toEqual(['moveTo', 5, 0])
  })
})
