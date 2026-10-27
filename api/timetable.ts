// Live department timetables (v0.9-l, user request): the one server piece of Kaalchakra. On publish the College
// Admin's browser stores each department's published snapshot here; a department link (`#/t/<college>/<dept>`)
// then always reads the latest version. Storage = an Upstash Redis store added to the Vercel project (REST API over
// plain fetch, no library). Self-contained on purpose: Vercel runs this file on its own.
//
//   GET    /api/timetable?college=diet            → { college, name, depts: [{ key, code, name }], version, at }
//   GET    /api/timetable?college=diet&dept=cse   → { snapshot }   (the lz-compressed PublicSnapshot)
//   PUT    /api/timetable  { college, name, key, version, at, depts: [{ key, code, name, snapshot }] }
//   DELETE /api/timetable  { college, key }       → unpublished: links say "not published"
//
// Writing needs the college's publish key: the first publish of a college claims it (only its SHA-256 is kept);
// later writes must bring the same key. Demo-grade like the rest of the sign-in (see the README).

/** The few Redis commands used, so the logic can be tested with an in-memory store. */
export type Kv = {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<void>
  del: (keys: string[]) => Promise<void>
}

type Reply = { status: number; body: unknown }

const KEY = /^[a-z0-9-]{1,40}$/
const MAX_SNAPSHOT = 200_000
const MAX_DEPTS = 60

const ttKey = (college: string, dept: string) => `kc:tt:${college}:${dept}`
const indexKey = (college: string) => `kc:index:${college}`
const ownerKey = (college: string) => `kc:owner:${college}`

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const str = (x: unknown): x is string => typeof x === 'string'

/** May this key write to `college`? The first writer claims the college. */
async function owns(kv: Kv, college: string, key: unknown): Promise<boolean> {
  if (!str(key) || key.length < 16 || key.length > 200) return false
  const want = await sha256(key)
  const have = await kv.get(ownerKey(college))
  if (!have) {
    await kv.set(ownerKey(college), want)
    return true
  }
  return have === want
}

type DeptIn = { key: string; code: string; name: string; snapshot: string }

export async function handle(kv: Kv, method: string, url: URL, body: unknown): Promise<Reply> {
  if (method === 'GET') {
    const college = url.searchParams.get('college') ?? ''
    const dept = url.searchParams.get('dept')
    if (!KEY.test(college) || (dept !== null && !KEY.test(dept))) return { status: 400, body: { error: 'Bad address.' } }
    if (dept === null) {
      const index = await kv.get(indexKey(college))
      return index ? { status: 200, body: JSON.parse(index) } : { status: 404, body: { error: 'Not published.' } }
    }
    const snapshot = await kv.get(ttKey(college, dept))
    return snapshot ? { status: 200, body: { snapshot } } : { status: 404, body: { error: 'Not published.' } }
  }

  const b = (body ?? {}) as Record<string, unknown>
  const college = str(b.college) ? b.college : ''
  if (!KEY.test(college)) return { status: 400, body: { error: 'Bad college.' } }

  if (method === 'PUT') {
    const depts = b.depts
    if (!Array.isArray(depts) || depts.length === 0 || depts.length > MAX_DEPTS) return { status: 400, body: { error: 'No departments.' } }
    const ok = (d: unknown): d is DeptIn => {
      const x = d as Record<string, unknown>
      return !!x && str(x.key) && KEY.test(x.key) && str(x.code) && str(x.name) && str(x.snapshot) && x.snapshot.length > 0 && x.snapshot.length <= MAX_SNAPSHOT
    }
    if (!depts.every(ok) || !str(b.name) || !Number.isInteger(b.version) || !str(b.at)) return { status: 400, body: { error: 'Bad timetable.' } }
    if (!(await owns(kv, college, b.key))) return { status: 403, body: { error: 'This college was published from another place.' } }
    // departments of an older version that are gone now stop answering
    const old = await kv.get(indexKey(college))
    const gone = old ? (JSON.parse(old).depts as { key: string }[]).map((d) => d.key).filter((k) => !depts.some((d) => d.key === k)) : []
    if (gone.length) await kv.del(gone.map((k) => ttKey(college, k)))
    for (const d of depts) await kv.set(ttKey(college, d.key), d.snapshot)
    const index = { college, name: b.name, version: b.version, at: b.at, depts: depts.map((d) => ({ key: d.key, code: d.code, name: d.name })) }
    await kv.set(indexKey(college), JSON.stringify(index))
    return { status: 200, body: { ok: true, version: b.version } }
  }

  if (method === 'DELETE') {
    if (!(await owns(kv, college, b.key))) return { status: 403, body: { error: 'This college was published from another place.' } }
    const old = await kv.get(indexKey(college))
    const keys = old ? (JSON.parse(old).depts as { key: string }[]).map((d) => ttKey(college, d.key)) : []
    await kv.del([...keys, indexKey(college)])
    return { status: 200, body: { ok: true } }
  }

  return { status: 405, body: { error: 'Method not allowed.' } }
}

// ── Upstash Redis over its REST API ─────────────────────────────────

declare const process: { env: Record<string, string | undefined> }

function upstash(): Kv | undefined {
  const base = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (!base || !token) return undefined
  const call = async (command: string[]) => {
    const r = await fetch(base, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command) })
    if (!r.ok) throw new Error(`storage ${r.status}`)
    return ((await r.json()) as { result: unknown }).result
  }
  return {
    get: async (key) => ((await call(['GET', key])) as string | null) ?? null,
    set: async (key, value) => void (await call(['SET', key, value])),
    del: async (keys) => void (keys.length ? await call(['DEL', ...keys]) : undefined),
  }
}

async function serve(request: Request): Promise<Response> {
  const kv = upstash()
  if (!kv) return Response.json({ error: 'Storage is not set up on this deployment.' }, { status: 503 })
  let body: unknown
  if (request.method !== 'GET') {
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Bad request.' }, { status: 400 })
    }
  }
  try {
    const r = await handle(kv, request.method, new URL(request.url), body)
    return Response.json(r.body, { status: r.status, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Storage is not answering.' }, { status: 502 })
  }
}

export const GET = serve
export const PUT = serve
export const DELETE = serve
