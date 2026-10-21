import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { buildCollege } from '../lib/structure'
import { randomSpec } from '../test/randomCollege'
import type { CollegeData, Timetable } from '../types'
import { mulberry32 } from './rng'
import { solve } from './solve'
import { validate } from './validate'

const demos = buildDemoColleges()

const curriculumPeriods = (c: CollegeData) =>
  c.assignments.reduce((sum, a) => sum + c.subjects.find((s) => s.id === a.subjectId)!.periodsPerWeek, 0)
const placedPeriods = (t: Timetable) => t.placements.reduce((sum, p) => sum + p.length, 0)

describe('T1 both demo colleges solve completely with zero clashes', () => {
  it.each(demos.flatMap((c) => [1, 2, 3, 7, 42].map((seed) => [c.college.code, seed, c] as const)))(
    '%s, seed %i',
    (_, seed, college) => {
      const t = solve(college, { seed })
      expect(validate(college, t)).toEqual([])
      expect(t.unplaced).toEqual([])
      expect(placedPeriods(t)).toBe(curriculumPeriods(college))
    },
  )
})

describe('T4 determinism', () => {
  it('same seed → identical timetable; different seed → a different one', () => {
    const c = demos[0]
    expect(solve(c, { seed: 5 })).toEqual(solve(c, { seed: 5 }))
    expect(JSON.stringify(solve(c, { seed: 5 }).placements)).not.toBe(JSON.stringify(solve(c, { seed: 6 }).placements))
  })
})

describe('T5 breaks, availability and labs on the demos', () => {
  it('labs are whole blocks; staggered lunch and unavailable slots respected', () => {
    const c = demos[0]
    const t = solve(c, { seed: 3 })
    for (const p of t.placements) {
      const a = c.assignments.find((x) => x.id === p.assignmentId)!
      const subject = c.subjects.find((s) => s.id === a.subjectId)!
      expect(p.length).toBe(subject.kind === 'lab' ? 2 : 1)
    }
    // ECE eats lunch in slot index 4, CSE/ME in slot 3
    const ece = t.placements.filter((p) => p.deptId === 'diet-ece')
    expect(ece.some((p) => p.period <= 4 && p.period + p.length > 4)).toBe(false)
    // visiting teacher Sharma never on Saturday (day 5)
    const sharma = new Set(c.assignments.filter((a) => a.teacherId === 'diet-t-sharma').map((a) => a.id))
    expect(t.placements.some((p) => sharma.has(p.assignmentId) && p.day === 5)).toBe(false)
  })
})

describe('T2.H10 locked placements survive a re-solve', () => {
  it('keeps fixed classes exactly and still produces zero clashes', () => {
    const c = demos[0]
    const first = solve(c, { seed: 1 })
    const locked = first.placements.filter((_, i) => i % 9 === 0).map((p) => ({ ...p, locked: true }))
    const again = solve(c, { seed: 99, fixed: locked })
    expect(validate(c, again, { mustKeep: locked })).toEqual([])
    expect(again.unplaced).toEqual([])
  })
})

describe('department-by-department solving never clashes across departments', () => {
  it('CSE, then ECE, then ME — each against the others already booked', () => {
    const c = demos[0]
    let booked: Timetable['placements'] = []
    for (const dept of c.departments) {
      const ids = c.assignments.filter((a) => c.sections.find((s) => s.id === a.sectionId)!.deptId === dept.id).map((a) => a.id)
      const t = solve(c, { seed: 4, fixed: booked, assignmentIds: ids })
      booked = t.placements
    }
    const all: Timetable = { collegeId: c.college.id, seed: 4, placements: booked, unplaced: [] }
    expect(validate(c, all)).toEqual([])
    expect(placedPeriods(all)).toBe(curriculumPeriods(c))
  })
})

describe('leave for a date (adjusted timetable)', () => {
  it('re-plans around a teacher on leave without clashes', () => {
    const c = demos[1]
    const leave = [{ teacherId: 'dcas-t-verma', day: 0 }]
    const t = solve(c, { seed: 2, leave })
    expect(validate(c, t, { leave })).toEqual([])
  })
})

// ── T2 "never produced": random colleges of random shapes ───────────────

describe('T2 the solver never produces a clash — 60 random colleges × 2 seeds', () => {
  const rng = mulberry32(2026)
  const specs = Array.from({ length: 60 }, (_, i) => randomSpec(rng, i))

  it.each(specs.map((s, i) => [i, s] as const))('random college #%i', (_, spec) => {
    const college = buildCollege(spec)
    for (const seed of [1, 2]) {
      const t = solve(college, { seed })
      expect(validate(college, t)).toEqual([])
      // whatever could not be placed is accounted for, never silently dropped
      const unplaced = t.unplaced.reduce((s, u) => s + u.periods, 0)
      expect(placedPeriods(t) + unplaced).toBe(curriculumPeriods(college))
    }
  })
})
