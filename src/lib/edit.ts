// Pure edits on one college (the store only routes them, rule G1). P0.4-b: create, clone, archive;
// P0.4-c adds structure edits. Everything new still goes through `buildCollege` (rule G3).

import type { BreakRule, Calendar, CollegeData, Id, Programme, Room, Semester, SlotKey, Subject } from '../types'
import { buildCollege, generateSections, slotKey, slug, syncAssignments, type CollegeSpec } from './structure'

/** Why `code` cannot name a new college, or null. Ids are prefixed by the college id, so prefixes must not overlap. */
export function codeProblem(code: string, colleges: CollegeData[]): string | null {
  const id = slug(code)
  if (!id) return 'Give the college a short code, e.g. GNDEC.'
  if (id.length > 12) return 'Keep the code to 12 letters or fewer.'
  for (const c of colleges) {
    const other = c.college.id
    if (other === id) return `${c.college.code} is already used by ${c.college.name}.`
    if (id.startsWith(`${other}-`) || other.startsWith(`${id}-`))
      return `"${code}" is too close to ${c.college.code} — record ids would mix. Pick another code.`
  }
  return null
}

/** ISO date + n days (UTC, so it never shifts with the time zone). */
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * A small blank college to shape in the Structure Builder: five working days, six slots with a lunch slot,
 * one department, programme, section, two subjects, two teachers and a room. Solvable as it stands.
 * `today` (ISO date) starts a ~16-week semester; passed in so this stays pure.
 */
export function templateSpec(code: string, name: string, today: string): CollegeSpec {
  return {
    code,
    name,
    calendar: {
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      weekdays: [1, 2, 3, 4, 5],
      periodsPerDay: 6,
      startTime: '09:00',
      periodMinutes: 50,
      breaks: [{ period: 3, label: 'Lunch' }],
      lunchWindow: [3],
      teacherMinFreeInLunchWindow: 1,
      blockedSlots: [],
      labBlockLength: 2,
      maxMeetingRequestsPerStudent: 3,
    },
    semester: { name: `Semester ${today.slice(0, 4)}`, startDate: today, endDate: addDays(today, 111), holidays: [], noClassDates: [] },
    sharedRooms: [],
    departments: [
      {
        code: 'GEN',
        name: 'General Studies',
        rooms: [{ name: 'Room 101', type: 'lecture', capacity: 60 }],
        teachers: [
          { key: 't1', name: 'Teacher One', maxPerDay: 4, maxPerWeek: 16 },
          { key: 't2', name: 'Teacher Two', maxPerDay: 4, maxPerWeek: 16 },
        ],
        programmes: [
          {
            name: 'Year 1',
            shortName: 'Y1',
            sectionsCount: 1,
            defaultStrength: 40,
            subjects: [
              { code: 'ENG', name: 'English', kind: 'theory', periodsPerWeek: 4, teachers: ['t1'] },
              { code: 'MATH', name: 'Mathematics', kind: 'theory', periodsPerWeek: 4, teachers: ['t2'] },
            ],
          },
        ],
      },
    ],
  }
}

export const newCollege = (code: string, name: string, today: string): CollegeData =>
  buildCollege(templateSpec(code, name, today))

/** Re-prefix every id-like string of the old college (`old` or `old-…`) to the new one. */
function reId<T>(value: T, from: Id, to: Id): T {
  if (typeof value === 'string')
    return (value === from ? to : value.startsWith(`${from}-`) ? `${to}${value.slice(from.length)}` : value) as T
  if (Array.isArray(value)) return value.map((v) => reId(v, from, to)) as T
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, reId(v, from, to)])) as T
  return value
}

/**
 * Copy a college's structure and setup (calendar, semester, departments, programmes, sections, subjects,
 * teachers, rooms, assignments, grants, office hours) under a new code. Date-specific records (leave,
 * substitutions, meetings) and timetables are not copied — the clone starts unpublished.
 */
export function cloneCollege(source: CollegeData, code: string, name: string): CollegeData {
  const to = slug(code)
  const copy = reId(
    {
      calendar: source.calendar,
      semester: source.semester,
      departments: source.departments,
      programmes: source.programmes,
      sections: source.sections,
      subjects: source.subjects,
      teachers: source.teachers,
      rooms: source.rooms,
      assignments: source.assignments,
      grants: source.grants,
      officeHours: source.officeHours,
    },
    source.college.id,
    to,
  )
  return {
    ...copy,
    college: { id: to, code, name, status: 'active', collegeAdminIds: [] },
    departments: copy.departments.map((d) => ({ ...d, status: 'draft' })),
    leaves: [],
    substitutions: [],
    meetings: [],
  }
}

export const setArchived = (c: CollegeData, archived: boolean): CollegeData => ({
  ...c,
  college: { ...c.college, status: archived ? 'archived' : 'active' },
})

/** College Admin display names (real accounts are linked in v0.9). Blank and repeated names are dropped. */
export const setCollegeAdmins = (c: CollegeData, names: string[]): CollegeData => ({
  ...c,
  college: { ...c.college, collegeAdminIds: [...new Set(names.map((n) => n.trim()).filter(Boolean))] },
})

// ── Structure edits (Super Admin, P0.4-c) ─────────────────────────────
// Every edit keeps the college consistent: sections regenerate from their programme, assignments re-sync
// (chosen teachers kept), day / slot indexes everywhere follow the calendar, and a stored draft goes stale.

/** Labels for the working-day picker: real weekdays 0 = Sunday … 6 = Saturday (the world's week, not a college's). */
export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(n) ? n : lo)))

/** Any structure change makes an existing draft stale (it stays viewable; publish needs a fresh generate). */
const touched = (c: CollegeData): CollegeData => (c.draft ? { ...c, draftStale: true } : c)

/** Sections from their programmes (survivors keep edits), then exactly one assignment per section × subject. */
function resync(c: CollegeData): CollegeData {
  const deptCode = new Map(c.departments.map((d) => [d.id, d.code]))
  const sections = c.programmes.flatMap((p) => generateSections(p, deptCode.get(p.deptId) ?? p.deptId, c.sections))
  const subjects = c.subjects.filter((s) => c.programmes.some((p) => p.id === s.programmeId))
  return touched({ ...c, sections, subjects, assignments: syncAssignments(sections, subjects, c.assignments) })
}

// ── Reshaping the week: days and slots ──

/** Move every day/slot reference through `day` (old index → new index or null = gone) within `slots` slots a day. */
function reshape(c: CollegeData, day: (d: number) => number | null, slots: number): CollegeData {
  const key = (k: SlotKey): SlotKey | null => {
    const [d, p] = k.split('-').map(Number)
    const nd = day(d)
    return nd === null || p >= slots ? null : slotKey(nd, p)
  }
  const keys = (ks: SlotKey[]) => ks.map(key).filter((k): k is SlotKey => k !== null)
  const rules = (rs?: BreakRule[]) =>
    rs?.flatMap((r): BreakRule[] => {
      const days = r.days?.map(day).filter((d): d is number => d !== null)
      if (days && days.length === 0) return []
      const label = r.label ? { label: r.label } : {}
      const onDays = days ? { days } : {}
      if (r.options) {
        const options = r.options.filter((p) => p < slots)
        if (options.length === 0) return []
        if (options.length === 1) return [{ period: options[0], ...onDays, ...label }]
        return [{ period: options.includes(r.period) ? r.period : options[0], options, ...onDays, ...label }]
      }
      return r.period < slots ? [{ period: r.period, ...onDays, ...label }] : []
    })
  return touched({
    ...c,
    calendar: {
      ...c.calendar,
      breaks: rules(c.calendar.breaks) ?? [],
      lunchWindow: c.calendar.lunchWindow.filter((p) => p < slots),
      blockedSlots: keys(c.calendar.blockedSlots),
      ...(c.calendar.periodLengths ? { periodLengths: c.calendar.periodLengths.slice(0, slots) } : {}),
    },
    departments: c.departments.map((d) => ({ ...d, breaks: rules(d.breaks) })),
    programmes: c.programmes.map((p) => ({ ...p, breaks: rules(p.breaks) })),
    sections: c.sections.map((s) => ({ ...s, breaks: rules(s.breaks) })),
    teachers: c.teachers.map((t) => ({ ...t, unavailable: keys(t.unavailable) })),
    grants: c.grants.map((g) => (g.slots === 'all' ? g : { ...g, slots: keys(g.slots) })),
    officeHours: c.officeHours.map((o) => ({ ...o, slots: keys(o.slots) })),
  })
}

/** Slots per day (1–16). Breaks, lunch window, blocked and unavailable slots beyond the last slot are dropped. */
export function setSlotsPerDay(c: CollegeData, n: number): CollegeData {
  const slots = clamp(n, 1, 16)
  const out = reshape(c, (d) => d, slots)
  return { ...out, calendar: { ...out.calendar, periodsPerDay: slots, labBlockLength: Math.min(out.calendar.labBlockLength, slots) } }
}

/**
 * Working days as real weekdays (0 = Sunday … 6 = Saturday), shown Monday first. Everything tied to a day
 * follows its weekday; a removed day's breaks, blocked and unavailable slots go with it.
 */
export function setWorkingDays(c: CollegeData, weekdays: number[]): CollegeData {
  const next = [...new Set(weekdays.filter((w) => w >= 0 && w <= 6))].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  if (next.length === 0) return c
  const index = new Map(next.map((w, i) => [w, i]))
  const out = reshape(c, (d) => index.get(c.calendar.weekdays[d]) ?? null, c.calendar.periodsPerDay)
  return { ...out, calendar: { ...out.calendar, weekdays: next, days: next.map((w) => WEEKDAY_NAMES[w]) } }
}

export type CalendarPatch = Partial<
  Pick<Calendar, 'startTime' | 'periodMinutes' | 'periodLengths' | 'breaks' | 'lunchWindow' | 'teacherMinFreeInLunchWindow' | 'labBlockLength' | 'blockedSlots'>
>

/** Times, slot lengths, college breaks, lunch window, lab block — values clamped to sensible ranges. */
export function setCalendar(c: CollegeData, patch: CalendarPatch): CollegeData {
  const P = c.calendar.periodsPerDay
  const next: Calendar = { ...c.calendar, ...patch }
  if (patch.periodMinutes !== undefined) next.periodMinutes = clamp(patch.periodMinutes, 5, 240)
  if (patch.labBlockLength !== undefined) next.labBlockLength = clamp(patch.labBlockLength, 1, P)
  if (patch.teacherMinFreeInLunchWindow !== undefined) next.teacherMinFreeInLunchWindow = clamp(patch.teacherMinFreeInLunchWindow, 0, P)
  if (patch.lunchWindow) next.lunchWindow = [...new Set(patch.lunchWindow.filter((p) => p >= 0 && p < P))].sort((a, b) => a - b)
  if (patch.periodLengths) next.periodLengths = patch.periodLengths.slice(0, P).map((m) => clamp(m || next.periodMinutes, 5, 240))
  return touched({ ...c, calendar: next })
}

export const setSemester = (c: CollegeData, patch: Partial<Omit<Semester, 'collegeId'>>): CollegeData => ({
  ...c,
  semester: { ...c.semester, ...patch },
})

// ── Departments ──

export function deptCodeProblem(c: CollegeData, code: string): string | null {
  const s = slug(code)
  if (!s) return 'Give the department a short code, e.g. CSE.'
  if (c.departments.some((d) => slug(d.code) === s)) return `${code.trim().toUpperCase()} is already a department here.`
  return null
}

export function addDepartment(c: CollegeData, code: string, name: string): CollegeData {
  const clean = code.trim().toUpperCase()
  return touched({
    ...c,
    departments: [...c.departments, { id: `${c.college.id}-${slug(clean)}`, collegeId: c.college.id, code: clean, name: name.trim() || clean, status: 'draft' }],
  })
}

export const renameDepartment = (c: CollegeData, id: Id, name: string): CollegeData => ({
  ...c,
  departments: c.departments.map((d) => (d.id === id && name.trim() ? { ...d, name: name.trim() } : d)),
})

/** A department that still owns teachers or rooms cannot go — move or remove them in the college setup first. */
export function removeDepartmentProblem(c: CollegeData, id: Id): string | null {
  const t = c.teachers.filter((x) => x.deptId === id).length
  const r = c.rooms.filter((x) => x.owner === id).length
  if (!t && !r) return null
  const parts = [t ? `${t} teacher${t > 1 ? 's' : ''}` : '', r ? `${r} room${r > 1 ? 's' : ''}` : ''].filter(Boolean)
  return `It still has ${parts.join(' and ')} — move or remove them in the college setup first.`
}

/** Removes the department with its programmes, sections, subjects and their assignments. */
export function removeDepartment(c: CollegeData, id: Id): CollegeData {
  if (removeDepartmentProblem(c, id)) return c
  return resync({
    ...c,
    departments: c.departments.filter((d) => d.id !== id),
    programmes: c.programmes.filter((p) => p.deptId !== id),
    grants: c.grants.filter((g) => g.fromDeptId !== id && g.toDeptId !== id),
  })
}

// ── Breaks at any level (department / programme / section); undefined = inherit ──

export type BreakLevel = 'department' | 'programme' | 'section'

export function setBreaks(c: CollegeData, level: BreakLevel, id: Id, breaks: BreakRule[] | undefined): CollegeData {
  const apply = <T extends { id: Id; breaks?: BreakRule[] }>(list: T[]) => list.map((x) => (x.id === id ? { ...x, breaks } : x))
  if (level === 'department') return touched({ ...c, departments: apply(c.departments) })
  if (level === 'programme') return touched({ ...c, programmes: apply(c.programmes) })
  return touched({ ...c, sections: apply(c.sections) })
}

// ── Programmes (years) and their sections ──

export function programmeProblem(c: CollegeData, deptId: Id, shortName: string): string | null {
  const s = slug(shortName)
  if (!s) return 'Give the programme a short name, e.g. Y1.'
  if (c.programmes.some((p) => p.id === `${deptId}-${s}`)) return `${shortName.trim().toUpperCase()} already exists in this department.`
  return null
}

export type ProgrammeInput = Pick<Programme, 'name' | 'shortName' | 'sectionsCount' | 'defaultStrength'>

export function addProgramme(c: CollegeData, deptId: Id, input: ProgrammeInput): CollegeData {
  const short = input.shortName.trim().toUpperCase()
  const p: Programme = {
    id: `${deptId}-${slug(short)}`,
    collegeId: c.college.id,
    deptId,
    name: input.name.trim() || short,
    shortName: short,
    sectionsCount: clamp(input.sectionsCount, 1, 60),
    defaultStrength: clamp(input.defaultStrength, 1, 1000),
  }
  return resync({ ...c, programmes: [...c.programmes, p] })
}

/**
 * Name, number of sections, students per section. Changing students per section updates every section
 * still at the old default; sections someone edited keep their own strength.
 */
export function updateProgramme(c: CollegeData, id: Id, patch: Partial<Pick<Programme, 'name' | 'sectionsCount' | 'defaultStrength'>>): CollegeData {
  const old = c.programmes.find((p) => p.id === id)
  if (!old) return c
  const next: Programme = {
    ...old,
    ...(patch.name !== undefined && patch.name.trim() ? { name: patch.name.trim() } : {}),
    ...(patch.sectionsCount !== undefined ? { sectionsCount: clamp(patch.sectionsCount, 1, 60) } : {}),
    ...(patch.defaultStrength !== undefined ? { defaultStrength: clamp(patch.defaultStrength, 1, 1000) } : {}),
  }
  const sections =
    next.defaultStrength === old.defaultStrength
      ? c.sections
      : c.sections.map((s) => (s.programmeId === id && s.strength === old.defaultStrength ? { ...s, strength: next.defaultStrength } : s))
  return resync({ ...c, sections, programmes: c.programmes.map((p) => (p.id === id ? next : p)) })
}

export const removeProgramme = (c: CollegeData, id: Id): CollegeData => resync({ ...c, programmes: c.programmes.filter((p) => p.id !== id) })

// ── Subjects (the curriculum of a programme, rule G5) ──

export function subjectProblem(c: CollegeData, programmeId: Id, code: string): string | null {
  const s = slug(code)
  if (!s) return 'Give the subject a code, e.g. DS.'
  if (c.subjects.some((x) => x.id === `${programmeId}-${s}`)) return `${code.trim().toUpperCase()} is already in this programme.`
  return null
}

export type SubjectInput = Pick<Subject, 'code' | 'name' | 'kind' | 'periodsPerWeek' | 'roomType'> & { blockLength?: number }

export function addSubject(c: CollegeData, programmeId: Id, input: SubjectInput): CollegeData {
  const programme = c.programmes.find((p) => p.id === programmeId)
  if (!programme) return c
  const code = input.code.trim().toUpperCase()
  const subject: Subject = {
    id: `${programmeId}-${slug(code)}`,
    collegeId: c.college.id,
    deptId: programme.deptId,
    programmeId,
    code,
    name: input.name.trim() || code,
    kind: input.kind,
    periodsPerWeek: clamp(input.periodsPerWeek, 1, 40),
    roomType: input.roomType,
    ...(input.kind === 'lab' && input.blockLength ? { blockLength: clamp(input.blockLength, 1, c.calendar.periodsPerDay) } : {}),
  }
  return resync({ ...c, subjects: [...c.subjects, subject] })
}

export function updateSubject(
  c: CollegeData,
  id: Id,
  patch: Partial<Pick<Subject, 'name' | 'kind' | 'periodsPerWeek' | 'roomType' | 'blockLength'>>,
): CollegeData {
  return touched({
    ...c,
    subjects: c.subjects.map((s) => {
      if (s.id !== id) return s
      const next: Subject = { ...s, ...patch }
      if (patch.name !== undefined) next.name = patch.name.trim() || s.name
      if (patch.periodsPerWeek !== undefined) next.periodsPerWeek = clamp(patch.periodsPerWeek, 1, 40)
      if (next.kind !== 'lab') delete next.blockLength
      else if (patch.blockLength !== undefined)
        next.blockLength = patch.blockLength ? clamp(patch.blockLength, 1, c.calendar.periodsPerDay) : undefined
      return next
    }),
  })
}

export const removeSubject = (c: CollegeData, id: Id): CollegeData => resync({ ...c, subjects: c.subjects.filter((s) => s.id !== id) })

// ── College setup (College Admin, P0.4-d) ─────────────────────────────
// Sections, rooms, teachers (+ availability), who teaches what, blocked slots. Same rules: consistent
// references, a stored draft goes stale.

/** A free id `${base}`, `${base}-2`, `${base}-3` … among `taken`. */
const freeId = (base: string, taken: Set<string>) => {
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

const toggleKey = (keys: SlotKey[], k: SlotKey) => (keys.includes(k) ? keys.filter((x) => x !== k) : [...keys, k])

// ── Sections ──

export function updateSection(c: CollegeData, id: Id, patch: { name?: string; strength?: number }): CollegeData {
  return touched({
    ...c,
    sections: c.sections.map((s) =>
      s.id !== id
        ? s
        : {
            ...s,
            ...(patch.name !== undefined && patch.name.trim() ? { name: patch.name.trim() } : {}),
            ...(patch.strength !== undefined ? { strength: clamp(patch.strength, 1, 1000) } : {}),
          },
    ),
  })
}

// ── Rooms ──

export type RoomInput = { name: string; type: Room['type']; capacity: number; owner: Id | 'shared' }

export function roomProblem(c: CollegeData, name: string, exceptId?: Id): string | null {
  if (!name.trim()) return 'Give the room a name, e.g. LT-101.'
  if (c.rooms.some((r) => r.id !== exceptId && r.name.trim().toLowerCase() === name.trim().toLowerCase())) return `${name.trim()} already exists.`
  return null
}

export function addRoom(c: CollegeData, input: RoomInput): CollegeData {
  const owner = input.owner === 'shared' || c.departments.some((d) => d.id === input.owner) ? input.owner : 'shared'
  const id = freeId(`${c.college.id}-rm-${slug(input.name) || 'room'}`, new Set(c.rooms.map((r) => r.id)))
  return touched({ ...c, rooms: [...c.rooms, { id, collegeId: c.college.id, name: input.name.trim(), type: input.type, capacity: clamp(input.capacity, 1, 2000), owner }] })
}

export function updateRoom(c: CollegeData, id: Id, patch: Partial<RoomInput>): CollegeData {
  return touched({
    ...c,
    rooms: c.rooms.map((r) =>
      r.id !== id
        ? r
        : {
            ...r,
            ...(patch.name !== undefined && patch.name.trim() ? { name: patch.name.trim() } : {}),
            ...(patch.type ? { type: patch.type } : {}),
            ...(patch.capacity !== undefined ? { capacity: clamp(patch.capacity, 1, 2000) } : {}),
            ...(patch.owner && (patch.owner === 'shared' || c.departments.some((d) => d.id === patch.owner)) ? { owner: patch.owner } : {}),
          },
    ),
  })
}

/** Removes the room and any grant that lent it. */
export const removeRoom = (c: CollegeData, id: Id): CollegeData =>
  touched({ ...c, rooms: c.rooms.filter((r) => r.id !== id), grants: c.grants.filter((g) => g.roomId !== id) })

// ── Teachers ──

export type TeacherInput = { name: string; deptId: Id; maxPerDay: number; maxPerWeek: number }

export function teacherProblem(c: CollegeData, name: string, exceptId?: Id): string | null {
  if (!name.trim()) return 'Give the teacher a name.'
  if (c.teachers.some((t) => t.id !== exceptId && t.name.trim().toLowerCase() === name.trim().toLowerCase())) return `${name.trim()} is already a teacher here.`
  return null
}

export function addTeacher(c: CollegeData, input: TeacherInput): CollegeData {
  const deptId = c.departments.some((d) => d.id === input.deptId) ? input.deptId : (c.departments[0]?.id ?? input.deptId)
  const id = freeId(`${c.college.id}-t-${slug(input.name) || 'teacher'}`, new Set(c.teachers.map((t) => t.id)))
  const maxPerDay = clamp(input.maxPerDay, 1, c.calendar.periodsPerDay)
  return touched({
    ...c,
    teachers: [
      ...c.teachers,
      { id, collegeId: c.college.id, deptId, name: input.name.trim(), maxPerDay, maxPerWeek: clamp(input.maxPerWeek, 1, maxPerDay * 7), unavailable: [] },
    ],
  })
}

export function updateTeacher(c: CollegeData, id: Id, patch: Partial<TeacherInput>): CollegeData {
  return touched({
    ...c,
    teachers: c.teachers.map((t) =>
      t.id !== id
        ? t
        : {
            ...t,
            ...(patch.name !== undefined && patch.name.trim() ? { name: patch.name.trim() } : {}),
            ...(patch.deptId && c.departments.some((d) => d.id === patch.deptId) ? { deptId: patch.deptId } : {}),
            ...(patch.maxPerDay !== undefined ? { maxPerDay: clamp(patch.maxPerDay, 1, c.calendar.periodsPerDay) } : {}),
            ...(patch.maxPerWeek !== undefined ? { maxPerWeek: clamp(patch.maxPerWeek, 1, 100) } : {}),
          },
    ),
  })
}

/** Mark a slot unavailable (or available again) for a teacher (rule H6). */
export const toggleUnavailable = (c: CollegeData, teacherId: Id, slot: SlotKey): CollegeData =>
  touched({ ...c, teachers: c.teachers.map((t) => (t.id === teacherId ? { ...t, unavailable: toggleKey(t.unavailable, slot) } : t)) })

/** Removes the teacher; their classes go back to "no teacher yet" (pre-flight then asks for one). */
export const removeTeacher = (c: CollegeData, id: Id): CollegeData =>
  touched({
    ...c,
    teachers: c.teachers.filter((t) => t.id !== id),
    assignments: c.assignments.map((a) => (a.teacherId === id ? { ...a, teacherId: null } : a)),
    officeHours: c.officeHours.filter((o) => o.teacherId !== id),
  })

// ── Who teaches what (rule G5: an assignment only links section × subject → teacher) ──

export const setAssignmentTeacher = (c: CollegeData, assignmentId: Id, teacherId: Id | null): CollegeData =>
  touched({
    ...c,
    assignments: c.assignments.map((a) =>
      a.id === assignmentId && (teacherId === null || c.teachers.some((t) => t.id === teacherId)) ? { ...a, teacherId } : a,
    ),
  })

/** Periods a week each teacher is assigned (from the curriculum), for load hints. */
export function assignedLoad(c: CollegeData): Map<Id, number> {
  const periods = new Map(c.subjects.map((s) => [s.id, s.periodsPerWeek]))
  const out = new Map<Id, number>()
  for (const a of c.assignments) if (a.teacherId) out.set(a.teacherId, (out.get(a.teacherId) ?? 0) + (periods.get(a.subjectId) ?? 0))
  return out
}

// ── Blocked slots (assembly, sports hour…: nothing may be scheduled, rule H7) ──

export const toggleBlocked = (c: CollegeData, slot: SlotKey): CollegeData =>
  touched({ ...c, calendar: { ...c.calendar, blockedSlots: toggleKey(c.calendar.blockedSlots, slot) } })
