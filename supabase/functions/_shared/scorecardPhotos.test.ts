import { describe, it, expect, vi } from 'vitest'
import { deleteScorecardPhotos, sweepScorecardPhotos, safeEqual } from './scorecardPhotos.ts'

// Minimaler Fake des supabase-js-Clients: Storage-Objekte als Set,
// scorecard_uploads-Updates werden protokolliert.
function fakeSvc({
  objects = [],
  removeError = null,
  removeThrows = false,
  removeKeeps = [],
  existingError = null,
  candidatesError = null,
  ages = {},
} = {}) {
  const store = new Set(objects)
  const updates = []
  const removeCalls = []
  const candidateCalls = []
  const svc = {
    storage: {
      from: () => ({
        remove: async (paths) => {
          removeCalls.push(paths)
          if (removeThrows) throw new Error('network down')
          for (const p of paths) if (!removeKeeps.includes(p)) store.delete(p)
          return { data: null, error: removeError }
        },
      }),
    },
    rpc: async (fn, args) => {
      if (fn === 'scorecard_photos_existing') {
        if (existingError) return { data: null, error: existingError }
        return { data: args.p_paths.filter((p) => store.has(p)), error: null }
      }
      if (fn === 'scorecard_photo_sweep_candidates') {
        candidateCalls.push(args)
        if (candidatesError) return { data: null, error: candidatesError }
        const names = [...store]
          .filter((n) => (ages[n] ?? 48) >= 24)
          .sort()
          .filter((n) => n > (args.p_after || ''))
          .slice(0, args.p_limit)
        return { data: names, error: null }
      }
      if (fn === 'scorecard_photo_reconcile') return { data: 2, error: null }
      throw new Error('unexpected rpc ' + fn)
    },
    from: (table) => {
      const q = { table, values: null, filters: [] }
      const chain = {
        update(values) { q.values = values; return chain },
        in(col, vals) { q.filters.push(['in', col, vals]); return chain },
        is(col, val) {
          q.filters.push(['is', col, val])
          updates.push(q)
          return Promise.resolve({ error: null })
        },
      }
      return chain
    },
  }
  return { svc, store, updates, removeCalls, candidateCalls }
}

describe('deleteScorecardPhotos', () => {
  it('marks a photo deleted only after confirming it is gone', async () => {
    const f = fakeSvc({ objects: ['m1/a.jpg'] })
    const log = vi.fn()
    const out = await deleteScorecardPhotos(f.svc, ['m1/a.jpg'], log)
    expect(out).toEqual({ deleted: ['m1/a.jpg'], failed: [], error: null })
    expect(f.updates).toHaveLength(1)
    expect(f.updates[0].values.photo_deleted_at).toEqual(expect.any(String))
    expect(f.updates[0].values.photo_delete_error).toBeNull()
    expect(f.updates[0].filters).toContainEqual(['in', 'storage_path', ['m1/a.jpg']])
    expect(log).not.toHaveBeenCalled()
  })

  it('does not swallow a resolved { error } from storage.remove', async () => {
    const f = fakeSvc({ objects: ['m1/a.jpg'], removeError: { message: 'permission denied' }, removeKeeps: ['m1/a.jpg'] })
    const log = vi.fn()
    const out = await deleteScorecardPhotos(f.svc, ['m1/a.jpg'], log)
    expect(out.deleted).toEqual([])
    expect(out.failed).toEqual(['m1/a.jpg'])
    expect(out.error).toBe('remove:permission denied')
    expect(log).toHaveBeenCalledWith(expect.stringContaining('DELETE FAILED'), ['m1/a.jpg'])
    // kein photo_deleted_at, aber Fehlergrund festgehalten
    expect(f.updates).toHaveLength(1)
    expect(f.updates[0].values).toEqual({ photo_delete_error: 'remove:permission denied' })
  })

  it('treats a thrown remove() as failure', async () => {
    const f = fakeSvc({ objects: ['m1/a.jpg'], removeThrows: true })
    const out = await deleteScorecardPhotos(f.svc, ['m1/a.jpg'], vi.fn())
    expect(out.failed).toEqual(['m1/a.jpg'])
    expect(out.error).toBe('remove:network down')
  })

  it('reports an object that survived a "successful" remove', async () => {
    const f = fakeSvc({ objects: ['m1/a.jpg'], removeKeeps: ['m1/a.jpg'] })
    const out = await deleteScorecardPhotos(f.svc, ['m1/a.jpg'], vi.fn())
    expect(out.failed).toEqual(['m1/a.jpg'])
    expect(out.error).toBe('remove:object_still_present')
  })

  it('never marks deleted when the deletion cannot be verified', async () => {
    const f = fakeSvc({ objects: ['m1/a.jpg'], existingError: { message: 'rpc down' } })
    const out = await deleteScorecardPhotos(f.svc, ['m1/a.jpg'], vi.fn())
    expect(out.deleted).toEqual([])
    expect(out.error).toBe('verify:rpc down')
    expect(f.updates.every((u) => !('photo_deleted_at' in u.values))).toBe(true)
  })

  it('does nothing for an empty list', async () => {
    const f = fakeSvc()
    const out = await deleteScorecardPhotos(f.svc, [], vi.fn())
    expect(out).toEqual({ deleted: [], failed: [], error: null })
    expect(f.removeCalls).toHaveLength(0)
  })
})

describe('sweepScorecardPhotos', () => {
  it('pages through all candidates instead of stopping at one page', async () => {
    const objects = Array.from({ length: 23 }, (_, i) => `m${String(i).padStart(2, '0')}/x.jpg`)
    const f = fakeSvc({ objects })
    const res = await sweepScorecardPhotos(f.svc, { batchSize: 5, log: vi.fn() })
    expect(res.deleted).toBe(23)
    expect(res.failed).toBe(0)
    expect(res.complete).toBe(true)
    expect(res.reconciled).toBe(2)
    expect(f.store.size).toBe(0)
  })

  it('leaves young photos alone', async () => {
    const f = fakeSvc({ objects: ['m1/old.jpg', 'm1/new.jpg'], ages: { 'm1/new.jpg': 1 } })
    await sweepScorecardPhotos(f.svc, { log: vi.fn() })
    expect([...f.store]).toEqual(['m1/new.jpg'])
  })

  it('moves past objects that keep failing (keyset) and reports them', async () => {
    const objects = ['a/1.jpg', 'a/2.jpg', 'a/3.jpg', 'a/4.jpg']
    const f = fakeSvc({ objects, removeKeeps: ['a/1.jpg', 'a/2.jpg'] })
    const res = await sweepScorecardPhotos(f.svc, { batchSize: 2, log: vi.fn() })
    expect(res.deleted).toBe(2)
    expect(res.failed).toBe(2)
    expect(res.complete).toBe(false)
    expect(f.candidateCalls.map((c) => c.p_after)).toEqual([null, 'a/2.jpg', 'a/4.jpg'])
  })

  it('stops with an error when candidates cannot be listed', async () => {
    const f = fakeSvc({ objects: ['a/1.jpg'], candidatesError: { message: 'boom' } })
    const res = await sweepScorecardPhotos(f.svc, { log: vi.fn() })
    expect(res.error).toBe('candidates:boom')
    expect(res.complete).toBe(false)
    expect(f.removeCalls).toHaveLength(0)
  })

  it('respects the time budget', async () => {
    const f = fakeSvc({ objects: ['a/1.jpg'] })
    const res = await sweepScorecardPhotos(f.svc, { deadline: Date.now() - 1, log: vi.fn() })
    expect(res.batches).toBe(0)
    expect(res.complete).toBe(false)
  })
})

describe('safeEqual', () => {
  it('compares secrets', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
    expect(safeEqual('', '')).toBe(false)
  })
})
