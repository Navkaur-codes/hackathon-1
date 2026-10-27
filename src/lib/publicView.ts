// Public department timetables (v0.9-d, user request): when the College Admin publishes, every department gets a
// link anyone can open without signing in — the department's Faculty, its UG / PG classes and the rooms it uses,
// from the **published** version only (a draft never leaks, root §2). Kaalchakra has no server, so the link
// carries a read-only snapshot of exactly the records those timetables need, compressed into `?p=…` (like the
// section share link, lib/share.ts). The page then reuses the ordinary grid model on that snapshot.

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { CollegeData, Department, Id, Programme, Room, Section, Teacher } from '../types'
import { slug } from './structure'

/** A programme's level label from config ("UG", "PG", "Diploma" …); "UG" when none is set (rule G2: a label, not logic). */
export const levelOf = (p: Programme) => p.level?.trim() || 'UG'

/** The three tabs of a department's public page; each maps to a grid view. */
export type PublicTab = 'faculty' | 'class' | 'room'
export const TAB_VIEW = { faculty: 'teacher', class: 'section', room: 'room' } as const

/** Where the public page is: college, department, and optionally a tab + the timetable shown. */
export type PublicPath = { college: string; dept?: string; tab?: PublicTab; id?: Id }

const TABS: PublicTab[] = ['faculty', 'class', 'room']

/** `#/t/<college>/<dept>[/<tab>/<id>]` path parts (after `t`) → a public path, or undefined. */
export function parsePublicPath(parts: string[]): PublicPath | undefined {
  const [college, dept, tab, id] = parts
  if (!college) return undefined
  if (!dept) return { college }
  if (!tab) return { college, dept }
  if (!TABS.includes(tab as PublicTab)) return { college, dept }
  return id ? { college, dept, tab: tab as PublicTab, id } : { college, dept, tab: tab as PublicTab }
}

export const publicParts = (p: PublicPath): string[] => [p.college, p.dept, p.dept && p.tab, p.dept && p.tab && p.id].filter((x): x is string => !!x)

export const collegeKey = (c: CollegeData) => slug(c.college.code)
export const deptKey = (d: Department) => slug(d.code)

/** The college a public path names — only an active college with a published version (else undefined). */
export function publicCollege(colleges: CollegeData[], key: string): CollegeData | undefined {
  return colleges.find((c) => c.college.status === 'active' && !!c.published && collegeKey(c) === key)
}

export type LevelGroup = { level: string; programmes: { programme: Programme; sections: Section[] }[] }
export type RoomUse = { room: Room; use: 'own' | 'shared' | 'other' }

/** What one department's public page lists, from the college's published version. */
export type PublicDept = {
  dept: Department
  /** Teachers of the department (their whole week, incl. classes they teach for other departments). */
  faculty: Teacher[]
  /** The department's classes: level → year → section. */
  levels: LevelGroup[]
  /** Rooms the department owns, then shared / other departments' rooms where it has classes. */
  rooms: RoomUse[]
}

export function publicDept(c: CollegeData, key: string): PublicDept | undefined {
  const dept = c.departments.find((d) => deptKey(d) === key)
  if (!dept || !c.published) return undefined
  const faculty = c.teachers.filter((t) => t.deptId === dept.id).sort((a, b) => a.name.localeCompare(b.name))
  const levels: LevelGroup[] = []
  for (const programme of c.programmes.filter((p) => p.deptId === dept.id)) {
    const level = levelOf(programme)
    let g = levels.find((x) => x.level === level)
    if (!g) levels.push((g = { level, programmes: [] }))
    g.programmes.push({ programme, sections: c.sections.filter((s) => s.programmeId === programme.id) })
  }
  const used = new Set(c.published.timetable.placements.filter((p) => p.deptId === dept.id).map((p) => p.roomId))
  const rank = { own: 0, shared: 1, other: 2 }
  const rooms: RoomUse[] = c.rooms
    .filter((r) => r.owner === dept.id || used.has(r.id))
    .map((room) => ({ room, use: room.owner === dept.id ? ('own' as const) : room.owner === 'shared' ? ('shared' as const) : ('other' as const) }))
    .sort((a, b) => rank[a.use] - rank[b.use] || a.room.name.localeCompare(b.room.name))
  return { dept, faculty, levels, rooms }
}

/** Ids a tab may show (anything else in a deep link is "not found"). */
export function tabIds(pd: PublicDept, tab: PublicTab): Id[] {
  if (tab === 'faculty') return pd.faculty.map((t) => t.id)
  if (tab === 'room') return pd.rooms.map((r) => r.room.id)
  return pd.levels.flatMap((g) => g.programmes.flatMap((p) => p.sections.map((s) => s.id)))
}

// ── the snapshot a link carries ─────────────────────────────────────

export type PublicSnapshot = {
  v: 1
  dept: Id
  /** A slice of the college with only the records the department's timetables need (published placements only). */
  data: Pick<CollegeData, 'college' | 'calendar' | 'semester' | 'departments' | 'programmes' | 'sections' | 'subjects' | 'teachers' | 'rooms' | 'assignments'> & {
    published: NonNullable<CollegeData['published']>
  }
}

/**
 * The read-only slice for department `key`: the published placements of its classes, its faculty and its rooms,
 * plus exactly the sections / subjects / teachers / rooms those placements name. Undefined when not published.
 */
export function deptSnapshot(c: CollegeData, key: string): PublicSnapshot | undefined {
  const pd = publicDept(c, key)
  if (!pd || !c.published) return undefined
  const pub = c.published
  const assignments = new Map(c.assignments.map((a) => [a.id, a]))
  const ourSections = new Set(tabIds(pd, 'class'))
  const ourTeachers = new Set(tabIds(pd, 'faculty'))
  const ourRooms = new Set(tabIds(pd, 'room'))
  const placements = pub.timetable.placements.filter((p) => {
    const a = assignments.get(p.assignmentId)
    return !!a && (ourSections.has(a.sectionId) || (!!a.teacherId && ourTeachers.has(a.teacherId)) || ourRooms.has(p.roomId))
  })
  const as = new Set(placements.map((p) => p.assignmentId))
  const assignmentList = c.assignments.filter((a) => as.has(a.id))
  const sectionIds = new Set([...ourSections, ...assignmentList.map((a) => a.sectionId)])
  const sections = c.sections.filter((s) => sectionIds.has(s.id))
  const programmeIds = new Set(sections.map((s) => s.programmeId))
  const deptIds = new Set([pd.dept.id, ...sections.map((s) => s.deptId)])
  const subjectIds = new Set(assignmentList.map((a) => a.subjectId))
  const teacherIds = new Set([...ourTeachers, ...assignmentList.flatMap((a) => (a.teacherId ? [a.teacherId] : []))])
  const roomIds = new Set([...ourRooms, ...placements.map((p) => p.roomId)])
  return {
    v: 1,
    dept: pd.dept.id,
    data: {
      college: c.college,
      calendar: c.calendar,
      semester: c.semester,
      departments: c.departments.filter((d) => deptIds.has(d.id)),
      programmes: c.programmes.filter((p) => programmeIds.has(p.id)),
      sections,
      subjects: c.subjects.filter((s) => subjectIds.has(s.id)),
      // only what a timetable shows: availability and limits stay private
      teachers: c.teachers.filter((t) => teacherIds.has(t.id)).map((t) => ({ ...t, unavailable: [] })),
      rooms: c.rooms.filter((r) => roomIds.has(r.id)),
      assignments: assignmentList,
      published: { version: pub.version, at: pub.at, timetable: { ...pub.timetable, placements, unplaced: [] } },
    },
  }
}

/** A full (read-only) college built from a snapshot, so the ordinary grid model and Now / Next work on it. */
export const snapshotCollege = (s: PublicSnapshot): CollegeData => ({
  ...s.data,
  grants: [],
  leaves: [],
  substitutions: [],
  officeHours: [],
  meetings: [],
})

export const encodePublic = (s: PublicSnapshot) => compressToEncodedURIComponent(JSON.stringify(s))

const arr = (x: unknown): x is unknown[] => Array.isArray(x)
const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const str = (x: unknown): x is string => typeof x === 'string'
const nat = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0

/** The snapshot in a link, or null when it is broken or inconsistent. Never throws. */
export function decodePublic(p: string | null | undefined): PublicSnapshot | null {
  if (!p) return null
  let s: PublicSnapshot
  try {
    s = JSON.parse(decompressFromEncodedURIComponent(p) ?? '')
  } catch {
    return null
  }
  if (!obj(s) || s.v !== 1 || !str(s.dept) || !obj(s.data)) return null
  const d = s.data
  const lists = [d.departments, d.programmes, d.sections, d.subjects, d.teachers, d.rooms, d.assignments]
  if (!obj(d.college) || !obj(d.calendar) || !obj(d.semester) || !obj(d.published) || !lists.every(arr)) return null
  if (!lists.every((l) => l.every((x) => obj(x) && str(x.id)))) return null
  const cal = d.calendar
  if (!arr(cal.days) || !nat(cal.periodsPerDay) || !arr(cal.breaks) || !arr(cal.lunchWindow) || !arr(cal.blockedSlots)) return null
  const pub = d.published
  if (!nat(pub.version) || !str(pub.at) || !obj(pub.timetable) || !arr(pub.timetable.placements)) return null
  // every reference resolves inside the snapshot and every class lies inside the grid (rule H12)
  const has = (l: { id: string }[]) => new Set(l.map((x) => x.id))
  const [secs, subs, tchs, rms, ass] = [has(d.sections), has(d.subjects), has(d.teachers), has(d.rooms), has(d.assignments)]
  if (!d.departments.some((x) => x.id === s.dept)) return null
  if (!d.sections.every((x) => d.programmes.some((p) => p.id === x.programmeId))) return null
  if (!d.assignments.every((a) => secs.has(a.sectionId) && subs.has(a.subjectId) && (!a.teacherId || tchs.has(a.teacherId)))) return null
  const ok = pub.timetable.placements.every(
    (p) =>
      obj(p) &&
      ass.has(p.assignmentId as string) &&
      rms.has(p.roomId as string) &&
      nat(p.day) &&
      nat(p.period) &&
      nat(p.length) &&
      (p.length as number) >= 1 &&
      (p.day as number) < cal.days.length &&
      (p.period as number) + (p.length as number) <= (cal.periodsPerDay as number),
  )
  return ok ? s : null
}

/** The public link of one department on `base` (the app's address): the snapshot plus the readable path. */
export function publicUrl(base: string, c: CollegeData, d: Department): string | undefined {
  const snap = deptSnapshot(c, deptKey(d))
  return snap && `${base}?p=${encodePublic(snap)}#/t/${collegeKey(c)}/${deptKey(d)}`
}
