import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { solve } from '../solver/solve'
import type { CollegeData, Timetable } from '../types'
import { deptEdit, deptEntities, markReady, readiness, setDeptStatus } from './deptPlan'
import { addSubject, removeTeacher, toggleBlocked, updateSection } from './edit'
import { setDraft } from './publish'

const [diet] = buildDemoColleges()
const withDraft = setDraft(diet, solve(diet, { seed: 1 }))
const ids = (c: CollegeData, d: string) => readiness(c, d).items.filter((i) => !i.ok).map((i) => i.id)

describe('department readiness and Ready status', () => {
  it('deptEntities picks only what belongs to the department', () => {
    const e = deptEntities(diet, 'diet-cse')
    expect(e.sections.every((s) => s.deptId === 'diet-cse')).toBe(true)
    expect(e.assignments.every((a) => e.sectionIds.has(a.sectionId))).toBe(true)
    expect(e.rooms.every((r) => r.owner === 'diet-cse')).toBe(true)
    expect(e.teachers.length).toBeGreaterThan(0)
  })

  it('without a draft the department cannot be Ready; with a clean draft it can', () => {
    expect(ids(diet, 'diet-cse')).toEqual(['placed', 'clashes'])
    expect(markReady(diet, 'diet-cse')).toBe(diet)
    expect(readiness(withDraft, 'diet-cse').ready).toBe(true)
    expect(markReady(withDraft, 'diet-cse').departments.find((d) => d.id === 'diet-cse')!.status).toBe('ready')
  })

  it('a class without a teacher, a stale draft or a clash in the department each block Ready', () => {
    const teacherGone = removeTeacher(withDraft, diet.teachers.find((t) => t.deptId === 'diet-cse')!.id)
    expect(ids(teacherGone, 'diet-cse')).toContain('teachers')
    const stale = toggleBlocked(withDraft, '0-0')
    expect(ids(stale, 'diet-cse')).toContain('placed')
    const t = withDraft.draft!
    const cse = deptEntities(diet, 'diet-cse').assignmentIds
    const [a, b] = t.placements.filter((p) => cse.has(p.assignmentId) && p.length === 1)
    const clashing: Timetable = { ...t, placements: t.placements.map((p) => (p === b ? { ...p, day: a.day, period: a.period } : p)) }
    expect(ids(setDraft(diet, clashing), 'diet-cse')).toContain('clashes')
  })

  it("another department's problems never block this one", () => {
    const eceNeedsTeacher = addSubject(diet, 'diet-ece-y2', { code: 'X1', name: 'Extra', kind: 'theory', periodsPerWeek: 2, roomType: 'lecture' })
    const draft = setDraft(eceNeedsTeacher, solve(eceNeedsTeacher, { seed: 1 }))
    expect(readiness(draft, 'diet-cse').ready).toBe(true)
    expect(ids(draft, 'diet-ece')).toEqual(['teachers', 'placed']) // the missing teacher is a pre-flight warning, not an error
  })

  it('any change made for the department sends it back to Draft; a no-op does not', () => {
    const ready = setDeptStatus(withDraft, 'diet-cse', 'ready')
    const sec = diet.sections.find((s) => s.deptId === 'diet-cse')!
    const edited = deptEdit('diet-cse', (c) => updateSection(c, sec.id, { strength: 50 }))(ready)
    expect(edited.departments.find((d) => d.id === 'diet-cse')!.status).toBe('draft')
    expect(deptEdit('diet-cse', (c) => c)(ready)).toBe(ready)
  })
})
