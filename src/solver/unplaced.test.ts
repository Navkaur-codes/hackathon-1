import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { buildCollege, type CollegeSpec, type DepartmentSpec, type ProgrammeSpec } from '../lib/structure'
import { randomSpec } from '../test/randomCollege'
import type { CollegeData, Timetable } from '../types'
import { preflight } from './preflight'
import { mulberry32 } from './rng'
import { solve } from './solve'
import { validate } from './validate'

// Tiny one-department college: Mon–Tue × 4 periods, no breaks, generous teachers unless overridden.
function tiny(over: { periods?: number; breaks?: CollegeSpec['calendar']['breaks']; dept?: Partial<DepartmentSpec>; programmes?: ProgrammeSpec[]; extraDepts?: DepartmentSpec[] } = {}): CollegeData {
  return buildCollege({
    code: 'TY',
    name: 'Tiny',
    calendar: {
      days: ['Mon', 'Tue'],
      weekdays: [1, 2],
      periodsPerDay: over.periods ?? 4,
      startTime: '09:00',
      periodMinutes: 50,
      breaks: over.breaks ?? [],
      lunchWindow: [],
      teacherMinFreeInLunchWindow: 0,
      blockedSlots: [],
      labBlockLength: 2,
      maxMeetingRequestsPerStudent: 3,
    },
    semester: { name: 'S', startDate: '2026-07-20', endDate: '2026-07-31', holidays: [], noClassDates: [] },
    sharedRooms: [],
    departments: [
      {
        code: 'A',
        name: 'A',
        rooms: [{ name: 'A-L', type: 'lecture', capacity: 60 }],
        teachers: [
          { key: 'x', name: 'Teacher X', maxPerDay: 8, maxPerWeek: 20 },
          { key: 'y', name: 'Teacher Y', maxPerDay: 8, maxPerWeek: 20 },
          { key: 'z', name: 'Teacher Z', maxPerDay: 8, maxPerWeek: 20 },
        ],
        programmes: over.programmes ?? [],
        ...over.dept,
      },
      ...(over.extraDepts ?? []),
    ],
  })
}

const curriculum = (c: CollegeData) => c.assignments.reduce((s, a) => s + c.subjects.find((x) => x.id === a.subjectId)!.periodsPerWeek, 0)
const placed = (t: Timetable) => t.placements.reduce((s, p) => s + p.length, 0)
const unplacedPeriods = (t: Timetable) => t.unplaced.reduce((s, u) => s + u.periods, 0)

/** Solve, prove there is no clash and nothing was silently dropped, return the result. */
function solveSafely(c: CollegeData) {
  const t = solve(c, { seed: 1 })
  expect(validate(c, t)).toEqual([])
  expect(placed(t) + unplacedPeriods(t)).toBe(curriculum(c))
  return t
}

const codes = (c: CollegeData) => preflight(c).map((w) => `${w.level}:${w.code}`)

describe('T3 impossible input → unplaced with a plain reason and a fix, never a clash', () => {
  it('lab demand above lab-room capacity', () => {
    const c = tiny({
      dept: { rooms: [{ name: 'A-L', type: 'lecture', capacity: 60 }, { name: 'Only Lab', type: 'lab', capacity: 60 }] },
      programmes: [
        { name: 'P', shortName: 'P', sectionsCount: 5, defaultStrength: 40, subjects: [{ code: 'LB', name: 'Lab Work', kind: 'lab', periodsPerWeek: 2, teachers: ['x', 'y', 'z'] }] },
      ],
    })
    const t = solveSafely(c)
    expect(unplacedPeriods(t)).toBe(2) // 5 sections × 2 periods = 10 > 4 lab blocks of 2 → one section misses out
    expect(t.unplaced[0].reason).toMatch(/lab room are free together|lab/)
    expect(t.unplaced[0].suggestion).toMatch(/add a lab room|another teacher/i)
    expect(codes(c)).toContain('error:lab-capacity')
  })

  it('no room big enough', () => {
    const c = tiny({
      programmes: [{ name: 'P', shortName: 'P', sectionsCount: 1, defaultStrength: 80, subjects: [{ code: 'TH', name: 'Theory', kind: 'theory', periodsPerWeek: 2, teachers: ['x'] }] }],
    })
    const t = solveSafely(c)
    expect(t.unplaced[0]).toMatchObject({ periods: 2 })
    expect(t.unplaced[0].reason).toBe('Theory (A-P-A): no lecture room seats 80 students (largest has 60).')
    expect(t.unplaced[0].suggestion).toMatch(/bigger lecture room or split/)
    expect(codes(c)).toContain('error:no-room')
  })

  it('the only suitable room belongs to another department → suggests Room Exchange', () => {
    const c = tiny({
      dept: { rooms: [] },
      programmes: [{ name: 'P', shortName: 'P', sectionsCount: 1, defaultStrength: 40, subjects: [{ code: 'TH', name: 'Theory', kind: 'theory', periodsPerWeek: 1, teachers: ['x'] }] }],
      extraDepts: [{ code: 'B', name: 'B', rooms: [{ name: 'B-L', type: 'lecture', capacity: 60 }], teachers: [], programmes: [] }],
    })
    const t = solveSafely(c)
    expect(t.unplaced[0].reason).toMatch(/belongs to another department/)
    expect(t.unplaced[0].suggestion).toMatch(/Room Exchange \(e\.g\. B-L\)/)
  })

  it('teacher weekly limit', () => {
    const c = tiny({
      dept: { teachers: [{ key: 'x', name: 'Teacher X', maxPerDay: 8, maxPerWeek: 2 }] },
      programmes: [{ name: 'P', shortName: 'P', sectionsCount: 1, defaultStrength: 40, subjects: [{ code: 'TH', name: 'Theory', kind: 'theory', periodsPerWeek: 3, teachers: ['x'] }] }],
    })
    const t = solveSafely(c)
    expect(unplacedPeriods(t)).toBe(1)
    expect(t.unplaced[0].reason).toMatch(/already teaches 2 of a maximum 2 periods a week/)
    expect(codes(c)).toContain('error:teacher-week')
  })

  it('teacher never available', () => {
    const c = tiny({
      dept: { teachers: [{ key: 'x', name: 'Teacher X', maxPerDay: 8, maxPerWeek: 20, unavailable: [0, 1].flatMap((d) => [0, 1, 2, 3].map((p) => [d, p] as [number, number])) }] },
      programmes: [{ name: 'P', shortName: 'P', sectionsCount: 1, defaultStrength: 40, subjects: [{ code: 'TH', name: 'Theory', kind: 'theory', periodsPerWeek: 1, teachers: ['x'] }] }],
    })
    const t = solveSafely(c)
    expect(t.unplaced[0].reason).toMatch(/Teacher X is never available/)
    expect(codes(c)).toContain('error:teacher-days')
  })

  it("section's week is full", () => {
    const c = tiny({
      programmes: [
        {
          name: 'P',
          shortName: 'P',
          sectionsCount: 1,
          defaultStrength: 40,
          subjects: [
            { code: 'T1', name: 'One', kind: 'theory', periodsPerWeek: 5, teachers: ['x'] },
            { code: 'T2', name: 'Two', kind: 'theory', periodsPerWeek: 4, teachers: ['y'] },
          ],
        },
      ],
    })
    const t = solveSafely(c)
    expect(unplacedPeriods(t)).toBe(1) // 9 periods in an 8-slot week
    expect(t.unplaced[0].reason).toMatch(/week is full/)
    expect(codes(c)).toContain('error:section-full')
  })

  it('a break leaves no room for a lab block', () => {
    const c = tiny({
      periods: 3,
      breaks: [{ period: 1 }],
      programmes: [{ name: 'P', shortName: 'P', sectionsCount: 1, defaultStrength: 40, subjects: [{ code: 'LB', name: 'Lab Work', kind: 'lab', periodsPerWeek: 2, teachers: ['x'] }] }],
      dept: { rooms: [{ name: 'A-LAB', type: 'lab', capacity: 60 }] },
    })
    const t = solveSafely(c)
    expect(t.unplaced[0].reason).toMatch(/2-period block/)
    expect(codes(c)).toContain('error:lab-block')
  })

  it('no teacher assigned', () => {
    const c = tiny({
      programmes: [{ name: 'P', shortName: 'P', sectionsCount: 2, defaultStrength: 40, subjects: [{ code: 'TH', name: 'Theory', kind: 'theory', periodsPerWeek: 2 }] }],
    })
    const t = solveSafely(c)
    expect(t.unplaced).toHaveLength(2)
    expect(t.unplaced[0].reason).toMatch(/No teacher assigned/)
    expect(preflight(c)).toEqual([expect.objectContaining({ level: 'warning', code: 'no-teacher', message: 'Theory has no teacher for 2 sections.' })])
  })
})

describe('T6b pre-flight', () => {
  it('both demo colleges pass with no errors', () => {
    for (const c of buildDemoColleges()) expect(preflight(c).filter((w) => w.level === 'error'), c.college.code).toEqual([])
  })

  it('flags an overloaded teacher with a fix', () => {
    const c = buildDemoColleges()[0]
    c.teachers.find((t) => t.id === 'diet-t-kaur')!.maxPerWeek = 5
    const w = preflight(c).find((x) => x.code === 'teacher-week')!
    expect(w.message).toBe('Dr. Harpreet Kaur is assigned 9 periods a week but the limit is 5.')
    expect(w.suggestion).toMatch(/move 4 periods/)
  })

  it('flags impossible semester dates', () => {
    const c = buildDemoColleges()[1]
    c.semester.endDate = '2026-01-01'
    expect(codes(c)).toContain('error:semester-dates')
  })
})

describe('repair step', () => {
  it('never makes things worse and never creates a clash (60 random colleges)', () => {
    const rng = mulberry32(77)
    let withRepair = 0
    let without = 0
    for (let i = 0; i < 60; i++) {
      const c = buildCollege(randomSpec(rng, i))
      const a = solve(c, { seed: 1 })
      const b = solve(c, { seed: 1, repair: false })
      expect(validate(c, a)).toEqual([])
      expect(placed(a) + unplacedPeriods(a)).toBe(curriculum(c))
      expect(unplacedPeriods(a)).toBeLessThanOrEqual(unplacedPeriods(b))
      withRepair += unplacedPeriods(a)
      without += unplacedPeriods(b)
    }
    expect(withRepair).toBeLessThanOrEqual(without)
  })
})
