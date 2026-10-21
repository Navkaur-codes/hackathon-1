import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { classesOn } from '../lib/semester'
import type { CollegeData, LeaveRequest, Substitution } from '../types'
import { solve } from './solve'
import { planLeaveCover, validateDate } from './substitutes'

const fresh = () => buildDemoColleges()[0] // DIET
const leaveFor = (c: CollegeData, teacherId: string, date: string, id = 'leave-1'): LeaveRequest => {
  const l: LeaveRequest = { id, collegeId: c.college.id, teacherId, date, day: 0, reason: 'Medical', status: 'approved' }
  c.leaves.push(l)
  return l
}
const teacherClassesOn = (c: CollegeData, t: ReturnType<typeof solve>, date: string, teacherId: string) =>
  classesOn(c, t, date).filter((x) => x.teacherId === teacherId)

describe('T7.1 leave cover — a free teacher is auto-allotted for that date only', () => {
  it('every class of the absent teacher that date gets a suggested substitute, and the date validates clean', () => {
    const c = fresh()
    const t = solve(c, { seed: 1 })
    const date = '2026-10-26' // a Monday
    const own = teacherClassesOn(c, t, date, 'diet-t-kaur')
    expect(own.length).toBeGreaterThan(0)

    const subs = planLeaveCover(c, t, leaveFor(c, 'diet-t-kaur', date))
    expect(subs).toHaveLength(own.length)
    expect(subs.every((s) => s.status === 'suggested' && s.substituteTeacherId && s.substituteTeacherId !== 'diet-t-kaur')).toBe(true)
    expect(subs.every((s) => s.date === date && s.originalTeacherId === 'diet-t-kaur')).toBe(true)
    expect(validateDate(c, t, date, subs)).toEqual([])
  })

  it('prefers a same-department colleague who teaches the same subject', () => {
    const c = fresh()
    const t = solve(c, { seed: 1 })
    // find a date where Kaur teaches DS (Bedi also teaches DS in CSE)
    const date = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'].find((d) =>
      teacherClassesOn(c, t, d, 'diet-t-kaur').some((x) => x.placement.assignmentId.endsWith('-ds')),
    )!
    const subs = planLeaveCover(c, t, leaveFor(c, 'diet-t-kaur', date))
    const ds = subs.find((s) => s.assignmentId.endsWith('-ds'))!
    const sub = c.teachers.find((x) => x.id === ds.substituteTeacherId)!
    expect(sub.deptId).toBe('diet-cse')
    expect(ds.note).toContain('Same department')
  })

  it('the weekly pattern and other dates are untouched', () => {
    const c = fresh()
    const t = solve(c, { seed: 1 })
    const before = JSON.stringify(t)
    const subs = planLeaveCover(c, t, leaveFor(c, 'diet-t-kaur', '2026-10-26'))
    expect(JSON.stringify(t)).toBe(before)
    const nextMonday = classesOn(c, t, '2026-11-02', subs)
    expect(nextMonday.every((x) => !x.substitution)).toBe(true)
  })

  it('two teachers on leave the same date never get the same substitute in the same slot', () => {
    const c = fresh()
    const t = solve(c, { seed: 2 })
    const date = '2026-10-27'
    const first = planLeaveCover(c, t, leaveFor(c, 'diet-t-kaur', date, 'l1'))
    const second = planLeaveCover(c, t, leaveFor(c, 'diet-t-bedi', date, 'l2'), first)
    const all: Substitution[] = [...first, ...second]
    expect(all.some((s) => s.substituteTeacherId === 'diet-t-kaur' || s.substituteTeacherId === 'diet-t-bedi')).toBe(false)
    expect(validateDate(c, t, date, all)).toEqual([])
  })

  it('a holiday or a non-working day needs no cover', () => {
    const c = fresh()
    const t = solve(c, { seed: 1 })
    expect(planLeaveCover(c, t, leaveFor(c, 'diet-t-kaur', '2026-10-02'))).toEqual([]) // Gandhi Jayanti
    expect(planLeaveCover(c, t, leaveFor(c, 'diet-t-kaur', '2026-10-25'))).toEqual([]) // Sunday
  })

  it('marks a class uncovered (never double-books) when nobody is free', () => {
    const c = fresh()
    const t = solve(c, { seed: 1 })
    const date = '2026-10-26'
    const own = teacherClassesOn(c, t, date, 'diet-t-kaur')
    // make every other teacher unavailable for the first of Kaur's classes that day
    const p = own[0].placement
    for (const teacher of c.teachers) if (teacher.id !== 'diet-t-kaur') teacher.unavailable.push(`${p.day}-${p.period}`)
    const subs = planLeaveCover(c, t, leaveFor(c, 'diet-t-kaur', date))
    const first = subs.find((s) => s.assignmentId === p.assignmentId && s.period === p.period)!
    expect(first.status).toBe('uncovered')
    expect(first.substituteTeacherId).toBeNull()
    expect(first.note).toMatch(/No free teacher/)
  })

  it('cover always respects the substitute’s daily limit and lunch (property over many dates and teachers)', () => {
    const c = fresh()
    const t = solve(c, { seed: 3 })
    const dates = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']
    for (const date of dates) {
      for (const teacher of c.teachers) {
        const college = fresh()
        const subs = planLeaveCover(college, t, leaveFor(college, teacher.id, date))
        expect(validateDate(college, t, date, subs), `${teacher.name} on ${date}`).toEqual([])
      }
    }
  })
})
