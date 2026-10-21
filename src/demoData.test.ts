import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from './demoData'
import { sectionBreakSlots, summarizeCollege } from './lib/structure'
import type { CollegeData } from './types'

const colleges = buildDemoColleges()

/** Every record of a college, flattened, for generic checks. */
const recordsOf = (c: CollegeData) => [
  c.calendar,
  ...c.departments,
  ...c.programmes,
  ...c.sections,
  ...c.subjects,
  ...c.teachers,
  ...c.rooms,
  ...c.assignments,
]

describe('T0.2 demo data sanity', () => {
  it('has two colleges of different shapes', () => {
    expect(colleges).toHaveLength(2)
    const [a, b] = colleges
    expect(a.calendar.days.length).not.toBe(b.calendar.days.length)
    expect(a.calendar.periodsPerDay).not.toBe(b.calendar.periodsPerDay)
    expect(a.departments.length).not.toBe(b.departments.length)
  })

  it('uses ids that are unique across the whole platform', () => {
    const ids = colleges.flatMap((c) =>
      [...c.departments, ...c.programmes, ...c.sections, ...c.subjects, ...c.teachers, ...c.rooms, ...c.assignments].map(
        (r) => r.id,
      ),
    )
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(colleges.map((c) => [c.college.code, c] as const))('%s: every record belongs to the college', (_, c) => {
    expect(recordsOf(c).every((r) => r.collegeId === c.college.id)).toBe(true)
  })

  it.each(colleges.map((c) => [c.college.code, c] as const))('%s: every reference resolves inside the college', (_, c) => {
    const has = (list: { id: string }[]) => new Set(list.map((x) => x.id))
    const depts = has(c.departments)
    const progs = has(c.programmes)
    const secs = has(c.sections)
    const subs = has(c.subjects)
    const teachers = has(c.teachers)

    for (const p of c.programmes) expect(depts.has(p.deptId)).toBe(true)
    for (const s of c.sections) expect(depts.has(s.deptId) && progs.has(s.programmeId)).toBe(true)
    for (const s of c.subjects) expect(depts.has(s.deptId) && progs.has(s.programmeId)).toBe(true)
    for (const t of c.teachers) expect(depts.has(t.deptId)).toBe(true)
    for (const r of c.rooms) expect(r.owner === 'shared' || depts.has(r.owner)).toBe(true)
    for (const a of c.assignments) {
      expect(secs.has(a.sectionId) && subs.has(a.subjectId)).toBe(true)
      expect(a.teacherId && teachers.has(a.teacherId)).toBeTruthy()
    }
  })

  it.each(colleges.map((c) => [c.college.code, c] as const))(
    '%s: every subject has a room of its type its department may use, big enough for each section',
    (_, c) => {
      for (const a of c.assignments) {
        const section = c.sections.find((s) => s.id === a.sectionId)!
        const subject = c.subjects.find((s) => s.id === a.subjectId)!
        const usable = c.rooms.filter(
          (r) =>
            r.type === subject.roomType &&
            (r.owner === 'shared' || r.owner === section.deptId) &&
            r.capacity >= section.strength,
        )
        expect(usable.length, `${section.name} · ${subject.code}`).toBeGreaterThan(0)
      }
    },
  )

  it.each(colleges.map((c) => [c.college.code, c] as const))(
    '%s: teacher loads fit their weekly limits and the days they can work',
    (_, c) => {
      for (const t of c.teachers) {
        const load = c.assignments
          .filter((a) => a.teacherId === t.id)
          .reduce((sum, a) => sum + c.subjects.find((s) => s.id === a.subjectId)!.periodsPerWeek, 0)
        const fullyUnavailableDays = c.calendar.days.filter((_, d) =>
          Array.from({ length: c.calendar.periodsPerDay }, (_, p) => `${d}-${p}`).every((k) =>
            t.unavailable.includes(k as `${number}-${number}`),
          ),
        ).length
        const workableDays = c.calendar.days.length - fullyUnavailableDays
        expect(load, t.name).toBeLessThanOrEqual(t.maxPerWeek)
        expect(load, t.name).toBeLessThanOrEqual(t.maxPerDay * workableDays)
      }
    },
  )

  it.each(colleges.map((c) => [c.college.code, c] as const))(
    '%s: each section needs fewer periods than it has non-break slots',
    (_, c) => {
      const totalSlots = c.calendar.days.length * c.calendar.periodsPerDay
      for (const section of c.sections) {
        const demand = c.subjects
          .filter((s) => s.programmeId === section.programmeId)
          .reduce((sum, s) => sum + s.periodsPerWeek, 0)
        const free = totalSlots - sectionBreakSlots(c, section).size - c.calendar.blockedSlots.length
        expect(demand, section.name).toBeLessThan(free)
      }
    },
  )

  it('engineering demo staggers lunch between departments', () => {
    const eng = colleges[0]
    const lunchOf = (code: string) => {
      const section = eng.sections.find((s) => s.name.startsWith(`${code}-`))!
      return [...sectionBreakSlots(eng, section)][0]
    }
    expect(lunchOf('CSE')).toBe('0-3')
    expect(lunchOf('ECE')).toBe('0-4')
    expect(lunchOf('ME')).toBe('0-3')
  })

  it('summarizeCollege derives the card numbers from data', () => {
    const [eng, arts] = colleges.map(summarizeCollege)
    expect(eng).toMatchObject({ days: 6, dayRange: 'Mon–Sat', slotsPerDay: 7, departments: ['CSE', 'ECE', 'ME'], sections: 7, sharedRooms: 3, staggeredBreaks: true })
    expect(eng.students).toBe(colleges[0].sections.reduce((s, x) => s + x.strength, 0))
    expect(arts).toMatchObject({ days: 5, dayRange: 'Mon–Fri', slotsPerDay: 6, hours: '09:30–14:35', departments: ['COM', 'ENG'], sections: 4, staggeredBreaks: false })
  })

  it('has at least one teacher teaching across departments in each college', () => {
    for (const c of colleges) {
      const crossDept = c.assignments.some((a) => {
        const teacher = c.teachers.find((t) => t.id === a.teacherId)!
        const section = c.sections.find((s) => s.id === a.sectionId)!
        return teacher.deptId !== section.deptId
      })
      expect(crossDept, c.college.code).toBe(true)
    }
  })
})
