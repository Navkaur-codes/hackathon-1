import { describe, expect, it } from 'vitest'
import type { Programme, Subject } from '../types'
import {
  assignmentId,
  breakSlots,
  buildCollege,
  effectiveBreaks,
  sectionBreakSlots,
  generateSections,
  periodTimes,
  sectionLetter,
  syncAssignments,
  type CollegeSpec,
} from './structure'

const programme = (sectionsCount: number, defaultStrength = 50): Programme => ({
  id: 'c-cse-y2',
  collegeId: 'c',
  deptId: 'c-cse',
  name: 'B.Tech Year 2',
  shortName: 'Y2',
  sectionsCount,
  defaultStrength,
})

const subject = (code: string, kind: Subject['kind'] = 'theory'): Subject => ({
  id: `c-cse-y2-${code.toLowerCase()}`,
  collegeId: 'c',
  deptId: 'c-cse',
  programmeId: 'c-cse-y2',
  code,
  name: code,
  kind,
  periodsPerWeek: kind === 'lab' ? 2 : 4,
  roomType: kind === 'lab' ? 'lab' : 'lecture',
})

describe('T0.3 generateSections', () => {
  it.each([1, 3, 7, 30])('creates exactly %i sections with the default strength', (n) => {
    const sections = generateSections(programme(n, 55), 'CSE')
    expect(sections).toHaveLength(n)
    expect(sections.every((s) => s.strength === 55)).toBe(true)
    expect(new Set(sections.map((s) => s.id)).size).toBe(n)
  })

  it('names sections DEPT-SHORT-LETTER and keeps going past Z', () => {
    const sections = generateSections(programme(28), 'CSE')
    expect(sections[0].name).toBe('CSE-Y2-A')
    expect(sections[25].name).toBe('CSE-Y2-Z')
    expect(sections[26].name).toBe('CSE-Y2-AA')
    expect(sectionLetter(27)).toBe('AB')
  })

  it('keeps edited names and strengths when the count changes', () => {
    const first = generateSections(programme(2), 'CSE')
    const edited = [{ ...first[0], name: 'CSE Alpha', strength: 62 }, first[1]]
    const grown = generateSections(programme(4), 'CSE', edited)
    expect(grown).toHaveLength(4)
    expect(grown[0]).toMatchObject({ name: 'CSE Alpha', strength: 62 })
    const shrunk = generateSections(programme(1), 'CSE', grown)
    expect(shrunk).toHaveLength(1)
    expect(shrunk[0].name).toBe('CSE Alpha')
  })
})

describe('T0.4 syncAssignments', () => {
  const sections = generateSections(programme(3), 'CSE')
  const subjects = [subject('DS'), subject('DBMS'), subject('DBL', 'lab')]

  it('makes exactly one assignment per section × subject', () => {
    const a = syncAssignments(sections, subjects)
    expect(a).toHaveLength(9)
    expect(new Set(a.map((x) => x.id)).size).toBe(9)
    expect(a.every((x) => x.teacherId === null)).toBe(true)
  })

  it('ignores subjects of other programmes', () => {
    const other = { ...subject('X'), id: 'c-cse-y3-x', programmeId: 'c-cse-y3' }
    expect(syncAssignments(sections, [...subjects, other])).toHaveLength(9)
  })

  it('keeps chosen teachers when subjects or sections are added and removed', () => {
    const a = syncAssignments(sections, subjects).map((x) =>
      x.id === assignmentId(sections[0].id, subjects[0].id) ? { ...x, teacherId: 't-kaur' } : x,
    )
    const withNewSubject = syncAssignments(sections, [...subjects, subject('OS')], a)
    expect(withNewSubject).toHaveLength(12)
    expect(withNewSubject.find((x) => x.teacherId === 't-kaur')).toBeDefined()

    const fewerSections = syncAssignments(sections.slice(0, 1), subjects.slice(0, 1), withNewSubject)
    expect(fewerSections).toEqual([expect.objectContaining({ teacherId: 't-kaur' })])
  })
})

describe('buildCollege', () => {
  const spec: CollegeSpec = {
    code: 'TST',
    name: 'Test College',
    calendar: {
      days: ['Mon', 'Tue', 'Wed', 'Thu'],
      periodsPerDay: 5,
      startTime: '09:00',
      periodMinutes: 50,
      breaks: [{ period: 2, label: 'Lunch' }],
      lunchWindow: [2, 3],
      teacherMinFreeInLunchWindow: 1,
      blockedSlots: [],
      labBlockLength: 2,
      maxMeetingRequestsPerStudent: 3,
    },
    sharedRooms: [{ name: 'Seminar Hall', type: 'seminar', capacity: 150 }],
    departments: [
      {
        code: 'BIO',
        name: 'Biology',
        rooms: [{ name: 'B-101', type: 'lecture', capacity: 60 }],
        teachers: [
          { key: 'rao', name: 'Dr. Rao', maxPerDay: 4, maxPerWeek: 16 },
          { key: 'sen', name: 'Dr. Sen', maxPerDay: 4, maxPerWeek: 16, unavailable: [[0, 0]] },
        ],
        programmes: [
          {
            name: 'BSc Year 1',
            shortName: 'Y1',
            sectionsCount: 2,
            defaultStrength: 45,
            subjects: [
              { code: 'CELL', name: 'Cell Biology', kind: 'theory', periodsPerWeek: 4, teachers: ['rao', 'sen'] },
              { code: 'GEN', name: 'Genetics', kind: 'theory', periodsPerWeek: 3 },
            ],
          },
        ],
      },
    ],
  }

  it('derives everything from the spec, scoped to one college', () => {
    const c = buildCollege(spec)
    expect(c.departments).toHaveLength(1)
    expect(c.sections.map((s) => s.name)).toEqual(['BIO-Y1-A', 'BIO-Y1-B'])
    expect(c.subjects).toHaveLength(2)
    expect(c.assignments).toHaveLength(4)
    expect(c.rooms.map((r) => r.owner)).toEqual(['shared', 'tst-bio'])
    const all = [c.calendar, ...c.departments, ...c.programmes, ...c.sections, ...c.subjects, ...c.teachers, ...c.rooms, ...c.assignments]
    expect(all.every((x) => x.collegeId === 'tst')).toBe(true)
  })

  it('assigns teachers round-robin per section and leaves the rest unassigned', () => {
    const c = buildCollege(spec)
    const cell = c.assignments.filter((a) => a.subjectId.endsWith('-cell')).map((a) => a.teacherId)
    expect(cell).toEqual(['tst-t-rao', 'tst-t-sen'])
    expect(c.assignments.filter((a) => a.subjectId.endsWith('-gen')).every((a) => a.teacherId === null)).toBe(true)
    expect(c.teachers[1].unavailable).toEqual(['0-0'])
  })

  it('rejects unknown teacher keys', () => {
    const bad = structuredClone(spec)
    bad.departments[0].programmes[0].subjects[0].teachers = ['nobody']
    expect(() => buildCollege(bad)).toThrow(/Unknown teacher/)
  })
})

describe('T0.6 periodTimes', () => {
  it('follows the calendar, honouring per-slot lengths (e.g. a 30-min lunch slot)', () => {
    const t = periodTimes({ periodsPerDay: 4, startTime: '09:30', periodMinutes: 60, periodLengths: [60, 60, 30] })
    expect(t.map((p) => `${p.start}-${p.end}`)).toEqual(['09:30-10:30', '10:30-11:30', '11:30-12:00', '12:00-13:00'])
  })
})

describe('T0.7 staggered breaks', () => {
  const calendar = { breaks: [{ period: 3 }] }

  it('resolves section → programme → department → college', () => {
    expect(effectiveBreaks(calendar)).toEqual([{ period: 3 }])
    expect(effectiveBreaks(calendar, { breaks: [{ period: 4 }] })).toEqual([{ period: 4 }])
    expect(effectiveBreaks(calendar, { breaks: [{ period: 4 }] }, { breaks: [{ period: 2 }] })).toEqual([{ period: 2 }])
    expect(
      effectiveBreaks(calendar, { breaks: [{ period: 4 }] }, { breaks: [{ period: 2 }] }, { breaks: [{ period: 5 }] }),
    ).toEqual([{ period: 5 }])
    // a level without its own rules inherits from above
    expect(effectiveBreaks(calendar, { breaks: [{ period: 4 }] }, {}, {})).toEqual([{ period: 4 }])
  })

  it('expands rules to slots, including day-specific breaks', () => {
    const slots = breakSlots([{ period: 3 }, { period: 4, days: [4] }], 5)
    expect([...slots].sort()).toEqual(['0-3', '1-3', '2-3', '3-3', '4-3', '4-4'])
  })

  it('ignores days the college does not work', () => {
    expect([...breakSlots([{ period: 1, days: [0, 6] }], 5)]).toEqual(['0-1'])
  })

  it('gives different departments different break slots in one college', () => {
    const c = buildCollege({
      code: 'STG',
      name: 'Staggered',
      calendar: {
        days: ['Mon', 'Tue'],
        periodsPerDay: 6,
        startTime: '09:00',
        periodMinutes: 50,
        breaks: [{ period: 3 }],
        lunchWindow: [3, 4],
        teacherMinFreeInLunchWindow: 1,
        blockedSlots: [],
        labBlockLength: 2,
        maxMeetingRequestsPerStudent: 3,
      },
      sharedRooms: [],
      departments: [
        { code: 'A', name: 'A', rooms: [], teachers: [], programmes: [{ name: 'Y1', shortName: 'Y1', sectionsCount: 1, defaultStrength: 30, subjects: [] }] },
        {
          code: 'B',
          name: 'B',
          breaks: [{ period: 4 }],
          rooms: [],
          teachers: [],
          programmes: [{ name: 'Y1', shortName: 'Y1', sectionsCount: 1, defaultStrength: 30, subjects: [] }],
        },
      ],
    })
    const [a, b] = c.sections
    expect([...sectionBreakSlots(c, a)]).toEqual(['0-3', '1-3'])
    expect([...sectionBreakSlots(c, b)]).toEqual(['0-4', '1-4'])
  })
})
