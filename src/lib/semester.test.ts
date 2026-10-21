import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { solve } from '../solver/solve'
import type { Substitution } from '../types'
import { classesOn, dayIndexOf, semesterDates, semesterDelivery, semesterSummary, teachingDayCounts, weekdayOf } from './semester'

const [diet, dcas] = buildDemoColleges()

describe('T0.8 semester calendar', () => {
  it('maps real dates to the weekly pattern', () => {
    expect(weekdayOf('2026-07-20')).toBe(1) // Monday
    expect(dayIndexOf(diet.calendar, '2026-07-20')).toBe(0)
    expect(dayIndexOf(diet.calendar, '2026-07-25')).toBe(5) // Saturday works at DIET
    expect(dayIndexOf(dcas.calendar, '2026-08-08')).toBeNull() // …but not at DCAS
    expect(dayIndexOf(diet.calendar, '2026-07-26')).toBeNull() // Sunday
  })

  it('classifies every date (counts checked independently)', () => {
    expect(semesterSummary(diet)).toEqual({
      name: 'Odd Semester 2026',
      startDate: '2026-07-20',
      endDate: '2026-11-27',
      weeks: 19,
      teachingDays: 105,
      holidaysOnWorkingDays: 6,
      noClassDays: 2,
    })
    // Independence Day is a Saturday: a holiday for DIET, simply a day off for DCAS
    expect(semesterDates(diet).find((d) => d.date === '2026-08-15')).toMatchObject({ status: 'holiday', label: 'Independence Day' })
    expect(semesterDates(dcas).find((d) => d.date === '2026-08-15')).toMatchObject({ status: 'off' })
    expect(semesterSummary(dcas)).toMatchObject({ weeks: 16, teachingDays: 74, holidaysOnWorkingDays: 5, noClassDays: 1 })
  })

  it('counts how often each pattern day really happens', () => {
    expect(teachingDayCounts(diet)).toEqual([17, 15, 19, 19, 18, 17])
    expect(teachingDayCounts(dcas)).toEqual([15, 14, 16, 15, 14])
  })
})

describe('T0.9 semester delivery (hours per subject over the whole semester)', () => {
  const t = solve(diet, { seed: 1 })
  const delivery = semesterDelivery(diet, t)
  const counts = teachingDayCounts(diet)

  it('every assignment is delivered, and holidays reduce the total', () => {
    expect(delivery).toHaveLength(diet.assignments.length)
    for (const d of delivery) {
      const subject = diet.subjects.find((s) => s.id === diet.assignments.find((a) => a.id === d.assignmentId)!.subjectId)!
      expect(d.periodsPerWeek).toBe(subject.periodsPerWeek)
      expect(d.periods).toBeLessThanOrEqual(subject.periodsPerWeek * 19)
      expect(d.periods).toBeGreaterThanOrEqual(subject.periodsPerWeek * Math.min(...counts))
      expect(d.minutes).toBe(d.periods * 50)
    }
  })

  it('matches the pattern day by day', () => {
    const d = delivery[0]
    const expected = t.placements.filter((p) => p.assignmentId === d.assignmentId).reduce((s, p) => s + p.length * counts[p.day], 0)
    expect(d.periods).toBe(expected)
  })

  it('uses real slot lengths (DCAS 30-minute lunch slot is never taught)', () => {
    const td = solve(dcas, { seed: 1 })
    for (const d of semesterDelivery(dcas, td)) expect(d.minutes).toBe(d.periods * 55)
  })
})

describe('T0.10 classes on a real date', () => {
  const t = solve(diet, { seed: 1 })

  it('a normal Monday shows the Monday pattern in period order', () => {
    const day = classesOn(diet, t, '2026-07-27')
    expect(day.length).toBe(t.placements.filter((p) => p.day === 0).length)
    expect(day.map((c) => c.placement.period)).toEqual([...day.map((c) => c.placement.period)].sort((a, b) => a - b))
  })

  it('holidays, no-class days, Sundays and dates outside the semester are empty', () => {
    expect(classesOn(diet, t, '2026-10-02')).toEqual([])
    expect(classesOn(diet, t, '2026-09-21')).toEqual([])
    expect(classesOn(diet, t, '2026-07-26')).toEqual([])
    expect(classesOn(diet, t, '2026-12-07')).toEqual([])
  })

  it('a substitution changes the teacher for that date only', () => {
    const p = t.placements.find((x) => x.day === 0)!
    const original = diet.assignments.find((a) => a.id === p.assignmentId)!.teacherId!
    const sub: Substitution = {
      id: 's1',
      collegeId: diet.college.id,
      date: '2026-10-26',
      assignmentId: p.assignmentId,
      day: 0,
      period: p.period,
      originalTeacherId: original,
      substituteTeacherId: 'diet-t-walia',
      status: 'confirmed',
      note: 'test',
    }
    const onLeaveDay = classesOn(diet, t, '2026-10-26', [sub]).find((c) => c.placement === p)!
    expect(onLeaveDay.teacherId).toBe('diet-t-walia')
    expect(onLeaveDay.substitution).toBe(sub)
    const nextMonday = classesOn(diet, t, '2026-11-02', [sub]).find((c) => c.placement === p)!
    expect(nextMonday.teacherId).toBe(original)
  })
})
