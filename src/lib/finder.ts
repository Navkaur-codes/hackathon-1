// "Who's free?" — pure questions about a weekly pattern: free teachers, free rooms, is X free, the next free
// slot, common free slots, and which slot "now" is. Reused later by substitutes, Room Exchange, meetings
// and the assistant. Shape always comes from the calendar (rule G4).

import type { Calendar, CollegeData, Id, Room, SlotKey, Teacher, Timetable } from '../types'
import { periodTimes, sectionBreakSlots, slotKey } from './structure'

export type Occupancy = {
  teacher: Map<Id, Set<SlotKey>>
  section: Map<Id, Set<SlotKey>>
  room: Map<Id, Set<SlotKey>>
}

/** Every busy slot of every teacher, section and room in a timetable. */
export function occupancy(college: CollegeData, timetable: Timetable): Occupancy {
  const occ: Occupancy = { teacher: new Map(), section: new Map(), room: new Map() }
  const add = (m: Map<Id, Set<SlotKey>>, id: Id, k: SlotKey) => {
    let s = m.get(id)
    if (!s) m.set(id, (s = new Set()))
    s.add(k)
  }
  const assignments = new Map(college.assignments.map((a) => [a.id, a]))
  for (const p of timetable.placements) {
    const a = assignments.get(p.assignmentId)
    if (!a) continue
    for (let i = 0; i < p.length; i++) {
      const k = slotKey(p.day, p.period + i)
      if (a.teacherId) add(occ.teacher, a.teacherId, k)
      add(occ.section, a.sectionId, k)
      add(occ.room, p.roomId, k)
    }
  }
  return occ
}

const teacherLoadOn = (occ: Occupancy, teacherId: Id, day: number) =>
  [...(occ.teacher.get(teacherId) ?? [])].filter((k) => k.startsWith(`${day}-`)).length

export type FreeTeacher = { teacher: Teacher; load: number; teachesSubject: boolean; sameDept: boolean }

/** Teachers free and available for all of `periods` on `day`, without going over their daily limit. Best first. */
export function freeTeachers(
  college: CollegeData,
  occ: Occupancy,
  day: number,
  periods: number[],
  opts: { deptId?: Id; subjectCode?: string } = {},
): FreeTeacher[] {
  const keys = periods.map((p) => slotKey(day, p))
  const teaching = new Set<Id>()
  if (opts.subjectCode) {
    const subjectIds = new Set(college.subjects.filter((s) => s.code === opts.subjectCode).map((s) => s.id))
    for (const a of college.assignments) if (a.teacherId && subjectIds.has(a.subjectId)) teaching.add(a.teacherId)
  }
  return college.teachers
    .filter((t) => {
      const busy = occ.teacher.get(t.id)
      if (keys.some((k) => busy?.has(k) || t.unavailable.includes(k))) return false
      return teacherLoadOn(occ, t.id, day) + periods.length <= t.maxPerDay
    })
    .map((teacher) => ({
      teacher,
      load: teacherLoadOn(occ, teacher.id, day),
      teachesSubject: teaching.has(teacher.id),
      sameDept: opts.deptId ? teacher.deptId === opts.deptId : false,
    }))
    .sort(
      (x, y) =>
        Number(y.sameDept) - Number(x.sameDept) ||
        Number(y.teachesSubject) - Number(x.teachesSubject) ||
        x.load - y.load ||
        x.teacher.name.localeCompare(y.teacher.name),
    )
}

/** own = the department's room · granted = lent to it · shared = college-wide · needs-grant = another department's · dept = owned by a department (no viewer dept given) */
export type RoomUse = 'own' | 'granted' | 'shared' | 'needs-grant' | 'dept'
export type FreeRoom = { room: Room; usable: RoomUse }

const USE_ORDER: RoomUse[] = ['own', 'granted', 'shared', 'dept', 'needs-grant']

/** Rooms free for all of `periods` on `day`, optionally of a type / size, labelled by whether `forDeptId` may use them. */
export function freeRooms(
  college: CollegeData,
  occ: Occupancy,
  day: number,
  periods: number[],
  opts: { type?: Room['type']; minCapacity?: number; forDeptId?: Id } = {},
): FreeRoom[] {
  const keys = periods.map((p) => slotKey(day, p))
  const blocked = new Set(college.calendar.blockedSlots)
  return college.rooms
    .filter((r) => (!opts.type || r.type === opts.type) && r.capacity >= (opts.minCapacity ?? 0))
    .filter((r) => !keys.some((k) => occ.room.get(r.id)?.has(k) || blocked.has(k)))
    .map((room): FreeRoom => {
      let usable: RoomUse
      if (room.owner === 'shared') usable = 'shared'
      else if (!opts.forDeptId) usable = 'dept'
      else if (room.owner === opts.forDeptId) usable = 'own'
      else {
        const granted = keys.every((k) =>
          college.grants.some(
            (g) => g.status === 'approved' && g.roomId === room.id && g.toDeptId === opts.forDeptId && (g.slots === 'all' || g.slots.includes(k)),
          ),
        )
        usable = granted ? 'granted' : 'needs-grant'
      }
      return { room, usable }
    })
    .sort((x, y) => USE_ORDER.indexOf(x.usable) - USE_ORDER.indexOf(y.usable) || x.room.capacity - y.room.capacity)
}

export type EntityKind = 'teacher' | 'room' | 'section'
export type SlotState = 'free' | 'busy' | 'break' | 'unavailable'

/** busy · free · break · unavailable for every [day][period] of the week. */
export function weekStrip(college: CollegeData, occ: Occupancy, kind: EntityKind, id: Id): SlotState[][] {
  const cal = college.calendar
  const blocked = new Set(cal.blockedSlots)
  const busy = occ[kind].get(id) ?? new Set<SlotKey>()
  const section = kind === 'section' ? college.sections.find((s) => s.id === id) : undefined
  const breaks = section ? sectionBreakSlots(college, section) : new Set<SlotKey>()
  const teacher = kind === 'teacher' ? college.teachers.find((t) => t.id === id) : undefined
  return cal.days.map((_, d) =>
    Array.from({ length: cal.periodsPerDay }, (_, p): SlotState => {
      const k = slotKey(d, p)
      if (busy.has(k)) return 'busy'
      if (blocked.has(k) || breaks.has(k)) return 'break'
      if (teacher?.unavailable.includes(k)) return 'unavailable'
      return 'free'
    }),
  )
}

/** The first free slot at or after `from`, wrapping round the week; null if the week has none. */
export function nextFree(strip: SlotState[][], from: { day: number; period: number }): { day: number; period: number } | null {
  const D = strip.length
  const P = strip[0]?.length ?? 0
  const total = D * P
  const start = from.day * P + from.period
  for (let i = 0; i < total; i++) {
    const idx = (start + i) % total
    const day = Math.floor(idx / P)
    const period = idx % P
    if (strip[day][period] === 'free') return { day, period }
  }
  return null
}

/** Slots where every listed teacher / room / section is free (meetings, extra classes, practicals). */
export function commonFree(college: CollegeData, occ: Occupancy, entities: { kind: EntityKind; id: Id }[]): SlotKey[] {
  if (entities.length === 0) return []
  const strips = entities.map((e) => weekStrip(college, occ, e.kind, e.id))
  const out: SlotKey[] = []
  college.calendar.days.forEach((_, d) => {
    for (let p = 0; p < college.calendar.periodsPerDay; p++) if (strips.every((s) => s[d][p] === 'free')) out.push(slotKey(d, p))
  })
  return out
}

/** Which pattern slot a real moment falls in (local time), or null outside working days / hours. */
export function nowSlot(calendar: Calendar, at: Date): { day: number; period: number } | null {
  const day = calendar.weekdays.indexOf(at.getDay())
  if (day === -1) return null
  const minutes = at.getHours() * 60 + at.getMinutes()
  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    return h * 60 + m
  }
  const period = periodTimes(calendar).findIndex((t) => toMin(t.start) <= minutes && minutes < toMin(t.end))
  return period === -1 ? null : { day, period }
}
