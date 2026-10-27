// Live department links (v0.9-l, user request): one link per department that never changes and always shows the
// latest published version. On publish the College Admin's browser stores every department's snapshot through
// `/api/timetable` (the one server function, see api/timetable.ts); the public page reads it back. When the storage
// cannot be reached (local dev, or not set up yet) the one-time snapshot link of lib/publicView.ts still works.

import { DEMO_COLLEGE_IDS } from '../demoData'
import type { CollegeData, Department } from '../types'
import { collegeKey, decodePublic, deptKey, deptSnapshot, encodePublic, type PublicSnapshot } from './publicView'

export const API = '/api/timetable'

/**
 * The key that lets this college update its live links. Demo colleges share a fixed one (anyone may republish a
 * demo); every other college gets a random key at its first publish, kept in the college's data.
 */
export const publishKeyOf = (c: CollegeData): string | undefined =>
  c.college.publishKey ?? (DEMO_COLLEGE_IDS.includes(c.college.id) ? `kaalchakra-demo-${c.college.id}` : undefined)

/** The college with a publish key (unchanged when it has one). */
export function withPublishKey(c: CollegeData): CollegeData {
  if (publishKeyOf(c)) return c
  const key = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('')
  return { ...c, college: { ...c.college, publishKey: key } }
}

/** What a publish sends: every department's published snapshot plus the college's index. */
export function livePayload(c: CollegeData) {
  const pub = c.published
  const key = publishKeyOf(c)
  if (!pub || !key) return undefined
  const depts = c.departments.flatMap((d) => {
    const snap = deptSnapshot(c, deptKey(d))
    return snap ? [{ key: deptKey(d), code: d.code, name: d.name, snapshot: encodePublic(snap) }] : []
  })
  return { college: collegeKey(c), name: c.college.name, key, version: pub.version, at: pub.at, depts }
}

export type LiveOutcome = { ok: true } | { ok: false; reason: string }

const offline = 'Kaalchakra’s storage could not be reached (it runs only on the live site).'
const why = async (r: Response) => {
  // a dev server answers with its own page, not the storage
  if (!(r.headers.get('content-type') ?? '').includes('json')) return offline
  try {
    return ((await r.json()) as { error?: string }).error ?? `The storage answered ${r.status}.`
  } catch {
    return `The storage answered ${r.status}.`
  }
}

/** Store the published version so every department's link shows it. */
export async function pushLive(c: CollegeData, fetchImpl: typeof fetch = fetch): Promise<LiveOutcome> {
  const payload = livePayload(c)
  if (!payload || payload.depts.length === 0) return { ok: false, reason: 'Nothing is published.' }
  try {
    const r = await fetchImpl(API, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    return r.ok ? { ok: true } : { ok: false, reason: await why(r) }
  } catch {
    return { ok: false, reason: offline }
  }
}

/** Take the college's live links down (after Unpublish). */
export async function removeLive(c: CollegeData, fetchImpl: typeof fetch = fetch): Promise<LiveOutcome> {
  const key = publishKeyOf(c)
  if (!key) return { ok: true }
  try {
    const r = await fetchImpl(API, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ college: collegeKey(c), key }) })
    return r.ok ? { ok: true } : { ok: false, reason: await why(r) }
  } catch {
    return { ok: false, reason: offline }
  }
}

/** Live read: the snapshot, `null` = not published, `undefined` = storage unreachable. */
export async function fetchLiveDept(college: string, dept: string, fetchImpl: typeof fetch = fetch): Promise<PublicSnapshot | null | undefined> {
  try {
    const r = await fetchImpl(`${API}?college=${encodeURIComponent(college)}&dept=${encodeURIComponent(dept)}`, { cache: 'no-store' })
    // anything that is not the storage's JSON (a dev server's page, a proxy error) = unreachable
    if (!(r.headers.get('content-type') ?? '').includes('json')) return undefined
    if (r.status === 404) return null
    if (!r.ok) return undefined
    return decodePublic(((await r.json()) as { snapshot?: string }).snapshot) ?? undefined
  } catch {
    return undefined
  }
}

export type LiveIndex = { college: string; name: string; version: number; at: string; depts: { key: string; code: string; name: string }[] }

/** Live read of a college's department list (for `#/t/<college>`). */
export async function fetchLiveIndex(college: string, fetchImpl: typeof fetch = fetch): Promise<LiveIndex | null | undefined> {
  try {
    const r = await fetchImpl(`${API}?college=${encodeURIComponent(college)}`, { cache: 'no-store' })
    // anything that is not the storage's JSON (a dev server's page, a proxy error) = unreachable
    if (!(r.headers.get('content-type') ?? '').includes('json')) return undefined
    if (r.status === 404) return null
    if (!r.ok) return undefined
    return (await r.json()) as LiveIndex
  } catch {
    return undefined
  }
}

/** The department's permanent link on `base` (the app's address). */
export const liveUrl = (base: string, c: CollegeData, d: Department) => `${base}#/t/${collegeKey(c)}/${deptKey(d)}`
