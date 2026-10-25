// Pure edits on one college (the store only routes them, rule G1). P0.4-b: create, clone, archive;
// P0.4-c adds structure edits. Everything new still goes through `buildCollege` (rule G3).

import type { CollegeData, Id } from '../types'
import { buildCollege, slug, type CollegeSpec } from './structure'

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
