import { describe, expect, it } from 'vitest'
import { handle, type Kv } from '../../api/timetable'
import { buildDemoColleges } from '../demoData'
import { solve } from '../solver/solve'
import { fetchLiveDept, fetchLiveIndex, liveUrl, livePayload, publishKeyOf, pushLive, removeLive, withPublishKey } from './liveLinks'
import { publish, setDraft, unpublish } from './publish'
import { buildGrid } from './gridModel'
import { snapshotCollege } from './publicView'
import type { CollegeData } from '../types'

const [diet] = buildDemoColleges()
const pub = (c: CollegeData, seed = 1, at = '2026-10-27T10:00:00.000Z') => {
  const r = publish(setDraft(c, solve(c, { seed })), at)
  if (!r.ok) throw new Error(r.reasons.join())
  return r.college
}

/** In-memory stand-in for the Redis store. */
const memoryKv = (): Kv & { data: Map<string, string> } => {
  const data = new Map<string, string>()
  return { data, get: async (k) => data.get(k) ?? null, set: async (k, v) => void data.set(k, v), del: async (ks) => ks.forEach((k) => data.delete(k)) }
}

/** A fetch that talks to `handle` with the in-memory store, like the deployed function. */
const fakeFetch = (kv: Kv): typeof fetch =>
  (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'https://kaalchakra.test')
    const method = init?.method ?? 'GET'
    const r = await handle(kv, method, url, init?.body ? JSON.parse(String(init.body)) : undefined)
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch

describe('T9.10 live department links', () => {
  it('publish stores every department; the same link then reads the latest version', async () => {
    const kv = memoryKv()
    const f = fakeFetch(kv)
    const v1 = pub(diet)
    expect(await pushLive(v1, f)).toEqual({ ok: true })
    const s1 = await fetchLiveDept('diet', 'cse', f)
    expect(s1?.data.published.version).toBe(1)
    const index = await fetchLiveIndex('diet', f)
    expect(index?.depts.map((d) => d.key)).toEqual(['cse', 'ece', 'me'])
    expect(index?.version).toBe(1)

    // a new version through the same address
    const r = publish(setDraft(v1, solve(v1, { seed: 7 })), '2026-10-28T09:00:00.000Z')
    if (!r.ok) throw new Error(r.reasons.join())
    expect(await pushLive(r.college, f)).toEqual({ ok: true })
    const s2 = (await fetchLiveDept('diet', 'cse', f))!
    expect(s2.data.published).toMatchObject({ version: 2, at: '2026-10-28T09:00:00.000Z' })
    const copy = snapshotCollege(s2)
    const sec = r.college.sections.find((x) => x.deptId === 'diet-cse')!.id
    expect(buildGrid(copy, copy.published!.timetable, 'section', sec).cells.map((c) => c.key)).toEqual(
      buildGrid(r.college, r.college.published!.timetable, 'section', sec).cells.map((c) => c.key),
    )
    expect(liveUrl('https://kaalchakra-seven.vercel.app/', r.college, r.college.departments[0])).toBe('https://kaalchakra-seven.vercel.app/#/t/diet/cse')
  })

  it('unpublish takes the links down; unknown addresses answer "not published"', async () => {
    const kv = memoryKv()
    const f = fakeFetch(kv)
    const v1 = pub(diet)
    await pushLive(v1, f)
    expect(await removeLive(unpublish(v1, 'x'), f)).toEqual({ ok: true })
    expect(await fetchLiveDept('diet', 'cse', f)).toBeNull()
    expect(await fetchLiveIndex('diet', f)).toBeNull()
    expect(await fetchLiveDept('nope', 'cse', f)).toBeNull()
  })

  it('the first publisher claims the college; another key cannot overwrite it; only a hash of the key is stored', async () => {
    const kv = memoryKv()
    const f = fakeFetch(kv)
    const mine = withPublishKey({ ...pub(diet), college: { ...diet.college, id: 'pec', code: 'PEC' } })
    expect(publishKeyOf(mine)).toMatch(/^[0-9a-f]{48}$/)
    const payload = livePayload(mine)!
    expect((await handle(kv, 'PUT', new URL('https://k.test/api/timetable'), payload)).status).toBe(200)
    expect([...kv.data.values()].some((v) => v.includes(payload.key))).toBe(false)
    const thief = { ...payload, key: 'someone-else-entirely-x' }
    expect((await handle(kv, 'PUT', new URL('https://k.test/api/timetable'), thief)).status).toBe(403)
    expect((await handle(kv, 'DELETE', new URL('https://k.test/api/timetable'), { college: 'pec', key: thief.key })).status).toBe(403)
    expect(await fetchLiveIndex('pec', f)).not.toBeNull()
  })

  it('demo colleges share a fixed key; other colleges get one at their first publish and keep it', () => {
    expect(publishKeyOf(diet)).toBe('kaalchakra-demo-diet')
    const other = { ...diet, college: { ...diet.college, id: 'pec' } }
    expect(publishKeyOf(other)).toBeUndefined()
    const keyed = withPublishKey(other)
    expect(withPublishKey(keyed)).toBe(keyed)
  })

  it('bad requests are refused; an unreachable storage is reported, never thrown', async () => {
    const kv = memoryKv()
    const u = new URL('https://k.test/api/timetable?college=DIET!')
    expect((await handle(kv, 'GET', u, undefined)).status).toBe(400)
    expect((await handle(kv, 'PUT', new URL('https://k.test/api/timetable'), { college: 'diet', depts: [] })).status).toBe(400)
    expect((await handle(kv, 'POST', new URL('https://k.test/api/timetable'), { college: 'diet' })).status).toBe(405)
    const down = (async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    const devServer = (async () => new Response('<html></html>', { status: 404, headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch
    expect(await pushLive(pub(diet), down)).toMatchObject({ ok: false })
    expect(await pushLive(pub(diet), devServer)).toMatchObject({ ok: false, reason: expect.stringContaining('could not be reached') })
    expect(await fetchLiveDept('diet', 'cse', down)).toBeUndefined()
    expect(await fetchLiveIndex('diet', devServer)).toBeUndefined()
  })
})
