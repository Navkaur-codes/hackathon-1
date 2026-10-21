import { describe, expect, it } from 'vitest'
import { buildCollege, type CollegeSpec } from '../lib/structure'
import type { CollegeData, Placement, Timetable } from '../types'
import { validate, type HardRule } from './validate'

// Two departments with staggered breaks: A breaks at P3 (index 2), B at P4 (index 3).
// Teacher t1 belongs to A but also teaches section B (cross-department).
const spec: CollegeSpec = {
  code: 'FX',
  name: 'Fixture College',
  calendar: {
    days: ['Mon', 'Tue'],
    weekdays: [1, 2],
    periodsPerDay: 6,
    startTime: '09:00',
    periodMinutes: 50,
    breaks: [{ period: 2 }],
    lunchWindow: [2, 3],
    teacherMinFreeInLunchWindow: 1,
    blockedSlots: [],
    labBlockLength: 2,
    maxMeetingRequestsPerStudent: 3,
  },
  semester: { name: 'Test semester', startDate: '2026-07-20', endDate: '2026-08-16', holidays: [], noClassDates: [] },
  sharedRooms: [{ name: 'Hall', type: 'lecture', capacity: 100 }],
  departments: [
    {
      code: 'A',
      name: 'Dept A',
      rooms: [
        { name: 'A-LEC', type: 'lecture', capacity: 40 },
        { name: 'A-LAB', type: 'lab', capacity: 40 },
      ],
      teachers: [
        { key: 't1', name: 'T One', maxPerDay: 3, maxPerWeek: 5, unavailable: [[1, 5]] },
        { key: 't2', name: 'T Two', maxPerDay: 4, maxPerWeek: 10 },
      ],
      programmes: [
        {
          name: 'A Year 1',
          shortName: 'Y1',
          sectionsCount: 1,
          defaultStrength: 35,
          subjects: [
            { code: 'TH', name: 'Theory', kind: 'theory', periodsPerWeek: 3, teachers: ['t1'] },
            { code: 'LAB', name: 'Lab', kind: 'lab', periodsPerWeek: 2, teachers: ['t2'] },
          ],
        },
      ],
    },
    {
      code: 'B',
      name: 'Dept B',
      breaks: [{ period: 3 }],
      rooms: [{ name: 'B-LEC', type: 'lecture', capacity: 30 }],
      teachers: [{ key: 't3', name: 'T Three', maxPerDay: 4, maxPerWeek: 10 }],
      programmes: [
        {
          name: 'B Year 1',
          shortName: 'Y1',
          sectionsCount: 1,
          defaultStrength: 25,
          subjects: [
            { code: 'BT', name: 'B Theory', kind: 'theory', periodsPerWeek: 2, teachers: ['t3'] },
            { code: 'CROSS', name: 'Cross Theory', kind: 'theory', periodsPerWeek: 1, teachers: ['t1'] },
          ],
        },
      ],
    },
  ],
}

const A = { TH: 'fx-a-y1-a--fx-a-y1-th', LAB: 'fx-a-y1-a--fx-a-y1-lab' }
const B = { BT: 'fx-b-y1-a--fx-b-y1-bt', CROSS: 'fx-b-y1-a--fx-b-y1-cross' }
const R = { HALL: 'fx-rm-hall', ALEC: 'fx-rm-a-lec', ALAB: 'fx-rm-a-lab', BLEC: 'fx-rm-b-lec' }

const place = (assignmentId: string, day: number, period: number, roomId: string, length = 1): Placement => ({
  assignmentId,
  collegeId: 'fx',
  deptId: assignmentId.startsWith('fx-a') ? 'fx-a' : 'fx-b',
  day,
  period,
  length,
  roomId,
  locked: false,
})

const clean = (): Placement[] => [
  place(A.TH, 0, 0, R.ALEC),
  place(A.TH, 0, 1, R.ALEC),
  place(A.TH, 1, 0, R.ALEC),
  place(A.LAB, 0, 3, R.ALAB, 2),
  place(B.BT, 0, 0, R.BLEC),
  place(B.BT, 1, 1, R.BLEC),
  place(B.CROSS, 1, 4, R.BLEC),
]

const tt = (placements: Placement[], collegeId = 'fx'): Timetable => ({ collegeId, seed: 1, placements, unplaced: [] })

/** Replace the placement at `index` of the clean timetable with changed fields. */
const tweak = (index: number, change: Partial<Placement>) => clean().map((p, i) => (i === index ? { ...p, ...change } : p))

const rules = (college: CollegeData, placements: Placement[]) => [...new Set(validate(college, tt(placements)).map((c) => c.rule))].sort()

const fresh = () => buildCollege(spec)

describe('validate — clean timetable', () => {
  it('reports no conflicts', () => {
    expect(validate(fresh(), tt(clean()))).toEqual([])
  })
})

describe('T2 validator detects each hard rule', () => {
  const cases: [HardRule, string, () => [CollegeData, Placement[]]][] = [
    ['H1', 'teacher double-booked across departments (t1 teaches A and B at Mon P2)', () => [fresh(), [...clean().filter((p) => p.assignmentId !== B.CROSS), place(B.CROSS, 0, 1, R.BLEC)]]],
    ['H2', 'section double-booked (B at Tue P2 twice, different teachers)', () => [fresh(), tweak(6, { day: 1, period: 1, roomId: R.HALL })]],
    ['H3', 'room double-booked across departments (Hall at Mon P2)', () => [fresh(), [...clean().map((p, i) => (i === 1 ? { ...p, roomId: R.HALL } : i === 5 ? { ...p, day: 0, period: 1, roomId: R.HALL } : p))]]],
    ['H4', 'lab in a lecture room', () => [fresh(), tweak(3, { roomId: R.HALL })]],
    ['H5', 'room too small (35 students in a 30-seat room)', () => {
      const c = fresh()
      c.grants.push({ id: 'g', collegeId: 'fx', roomId: R.BLEC, fromDeptId: 'fx-b', toDeptId: 'fx-a', slots: 'all', status: 'approved' })
      return [c, tweak(2, { roomId: R.BLEC })]
    }],
    ['H6', 'teacher unavailable slot', () => [fresh(), tweak(6, { period: 5 })]],
    ['H7', "class in the section's own break (A at P3)", () => [fresh(), tweak(1, { period: 2 })]],
    ['H8', "lab block crossing the section's break", () => [fresh(), tweak(3, { period: 1 })]],
    ['H9', 'teacher over the daily limit (t1: 4 periods on Mon)', () => [fresh(), [...clean().map((p, i) => (i === 2 ? { ...p, day: 0, period: 5 } : i === 6 ? { ...p, day: 0, period: 4 } : p))]]],
    ['H11', "B section in A's room without a grant", () => [fresh(), tweak(5, { roomId: R.ALEC })]],
    ['H12', 'more periods than the curriculum', () => [fresh(), [...clean(), place(A.TH, 1, 1, R.ALEC)]]],
    ['H14', 'shared teacher left without lunch (t1 busy at both lunch-window slots on Mon)', () => [
      fresh(),
      [
        place(A.TH, 0, 0, R.ALEC),
        place(A.TH, 1, 0, R.ALEC),
        place(A.TH, 0, 3, R.ALEC),
        place(A.LAB, 1, 3, R.ALAB, 2),
        place(B.BT, 0, 0, R.BLEC),
        place(B.BT, 1, 1, R.BLEC),
        place(B.CROSS, 0, 2, R.BLEC),
      ],
    ]],
  ]

  it.each(cases)('%s — %s', (rule, _, build) => {
    const [college, placements] = build()
    expect(rules(college, placements)).toContain(rule)
  })

  it('H1/H2/H3/H11/H14 cases report only their own rule', () => {
    for (const rule of ['H1', 'H2', 'H3', 'H11', 'H14'] as HardRule[]) {
      const [college, placements] = cases.find(([r]) => r === rule)![2]()
      expect(rules(college, placements), rule).toEqual([rule])
    }
  })

  it('H6 — leave applies only when checking that date, never the weekly master', () => {
    const leave = [{ teacherId: 'fx-t-t2', day: 0 }]
    expect(validate(fresh(), tt(clean()))).toEqual([])
    expect(validate(fresh(), tt(clean()), { leave }).map((c) => c.rule)).toEqual(['H6'])
    // the adjusted timetable for that date moves the lab to Tuesday → clean again
    expect(validate(fresh(), tt(tweak(3, { day: 1 })), { leave })).toEqual([])
  })

  it('H7 — college-wide blocked slot', () => {
    const c = fresh()
    c.calendar.blockedSlots = ['1-0']
    expect(rules(c, clean())).toEqual(['H7'])
  })

  it('H7 — staggered breaks: B may use P3 (A’s break) but not P4', () => {
    expect(rules(fresh(), tweak(6, { period: 2 }))).toEqual([])
    expect(rules(fresh(), tweak(6, { period: 3 }))).toEqual(['H7'])
  })

  it('H8 — theory longer than one period, lab past the day end, lab split in two short blocks', () => {
    expect(rules(fresh(), tweak(0, { length: 2 }))).toContain('H8')
    expect(rules(fresh(), tweak(3, { period: 5 }))).toContain('H8')
    const split = [...clean().filter((p) => p.assignmentId !== A.LAB), place(A.LAB, 0, 3, R.ALAB), place(A.LAB, 0, 4, R.ALAB)]
    expect(rules(fresh(), split)).toEqual(['H8'])
  })

  it('H9 — teacher over the weekly limit', () => {
    const c = fresh()
    c.teachers.find((t) => t.id === 'fx-t-t1')!.maxPerWeek = 3
    expect(rules(c, clean())).toEqual(['H9'])
  })

  it('H10 — a locked class that moved', () => {
    const locked = { ...clean()[0], locked: true }
    expect(validate(fresh(), tt(clean()), { mustKeep: [locked] })).toEqual([])
    const moved = validate(fresh(), tt(tweak(0, { period: 4 })), { mustKeep: [locked] })
    expect(moved.map((c) => c.rule)).toContain('H10')
  })

  it('H11 — an approved grant (slot or whole week) makes the borrowed room legal', () => {
    const c = fresh()
    c.grants.push({ id: 'g', collegeId: 'fx', roomId: R.ALEC, fromDeptId: 'fx-a', toDeptId: 'fx-b', slots: ['1-1'], status: 'approved' })
    expect(rules(c, tweak(5, { roomId: R.ALEC }))).toEqual([])
    c.grants[0].status = 'revoked'
    expect(rules(c, tweak(5, { roomId: R.ALEC }))).toEqual(['H11'])
  })

  it('H12 — unknown assignment, unknown room, outside the week, unassigned teacher', () => {
    expect(rules(fresh(), [...clean(), place('nope', 0, 5, R.HALL)])).toEqual(['H12'])
    expect(rules(fresh(), tweak(0, { roomId: 'nope' }))).toEqual(['H12'])
    expect(rules(fresh(), tweak(0, { day: 7 }))).toEqual(['H12'])
    const c = fresh()
    c.assignments.find((a) => a.id === B.BT)!.teacherId = null
    expect(rules(c, clean())).toEqual(['H12'])
  })

  it('H13 — a room of another college, or a timetable of another college', () => {
    const c = fresh()
    c.rooms.push({ id: 'other-rm', collegeId: 'other', name: 'Other', type: 'lecture', capacity: 99, owner: 'shared' })
    expect(rules(c, tweak(2, { roomId: 'other-rm' }))).toEqual(['H13'])
    expect(validate(fresh(), tt(clean(), 'other')).map((x) => x.rule)).toEqual(['H13'])
  })

  it('conflicts name the clashing classes in plain language', () => {
    const [college, placements] = cases[0][2]()
    const [c] = validate(college, tt(placements))
    expect(c.message).toBe('T One is double-booked at Mon P2.')
    expect(c.assignmentIds.sort()).toEqual([A.TH, B.CROSS].sort())
  })
})
