import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase client so we can assert exactly how the channel is built.
const onCalls = []
const subscribeSpy = vi.fn()
const removeChannelSpy = vi.fn()

const fakeChannel = {
  on: vi.fn(function (type, opts, handler) {
    onCalls.push({ type, opts, handler })
    return fakeChannel // chainable, like supabase-js
  }),
  subscribe: vi.fn(function () {
    subscribeSpy()
    return fakeChannel
  }),
}

const channelSpy = vi.fn(() => fakeChannel)

vi.mock('./supabase', () => ({
  supabase: {
    channel: (...args) => channelSpy(...args),
    removeChannel: (...args) => removeChannelSpy(...args),
  },
}))

import { subscribeToTables } from './realtime'

beforeEach(() => {
  onCalls.length = 0
  channelSpy.mockClear()
  subscribeSpy.mockClear()
  removeChannelSpy.mockClear()
  fakeChannel.on.mockClear()
  fakeChannel.subscribe.mockClear()
})

describe('subscribeToTables', () => {
  it('opens a channel with the given name and subscribes once', () => {
    subscribeToTables('match-42', [{ table: 'matches', handler: () => {} }])
    expect(channelSpy).toHaveBeenCalledWith('match-42')
    expect(subscribeSpy).toHaveBeenCalledTimes(1)
  })

  it('registers one postgres_changes listener per subscription', () => {
    const a = () => {}
    const b = () => {}
    subscribeToTables('feed', [
      { table: 'matches', handler: a },
      { table: 'hole_results', handler: b },
    ])
    expect(onCalls).toHaveLength(2)
    expect(onCalls[0].type).toBe('postgres_changes')
    expect(onCalls[0].handler).toBe(a)
    expect(onCalls[1].handler).toBe(b)
  })

  it('defaults event to * and schema to public, omitting filter', () => {
    subscribeToTables('feed', [{ table: 'matches', handler: () => {} }])
    expect(onCalls[0].opts).toEqual({ event: '*', schema: 'public', table: 'matches' })
    expect('filter' in onCalls[0].opts).toBe(false)
  })

  it('includes filter and honours an explicit event when provided', () => {
    subscribeToTables('match-7', [
      { table: 'hole_results', event: 'INSERT', filter: 'match_id=eq.7', handler: () => {} },
    ])
    expect(onCalls[0].opts).toEqual({
      event: 'INSERT',
      schema: 'public',
      table: 'hole_results',
      filter: 'match_id=eq.7',
    })
  })

  it('allows overriding the schema', () => {
    subscribeToTables('c', [{ table: 't', schema: 'analytics', handler: () => {} }])
    expect(onCalls[0].opts.schema).toBe('analytics')
  })

  it('skips malformed subscriptions (no table or no handler)', () => {
    subscribeToTables('c', [
      null,
      { table: 'ok', handler: () => {} },
      { table: 'no-handler' },
      { handler: () => {} },
    ])
    expect(onCalls).toHaveLength(1)
    expect(onCalls[0].opts.table).toBe('ok')
  })

  it('returns a teardown that removes the channel', () => {
    const teardown = subscribeToTables('c', [{ table: 't', handler: () => {} }])
    expect(removeChannelSpy).not.toHaveBeenCalled()
    teardown()
    expect(removeChannelSpy).toHaveBeenCalledTimes(1)
    expect(removeChannelSpy).toHaveBeenCalledWith(fakeChannel)
  })

  it('teardown is idempotent — removeChannel runs at most once', () => {
    const teardown = subscribeToTables('c', [{ table: 't', handler: () => {} }])
    teardown()
    teardown()
    teardown()
    expect(removeChannelSpy).toHaveBeenCalledTimes(1)
  })

  it('handles an empty subscription list (channel still opens/subscribes)', () => {
    const teardown = subscribeToTables('c', [])
    expect(onCalls).toHaveLength(0)
    expect(subscribeSpy).toHaveBeenCalledTimes(1)
    expect(() => teardown()).not.toThrow()
  })
})
