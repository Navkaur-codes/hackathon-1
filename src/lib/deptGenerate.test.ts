import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { solveBest } from '../solver/best'
import { validate } from '../solver/validate'
import type { CollegeData, Placement } from '../types'
import { coverage, deptEntities, deptSolveOptions, mergeDept, readiness } from './deptPlan'
import { addSubject, toggleBlocked, toggleUnavailable } from './edit'
import { publishCheck, setDraft } from './publish'

const [diet, dcas] = buildDemoColleges()

/** What a HOD's "Generate my department" does: solve the department against the rest, merge it back. */
const generate = (c: CollegeData, deptId: string, baseSeed = 1) => mergeDept(c, deptId, solveBest(c, { attempts: 5, baseSeed, ...deptSolveOptions(c, deptId) }).timetable)
const ofDept = (c: CollegeData, deptId: string) => {
  const mine = deptEntities(c, deptId).assignmentIds
  return (c.draft?.placements ?? []).filter((p) => mine.has(p.assignmentId))
}
const key = (p: Placement) => `${p.assignmentId}@${p.day}-${p.period}-${p.roomId}`

describe('T5.2 department generate against the college ledger', () => {
  it('CSE, then ECE, then ME — each against the others — gives 0 conflicts and covers every class', () => {
    let c = diet
    for (const d of diet.departments) c = generate(c, d.id)
    expect(validate(c, c.draft!)).toEqual([])
    expect(coverage(c, c.draft)).toEqual([])
    expect(c.draft!.unplaced).toEqual([])
    for (const d of diet.departments) expect(readiness(c, d.id).ready).toBe(true)
    expect(publishCheck(c).blocked).toEqual([])
  })

  it('re-generating one department never moves another department', () => {
    let c = diet
    for (const d of diet.departments) c = generate(c, d.id)
    const eceBefore = ofDept(c, 'diet-ece').map(key).sort()
    const meBefore = ofDept(c, 'diet-me').map(key).sort()
    const again = generate(c, 'diet-cse', 41)
    expect(ofDept(again, 'diet-ece').map(key).sort()).toEqual(eceBefore)
    expect(ofDept(again, 'diet-me').map(key).sort()).toEqual(meBefore)
    expect(validate(again, again.draft!)).toEqual([])
  })

  it('works on top of a whole-college draft and on DCAS too', () => {
    const whole = setDraft(dcas, solveBest(dcas, { attempts: 3 }).timetable)
    const again = generate(whole, dcas.departments[0].id, 7)
    expect(validate(again, again.draft!)).toEqual([])
    expect(coverage(again, again.draft)).toEqual([])
  })

  it("the other departments' unplaced periods are kept; this department's are replaced", () => {
    const eceExtra = addSubject(diet, 'diet-ece-y2', { code: 'X1', name: 'Extra', kind: 'theory', periodsPerWeek: 2, roomType: 'lecture' })
    let c = setDraft(eceExtra, solveBest(eceExtra, { attempts: 3 }).timetable)
    const eceUnplaced = c.draft!.unplaced.filter((u) => u.assignmentId.startsWith('diet-ece'))
    expect(eceUnplaced.length).toBeGreaterThan(0) // no teacher for X1
    c = generate(c, 'diet-cse')
    expect(c.draft!.unplaced.filter((u) => u.assignmentId.startsWith('diet-ece'))).toEqual(eceUnplaced)
  })

  it('a change in one department holds back only that department; generating it clears the draft again', () => {
    let c = diet
    for (const d of diet.departments) c = generate(c, d.id)
    // an ME-only teacher becomes unavailable exactly when they teach → the draft goes stale, only ME clashes
    const me = deptEntities(c, 'diet-me')
    const meOnly = me.teachers.find((t) => !c.assignments.some((a) => a.teacherId === t.id && !me.assignmentIds.has(a.id)))!
    const at = c.draft!.placements.find((p) => c.assignments.find((a) => a.id === p.assignmentId)?.teacherId === meOnly.id)!
    c = toggleUnavailable(c, meOnly.id, `${at.day}-${at.period}`)
    expect(c.draftStale).toBe(true)
    expect(readiness(c, 'diet-me').ready).toBe(false)
    expect(readiness(c, 'diet-cse').ready).toBe(true) // CSE is not held back
    expect(publishCheck(c).blocked[0]).toMatch(/changed after this draft/)
    c = generate(c, 'diet-me')
    expect(c.draftStale).toBe(false)
    expect(validate(c, c.draft!)).toEqual([])
    expect(publishCheck(c).blocked).toEqual([])
  })

  it('a college-wide blocked slot affects every department with a class there', () => {
    let c = diet
    for (const d of diet.departments) c = generate(c, d.id)
    // a slot used by more than one department
    const deptOf = (p: Placement) => c.sections.find((s) => s.id === c.assignments.find((a) => a.id === p.assignmentId)!.sectionId)!.deptId
    const bySlot = new Map<string, Set<string>>()
    for (const p of c.draft!.placements) for (let i = 0; i < p.length; i++) {
      const k = `${p.day}-${p.period + i}`
      bySlot.set(k, new Set([...(bySlot.get(k) ?? []), deptOf(p)]))
    }
    const [slot, depts] = [...bySlot].find(([, ds]) => ds.size > 1)!
    c = toggleBlocked(c, slot as `${number}-${number}`)
    for (const d of depts) expect(readiness(c, d).items.find((i) => i.id === 'clashes')!.ok).toBe(false)
    const [first, ...rest] = [...depts]
    c = generate(c, first)
    expect(validate(c, c.draft!).length).toBeGreaterThan(0) // the others still sit in the blocked slot
    for (const d of rest) c = generate(c, d)
    expect(validate(c, c.draft!)).toEqual([])
  })

  it('a department generated before the others leaves them uncovered — publishing names them', () => {
    const onlyCse = generate(diet, 'diet-cse')
    expect(coverage(onlyCse, onlyCse.draft).every((g) => g.deptId !== 'diet-cse')).toBe(true)
    expect(readiness(onlyCse, 'diet-cse').ready).toBe(true)
    expect(readiness(onlyCse, 'diet-ece').items.find((i) => i.id === 'placed')!.ok).toBe(false)
    expect(publishCheck(onlyCse).blocked[0]).toMatch(/not in the draft yet \(ECE, ME\)/)
  })
})
