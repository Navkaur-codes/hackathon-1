// Turns a college's structure (as the Super Admin defines it) into concrete records.
// This is the ONLY way college data is created — demo data included (rule G3).

import type {
  Assignment,
  BreakRule,
  Calendar,
  CollegeData,
  Department,
  Id,
  Programme,
  Room,
  RoomType,
  Section,
  SlotKey,
  Subject,
  SubjectKind,
  Semester,
  Teacher,
} from '../types'
import { semesterSummary } from './semester'

// ── Small helpers ─────────────────────────────────────────────────────

export const slotKey = (day: number, period: number): SlotKey => `${day}-${period}`

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** 0 → A, 25 → Z, 26 → AA … so any number of sections gets a letter. */
export function sectionLetter(index: number): string {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

/** Start/end clock times of every slot in the shared grid (break slots included). */
export function periodTimes(calendar: Pick<Calendar, 'periodsPerDay' | 'startTime' | 'periodMinutes' | 'periodLengths'>) {
  const [h, m] = calendar.startTime.split(':').map(Number)
  let t = h * 60 + m
  const fmt = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
  return Array.from({ length: calendar.periodsPerDay }, (_, p) => {
    const start = t
    t += calendar.periodLengths?.[p] ?? calendar.periodMinutes
    return { index: p, start: fmt(start), end: fmt(t) }
  })
}

// ── Breaks (rule H7: section → programme → department → college) ──────

type HasBreaks = { breaks?: BreakRule[] }

/** The break rules that apply to a section: the most specific level that defines any wins. */
export function effectiveBreaks(
  calendar: Pick<Calendar, 'breaks'>,
  dept?: HasBreaks,
  programme?: HasBreaks,
  section?: HasBreaks,
): BreakRule[] {
  return section?.breaks ?? programme?.breaks ?? dept?.breaks ?? calendar.breaks
}

/** Expand break rules into concrete slot keys for the given number of working days. */
export function breakSlots(rules: BreakRule[], dayCount: number): Set<SlotKey> {
  const out = new Set<SlotKey>()
  for (const r of rules) {
    const days = r.days ?? Array.from({ length: dayCount }, (_, d) => d)
    for (const d of days) if (d >= 0 && d < dayCount) out.add(slotKey(d, r.period))
  }
  return out
}

/** Break slots for one section of a college, resolved through the inheritance chain. */
export function sectionBreakSlots(college: Pick<CollegeData, 'calendar' | 'departments' | 'programmes'>, section: Section): Set<SlotKey> {
  const dept = college.departments.find((d) => d.id === section.deptId)
  const programme = college.programmes.find((p) => p.id === section.programmeId)
  return breakSlots(effectiveBreaks(college.calendar, dept, programme, section), college.calendar.days.length)
}

/** At-a-glance numbers for a college card — all derived from data, never typed in. */
export function summarizeCollege(c: CollegeData) {
  const times = periodTimes(c.calendar)
  const breakSets = new Set(c.sections.map((s) => [...sectionBreakSlots(c, s)].sort().join(',')))
  return {
    days: c.calendar.days.length,
    dayRange: c.calendar.days.length ? `${c.calendar.days[0]}–${c.calendar.days[c.calendar.days.length - 1]}` : '—',
    slotsPerDay: c.calendar.periodsPerDay,
    hours: times.length ? `${times[0].start}–${times[times.length - 1].end}` : '—',
    departments: c.departments.map((d) => d.code),
    sections: c.sections.length,
    students: c.sections.reduce((sum, s) => sum + s.strength, 0),
    subjects: c.subjects.length,
    teachers: c.teachers.length,
    rooms: c.rooms.length,
    sharedRooms: c.rooms.filter((r) => r.owner === 'shared').length,
    staggeredBreaks: breakSets.size > 1,
    semester: semesterSummary(c),
  }
}

// ── Sections ──────────────────────────────────────────────────────────

/**
 * Exactly `programme.sectionsCount` sections. Sections that already exist (by position) keep their
 * edited name and strength; new ones get `${DEPT}-${SHORT}-${letter}` and the default strength.
 */
export function generateSections(programme: Programme, deptCode: string, existing: Section[] = []): Section[] {
  const mine = existing.filter((s) => s.programmeId === programme.id)
  return Array.from({ length: programme.sectionsCount }, (_, i) => {
    const letter = sectionLetter(i)
    const id = `${programme.id}-${letter.toLowerCase()}`
    const prev = mine.find((s) => s.id === id)
    return (
      prev ?? {
        id,
        collegeId: programme.collegeId,
        deptId: programme.deptId,
        programmeId: programme.id,
        name: `${deptCode}-${programme.shortName}-${letter}`,
        strength: programme.defaultStrength,
      }
    )
  })
}

// ── Assignments (section × subject → teacher) ─────────────────────────

export const assignmentId = (sectionId: Id, subjectId: Id) => `${sectionId}--${subjectId}`

/**
 * Exactly one assignment per section × subject of that section's programme.
 * Keeps teachers already chosen, adds new pairs (teacher = null), drops pairs that no longer exist.
 */
export function syncAssignments(sections: Section[], subjects: Subject[], existing: Assignment[] = []): Assignment[] {
  const byId = new Map(existing.map((a) => [a.id, a]))
  const out: Assignment[] = []
  for (const section of sections) {
    for (const subject of subjects) {
      if (subject.programmeId !== section.programmeId) continue
      const id = assignmentId(section.id, subject.id)
      out.push(
        byId.get(id) ?? { id, collegeId: section.collegeId, sectionId: section.id, subjectId: subject.id, teacherId: null },
      )
    }
  }
  return out
}

// ── Building a whole college from a spec ──────────────────────────────

export type RoomSpec = { name: string; type: RoomType; capacity: number }

export type TeacherSpec = {
  /** Short key, unique within the college; used by subjects to pick teachers. */
  key: string
  name: string
  maxPerDay: number
  maxPerWeek: number
  /** [dayIndex, periodIndex] pairs the teacher cannot teach. */
  unavailable?: [number, number][]
}

export type SubjectSpec = {
  code: string
  name: string
  kind: SubjectKind
  periodsPerWeek: number
  blockLength?: number
  roomType?: RoomType
  /** Teacher key(s); section i gets teachers[i % length]. May name a teacher of another department. */
  teachers?: string[]
}

export type ProgrammeSpec = {
  name: string
  shortName: string
  sectionsCount: number
  defaultStrength: number
  breaks?: BreakRule[]
  subjects: SubjectSpec[]
}

export type DepartmentSpec = {
  code: string
  name: string
  breaks?: BreakRule[]
  rooms: RoomSpec[]
  teachers: TeacherSpec[]
  programmes: ProgrammeSpec[]
}

export type CollegeSpec = {
  code: string
  name: string
  calendar: Omit<Calendar, 'collegeId'>
  semester: Omit<Semester, 'collegeId'>
  sharedRooms: RoomSpec[]
  departments: DepartmentSpec[]
}

export function buildCollege(spec: CollegeSpec): CollegeData {
  const cid = slug(spec.code)
  const college = { id: cid, code: spec.code, name: spec.name, status: 'active' as const, collegeAdminIds: [] }
  const calendar: Calendar = { ...spec.calendar, collegeId: cid }
  const semester: Semester = { ...spec.semester, collegeId: cid }

  const departments: Department[] = []
  const programmes: Programme[] = []
  const subjects: Subject[] = []
  const teachers: Teacher[] = []
  const rooms: Room[] = spec.sharedRooms.map((r) => ({
    id: `${cid}-rm-${slug(r.name)}`,
    collegeId: cid,
    ...r,
    owner: 'shared' as const,
  }))
  const teacherIdByKey = new Map<string, Id>()
  const subjectTeachers = new Map<Id, string[]>()

  for (const d of spec.departments) {
    const deptId = `${cid}-${slug(d.code)}`
    departments.push({ id: deptId, collegeId: cid, code: d.code, name: d.name, status: 'draft', breaks: d.breaks })

    for (const r of d.rooms) {
      rooms.push({ id: `${cid}-rm-${slug(r.name)}`, collegeId: cid, ...r, owner: deptId })
    }
    for (const t of d.teachers) {
      const id = `${cid}-t-${slug(t.key)}`
      teacherIdByKey.set(t.key, id)
      teachers.push({
        id,
        collegeId: cid,
        deptId,
        name: t.name,
        maxPerDay: t.maxPerDay,
        maxPerWeek: t.maxPerWeek,
        unavailable: (t.unavailable ?? []).map(([day, period]) => slotKey(day, period)),
      })
    }
    for (const p of d.programmes) {
      const programmeId = `${deptId}-${slug(p.shortName)}`
      programmes.push({
        id: programmeId,
        collegeId: cid,
        deptId,
        name: p.name,
        shortName: p.shortName,
        sectionsCount: p.sectionsCount,
        defaultStrength: p.defaultStrength,
        breaks: p.breaks,
      })
      for (const s of p.subjects) {
        const id = `${programmeId}-${slug(s.code)}`
        subjects.push({
          id,
          collegeId: cid,
          deptId,
          programmeId,
          code: s.code,
          name: s.name,
          kind: s.kind,
          periodsPerWeek: s.periodsPerWeek,
          blockLength: s.blockLength,
          roomType: s.roomType ?? (s.kind === 'lab' ? 'lab' : 'lecture'),
        })
        if (s.teachers?.length) subjectTeachers.set(id, s.teachers)
      }
    }
  }

  const deptCode = new Map(departments.map((d) => [d.id, d.code]))
  const sections = programmes.flatMap((p) => generateSections(p, deptCode.get(p.deptId) ?? p.deptId))

  // Pick teachers per section from the spec (round-robin), everything else stays unassigned.
  const sectionIndex = new Map<Id, number>()
  for (const p of programmes) sections.filter((s) => s.programmeId === p.id).forEach((s, i) => sectionIndex.set(s.id, i))
  const assignments = syncAssignments(sections, subjects).map((a) => {
    const keys = subjectTeachers.get(a.subjectId)
    if (!keys) return a
    const key = keys[(sectionIndex.get(a.sectionId) ?? 0) % keys.length]
    const teacherId = teacherIdByKey.get(key)
    if (!teacherId) throw new Error(`Unknown teacher "${key}" for subject ${a.subjectId}`)
    return { ...a, teacherId }
  })

  return {
    college,
    calendar,
    semester,
    departments,
    programmes,
    sections,
    subjects,
    teachers,
    rooms,
    assignments,
    grants: [],
    leaves: [],
    substitutions: [],
    officeHours: [],
    meetings: [],
  }
}
