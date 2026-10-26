import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { deptSolveOptions, mergeDept } from '../lib/deptPlan'
import { lockedFixed, lockedOf, toggleLock, unlockAll } from '../lib/lock'
import { publish, publishCheck, setDraft } from '../lib/publish'
import { slotKey } from '../lib/structure'
import type { CollegeData, Placement } from '../types'
import { solveBest } from './best'
import { conflictReport } from './conflicts'
import { solve } from './solve'
import { validate } from './validate'

const [diet, dcas] = buildDemoColleges()
const NOW = '2026-10-27T10:00:00.000Z'
const TODAY = '2026-10-27'
const ok = (r: { ok: true; college: CollegeData } | { ok: false; reason: string }) => {
  if (!r.ok) throw new Error(r.reason)
  return r.college
}
const drafted = setDraft(diet, solve(diet, { seed: 1 }))
const deptOf = new Map(diet.assignments.map((a) => [a.id, diet.sections.find((s) => s.id === a.sectionId)!.deptId]))

describe('T7.3 lock and regenerate', () => {
  const target = drafted.draft!.placements.find((p) => p.length === 1)!
  const lab = drafted.draft!.placements.find((p) => p.length > 1)!
  const locked = ok(toggleLock(ok(toggleLock(drafted, target)), lab))

  it('toggle, list and unlock all', () => {
    expect(lockedOf(locked).map((p) => p.assignmentId).sort()).toEqual([target.assignmentId, lab.assignmentId].sort())
    expect(lockedOf(ok(toggleLock(locked, target)))).toHaveLength(1)
    expect(lockedOf(unlockAll(locked))).toEqual([])
    expect(toggleLock(diet, target).ok).toBe(false)
  })

  it('whole-college generate with other seeds keeps every locked class exactly (H10 via mustKeep), 0 conflicts', () => {
    const keep = lockedOf(locked)
    for (const baseSeed of [3, 50, 99]) {
      const r = solveBest(locked, { attempts: 3, baseSeed, anyRoom: true, ...lockedFixed(locked) })
      for (const k of keep) expect(r.timetable.placements).toContainEqual(k)
      expect(validate(locked, r.timetable, { mustKeep: keep }).filter((x) => x.rule === 'H10')).toEqual([])
      expect(r.unplacedPeriods).toBe(0)
      expect(r.conflicts).toEqual([])
    }
  })

  it("a department generate keeps that department's own locked class too", () => {
    const deptId = deptOf.get(target.assignmentId)!
    const r = solveBest(locked, { attempts: 3, baseSeed: 7, ...deptSolveOptions(locked, deptId) })
    const merged = mergeDept(locked, deptId, r.timetable)
    expect(merged.draft!.placements).toContainEqual(lockedOf(locked).find((p) => p.assignmentId === target.assignmentId))
    expect(validate(merged, merged.draft!, { mustKeep: lockedOf(locked) })).toEqual([])
  })

  it('the validator notices a locked class that moved', () => {
    const moved = { ...drafted.draft!, placements: drafted.draft!.placements.map((p) => (p === target ? { ...p, period: p.period + 1 } : p)) }
    expect(validate(diet, moved, { mustKeep: [{ ...target, locked: true }] }).some((x) => x.rule === 'H10')).toBe(true)
  })
})

describe('T7.4 Conflict Center', () => {
  it('a clean draft and live version → clean report', () => {
    const r = publish(drafted, NOW)
    if (!r.ok) throw new Error(r.reasons.join())
    expect(conflictReport(r.college, TODAY)).toMatchObject({ draft: [], published: [], leaveDays: [], blocked: [], clean: true })
  })

  it('an injected cross-department room clash is reported with both departments and fixes; publishing is blocked', () => {
    const d = drafted.draft!
    const a = d.placements.find((p) => deptOf.get(p.assignmentId) === 'diet-ece' && p.length === 1)!
    const b = d.placements.find((p) => deptOf.get(p.assignmentId) === 'diet-cse' && p.length === 1 && diet.rooms.find((r) => r.id === p.roomId)?.type === 'lecture')!
    // put the ECE class into the CSE class's room and time (a hand edit gone wrong)
    const bad: Placement[] = d.placements.map((p) => (p === a ? { ...a, day: b.day, period: b.period, roomId: b.roomId } : p))
    const c = { ...drafted, draft: { ...d, placements: bad } }
    const r = conflictReport(c, TODAY)
    const h3 = r.draft.find((x) => x.rule === 'H3')!
    expect(h3).toBeDefined()
    expect(h3.deptIds.sort()).toEqual(['diet-cse', 'diet-ece'])
    expect(h3.fixes.map((f) => f.kind)).toEqual(expect.arrayContaining(['moveRoom', 'generateDept', 'generateAll']))
    expect(h3.fixes.filter((f) => f.kind === 'generateDept').map((f) => (f as { deptId: string }).deptId).sort()).toEqual(['diet-cse', 'diet-ece'])
    // only the two classes in that room at that slot, not their whole week
    expect(h3.placements).toHaveLength(2)
    expect(h3.placements.every((p) => p.day === b.day && p.period === b.period && p.roomId === b.roomId)).toBe(true)
    expect(r.clean).toBe(false)
    expect(publishCheck(c).blocked.length).toBeGreaterThan(0)
    expect(publish(c, NOW).ok).toBe(false)
    expect(r.blocked.some((x) => x.includes('clash'))).toBe(true)
  })

  it('a locked class that became illegal offers Unlock', () => {
    const target = drafted.draft!.placements.find((p) => p.length === 1)!
    const teacherId = diet.assignments.find((a) => a.id === target.assignmentId)!.teacherId!
    const locked = ok(toggleLock(drafted, target))
    const c: CollegeData = {
      ...locked,
      teachers: locked.teachers.map((t) => (t.id === teacherId ? { ...t, unavailable: [...t.unavailable, slotKey(target.day, target.period)] } : t)),
    }
    const h6 = conflictReport(c, TODAY).draft.find((x) => x.rule === 'H6')!
    expect(h6.fixes[0]).toMatchObject({ kind: 'unlock' })
  })

  it('the live version is checked against today\'s data (teacher made unavailable after publishing)', () => {
    const r = publish(drafted, NOW)
    if (!r.ok) throw new Error()
    const p = r.college.published!.timetable.placements[0]
    const teacherId = diet.assignments.find((a) => a.id === p.assignmentId)!.teacherId!
    const c: CollegeData = {
      ...r.college,
      teachers: r.college.teachers.map((t) => (t.id === teacherId ? { ...t, unavailable: [...t.unavailable, slotKey(p.day, p.period)] } : t)),
    }
    const rep = conflictReport(c, TODAY)
    expect(rep.published.some((x) => x.rule === 'H6')).toBe(true)
    expect(rep.clean).toBe(false)
  })

  it('upcoming leave with an uncovered class is listed', () => {
    const r = publish(drafted, NOW)
    if (!r.ok) throw new Error()
    const p = r.college.published!.timetable.placements.find((x) => x.day === 0)!
    const teacherId = diet.assignments.find((a) => a.id === p.assignmentId)!.teacherId!
    const c: CollegeData = {
      ...r.college,
      leaves: [{ id: 'L', collegeId: 'diet', teacherId, date: '2026-11-16', day: 0, reason: 'x', status: 'approved' }],
      substitutions: [{ id: 's', collegeId: 'diet', date: '2026-11-16', leaveId: 'L', assignmentId: p.assignmentId, day: 0, period: p.period, originalTeacherId: teacherId, substituteTeacherId: null, status: 'uncovered', note: '' }],
    }
    const rep = conflictReport(c, TODAY)
    expect(rep.leaveDays).toHaveLength(1)
    expect(rep.leaveDays[0].uncovered).toHaveLength(1)
    // past leave is not listed
    expect(conflictReport(c, '2026-12-01').leaveDays).toEqual([])
  })

  it('works on DCAS too', () => {
    const r = publish(setDraft(dcas, solve(dcas, { seed: 2 })), NOW)
    if (!r.ok) throw new Error(r.reasons.join())
    expect(conflictReport(r.college, TODAY).clean).toBe(true)
  })
})
