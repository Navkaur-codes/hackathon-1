// College dashboard numbers (v0.7-c). Always computed from the timetable and the college data, never stored — like
// `describeTimetable`. Reads the published version, or the draft when nothing is published. Shape comes only from the
// calendar (rule G4): any number of days, slots, rooms and departments.

import type { CollegeData, Id, Room, Teacher, Timetable } from '../types'
import { semesterDelivery } from './semester'
import { validate } from '../solver/validate'

/** Which timetable the dashboard reads: the live version first, else the draft. */
export function insightSource(c: CollegeData): { timetable: Timetable; label: string } | undefined {
  if (c.published) return { timetable: c.published.timetable, label: `published version ${c.published.version}` }
  if (c.draft) return { timetable: c.draft, label: 'draft (nothing published yet)' }
  return undefined
}

const teacherOfAssignment = (c: CollegeData) => new Map(c.assignments.map((a) => [a.id, a.teacherId]))

export type TeacherLoad = {
  teacher: Teacher
  perDay: number[]
  week: number
  /** Busiest day's periods. */
  peak: number
  over: boolean
  /** Uses a third of the weekly limit or less. */
  light: boolean
}

/** Every teacher's periods per day and week against their limits, busiest first. */
export function teacherLoads(c: CollegeData, tt: Timetable): TeacherLoad[] {
  const teacherOf = teacherOfAssignment(c)
  const perDay = new Map<Id, number[]>(c.teachers.map((t) => [t.id, c.calendar.days.map(() => 0)]))
  for (const p of tt.placements) {
    const row = perDay.get(teacherOf.get(p.assignmentId) ?? '')
    if (row && row[p.day] !== undefined) row[p.day] += p.length
  }
  return c.teachers
    .map((teacher) => {
      const days = perDay.get(teacher.id)!
      const week = days.reduce((s, n) => s + n, 0)
      const peak = Math.max(0, ...days)
      return { teacher, perDay: days, week, peak, over: week > teacher.maxPerWeek || peak > teacher.maxPerDay, light: week * 3 <= teacher.maxPerWeek }
    })
    .sort((a, b) => b.week - a.week || a.teacher.name.localeCompare(b.teacher.name))
}

/** Slots a room can hold a class on each day: every slot of the grid minus college-blocked ones. */
export function teachableSlots(c: CollegeData): number[] {
  return c.calendar.days.map((_, d) => {
    let n = 0
    for (let p = 0; p < c.calendar.periodsPerDay; p++) if (!c.calendar.blockedSlots.includes(`${d}-${p}`)) n++
    return n
  })
}

export type RoomUse = { room: Room; perDay: number[]; used: number; teachable: number; idle: number; share: number }

/** Periods used per room and day, out of the teachable slots. Grouped by owner (departments, then shared). */
export function roomUse(c: CollegeData, tt: Timetable): RoomUse[] {
  const slots = teachableSlots(c)
  const teachable = slots.reduce((s, n) => s + n, 0)
  const per = new Map<Id, number[]>(c.rooms.map((r) => [r.id, c.calendar.days.map(() => 0)]))
  for (const p of tt.placements) {
    const row = per.get(p.roomId)
    if (row && row[p.day] !== undefined) row[p.day] += p.length
  }
  const ownerOrder = (r: Room) => (r.owner === 'shared' ? c.departments.length : c.departments.findIndex((d) => d.id === r.owner))
  return c.rooms
    .map((room) => {
      const perDay = per.get(room.id)!
      const used = perDay.reduce((s, n) => s + n, 0)
      return { room, perDay, used, teachable, idle: teachable - used, share: teachable ? used / teachable : 0 }
    })
    .sort((a, b) => ownerOrder(a.room) - ownerOrder(b.room) || a.room.name.localeCompare(b.room.name))
}

/** Department rooms that sit idle most — candidates to lend through Room Exchange. */
export function idleRooms(c: CollegeData, tt: Timetable, n = 5): RoomUse[] {
  return roomUse(c, tt)
    .filter((u) => u.room.owner !== 'shared')
    .sort((a, b) => b.idle - a.idle || a.room.name.localeCompare(b.room.name))
    .slice(0, n)
}

export type LedgerRow = { room: Room; byDept: { deptId: Id; periods: number }[]; used: number; idle: number }

/** Shared-Resource Ledger: per shared room, each department's periods a week and the idle periods. */
export function sharedLedger(c: CollegeData, tt: Timetable): LedgerRow[] {
  const sections = new Map(c.sections.map((s) => [s.id, s.deptId]))
  const deptOf = new Map(c.assignments.map((a) => [a.id, sections.get(a.sectionId) ?? '']))
  const teachable = teachableSlots(c).reduce((s, n) => s + n, 0)
  return c.rooms
    .filter((r) => r.owner === 'shared')
    .map((room) => {
      const by = new Map<Id, number>()
      for (const p of tt.placements) if (p.roomId === room.id) by.set(deptOf.get(p.assignmentId) ?? '', (by.get(deptOf.get(p.assignmentId) ?? '') ?? 0) + p.length)
      const byDept = c.departments.map((d) => ({ deptId: d.id, periods: by.get(d.id) ?? 0 }))
      const used = [...by.values()].reduce((s, n) => s + n, 0)
      return { room, byDept, used, idle: teachable - used }
    })
}

export type DeptRow = { deptId: Id; code: string; name: string; status: string; periods: number; unplaced: number; clashes: number; teachers: number; sections: number }

/** One line per department: periods placed, not placed and clashes in the timetable read. */
export function deptSummary(c: CollegeData, tt: Timetable): DeptRow[] {
  const sections = new Map(c.sections.map((s) => [s.id, s.deptId]))
  const deptOf = new Map(c.assignments.map((a) => [a.id, sections.get(a.sectionId) ?? '']))
  const clashes = validate(c, tt)
  return c.departments.map((d) => ({
    deptId: d.id,
    code: d.code,
    name: d.name,
    status: d.status,
    periods: tt.placements.filter((p) => deptOf.get(p.assignmentId) === d.id).reduce((s, p) => s + p.length, 0),
    unplaced: tt.unplaced.filter((u) => deptOf.get(u.assignmentId) === d.id).reduce((s, u) => s + u.periods, 0),
    clashes: clashes.filter((x) => x.assignmentIds.some((id) => deptOf.get(id) === d.id)).length,
    teachers: c.teachers.filter((t) => t.deptId === d.id).length,
    sections: c.sections.filter((s) => s.deptId === d.id).length,
  }))
}

export type DeliveryRow = { programmeId: Id; name: string; planned: number; placed: number; hours: number }

/** Per programme: periods a week the curriculum asks for (all sections), periods placed, contact hours over the semester. */
export function deliveryByProgramme(c: CollegeData, tt: Timetable): DeliveryRow[] {
  const delivery = new Map(semesterDelivery(c, tt).map((d) => [d.assignmentId, d]))
  const subjects = new Map(c.subjects.map((s) => [s.id, s]))
  const sectionProgramme = new Map(c.sections.map((s) => [s.id, s.programmeId]))
  return c.programmes.map((p) => {
    const mine = c.assignments.filter((a) => sectionProgramme.get(a.sectionId) === p.id)
    return {
      programmeId: p.id,
      name: p.name,
      planned: mine.reduce((s, a) => s + (subjects.get(a.subjectId)?.periodsPerWeek ?? 0), 0),
      placed: mine.reduce((s, a) => s + (delivery.get(a.id)?.periodsPerWeek ?? 0), 0),
      hours: Math.round(mine.reduce((s, a) => s + (delivery.get(a.id)?.minutes ?? 0), 0) / 60),
    }
  })
}
