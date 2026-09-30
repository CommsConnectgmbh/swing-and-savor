import { describe, it, expect } from 'vitest'
import { otherUserId } from './pairs'

describe('otherUserId', () => {
  it('returns user_b when I am user_a', () => {
    expect(otherUserId({ user_a: 'me', user_b: 'you' }, 'me')).toBe('you')
  })

  it('returns user_a when I am user_b', () => {
    expect(otherUserId({ user_a: 'you', user_b: 'me' }, 'me')).toBe('you')
  })

  it('falls back to user_a when I match neither side (legacy behaviour)', () => {
    expect(otherUserId({ user_a: 'a', user_b: 'b' }, 'stranger')).toBe('a')
  })
})
