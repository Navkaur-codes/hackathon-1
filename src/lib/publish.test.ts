import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { describeTimetable, solveBest } from '../solver/best'
import { solve } from '../solver/solve'
import type { CollegeData, Timetable } from '../types'
import { addSubject, cloneCollege, toggleBlocked } from './edit'
import { publish, publishCheck, setDraft, unpublish } from './publish'
import { checkCollege, exportCollege, importCollege } from './transfer'

const [diet, dcas] = buildDemoColleges()
const T1 = '2026-10-27T09:00:00.000Z'
const T2 = '2026-10-28T09:00:00.000Z'

describe('describeTimetable', () => {
  it('a stored timetable is described exactly as when it was generated', () => {
    const r = solveBest(dcas, { attempts: 3 })
    const d = describeTimetable(dcas, r.timetable)
    expect(d.score).toEqual(r.score)
    expect(d.conflicts).toEqual(r.conflicts)
    expect(d.placedPeriods).toBe(r.placedPeriods)
    expect(d.semesterHours).toBe(r.semesterHours)
    expect(d.bestSeed).toBe(r.bestSeed)
  })
})

describe('T4.8 publish rules', () => {
  const withDraft = setDraft(diet, solve(diet, { seed: 1 }))

  it('no draft → refused', () => {
    expect(publishCheck(diet).blocked[0]).toMatch(/Generate a timetable first/)
    expect(publish(diet, T1).ok).toBe(false)
  })

  it('a clean draft publishes as v1, then v2; the log keeps both', () => {
    const one = publish(withDraft, T1)
    if (!one.ok) throw new Error(one.reasons.join())
    expect(one.college.published).toMatchObject({ version: 1, at: T1 })
    expect(one.college.published!.timetable).toBe(withDraft.draft)
    const two = publish(setDraft(one.college, solve(diet, { seed: 2 })), T2)
    if (!two.ok) throw new Error(two.reasons.join())
    expect(two.college.published!.version).toBe(2)
    expect(two.college.publishLog!.map((e) => e.version)).toEqual([1, 2])
    expect(two.college.publishLog![1]).toMatchObject({ at: T2, unplaced: 0, periods: 111 })
    expect(two.college.publishLog![1].score).toBeGreaterThan(0)
  })

  it('a stale draft is refused until generated again', () => {
    const stale = toggleBlocked(withDraft, '0-0')
    expect(stale.draftStale).toBe(true)
    const r = publish(stale, T1)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reasons[0]).toMatch(/changed after this draft/)
    expect(publish(setDraft(stale, solve(stale, { seed: 1 })), T1).ok).toBe(true)
  })

  it('any clash found by the independent validator blocks publishing', () => {
    const t = withDraft.draft!
    // move a class onto another class of the same section → H2 (and more)
    const [a, b] = t.placements
    const clashing: Timetable = { ...t, placements: t.placements.map((p) => (p === b ? { ...p, day: a.day, period: a.period } : p)) }
    const r = publish(setDraft(diet, clashing), T1)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reasons[0]).toMatch(/independent check found \d+ clash/)
  })

  it('unplaced periods need an explicit OK', () => {
    const needsTeacher = addSubject(diet, 'diet-cse-y2', { code: 'AI', name: 'AI', kind: 'theory', periodsPerWeek: 2, roomType: 'lecture' })
    const draft = setDraft(needsTeacher, solve(needsTeacher, { seed: 1 }))
    expect(publishCheck(draft)).toMatchObject({ blocked: [], unplaced: 4 }) // 2 sections × 2 periods, no teacher
    const refused = publish(draft, T1)
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.reasons[0]).toMatch(/4 periods are not placed/)
    const ok = publish(draft, T1, { acceptUnplaced: true })
    expect(ok.ok && ok.college.publishLog![0].unplaced).toBe(4)
  })

  it('unpublish takes the version down; history remembers it; next publish is v2', () => {
    const one = publish(withDraft, T1)
    if (!one.ok) throw new Error()
    const down = unpublish(one.college, T2)
    expect(down.published).toBeUndefined()
    expect(down.publishLog![0]).toMatchObject({ version: 1, unpublishedAt: T2 })
    const again = publish(down, T2)
    expect(again.ok && again.college.published!.version).toBe(2)
    expect(unpublish(diet, T2)).toBe(diet)
  })
})

describe('T4.3 export → import', () => {
  it('round trip is identical (structure, setup, draft, published, history)', () => {
    const one = publish(setDraft(dcas, solve(dcas, { seed: 1 })), T1)
    if (!one.ok) throw new Error()
    const back = importCollege(exportCollege(one.college, T2), dcas.college.id)
    expect(back.ok).toBe(true)
    if (back.ok) expect(back.college).toEqual(one.college)
    // the demo colleges and a clone are all valid
    for (const c of [diet, dcas, cloneCollege(diet, 'GNDEC', 'x')]) expect(checkCollege(c)).toEqual([])
  })

  it('refuses another college, broken JSON, foreign records and missing references', () => {
    expect(importCollege(exportCollege(diet, T1), dcas.college.id)).toMatchObject({ ok: false, errors: [expect.stringMatching(/for DIET/)] })
    expect(importCollege('{ nope', 'diet')).toMatchObject({ ok: false, errors: ['This file is not valid JSON.'] })
    expect(importCollege(JSON.stringify({ hello: 1 }))).toMatchObject({ ok: false, errors: ['This is not a Kaalchakra export.'] })
    const foreign: CollegeData = { ...diet, teachers: [...diet.teachers, { ...dcas.teachers[0] }] }
    const r1 = importCollege(exportCollege(foreign, T1), 'diet')
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.errors[0]).toBe('1 record belongs to college "dcas", not diet.')
    const broken: CollegeData = { ...diet, sections: diet.sections.slice(1) }
    const r2 = importCollege(exportCollege(broken, T1), 'diet')
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.errors.join(' ')).toMatch(/points at a missing section/)
  })
})
