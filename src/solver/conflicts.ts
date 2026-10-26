// Conflict Center (v0.7). Reads, never repairs: the independent validator on the draft and on the published version
// against today's data, grouped with the parties involved and the existing actions that fix each one (generate a
// department, move to another room, unlock, generate the whole college). Plus what else holds publishing back and
// upcoming leave dates with classes nobody covers. Publishing stays blocked on any draft clash (root §5).

import { coverOf, dateCheck } from '../lib/leave'
import { publishCheck } from '../lib/publish'
import type { CollegeData, Id, Placement, Substitution, Timetable } from '../types'
import { validate, type Conflict, type HardRule } from './validate'

export type Fix =
  | { kind: 'generateDept'; deptId: Id }
  | { kind: 'generateAll' }
  | { kind: 'moveRoom'; placement: Placement }
  | { kind: 'unlock'; placements: Placement[] }

export type ConflictItem = {
  rule: HardRule
  message: string
  /** Departments whose classes are involved (codes resolved by the caller). */
  deptIds: Id[]
  placements: Placement[]
  fixes: Fix[]
}

export type ConflictReport = {
  /** Clashes in the draft — publishing is blocked while any exist. */
  draft: ConflictItem[]
  /** Clashes the live version has against today's data (e.g. a teacher made unavailable after publishing). */
  published: ConflictItem[]
  /** Everything that blocks publishing right now (no draft, out of date, missing classes, clashes). */
  blocked: string[]
  /** Upcoming leave dates with classes nobody covers, or whose adjusted day does not check out. */
  leaveDays: { date: string; leaveId: Id; teacherId: Id; uncovered: Substitution[]; clashes: Conflict[] }[]
  clean: boolean
}

/** Rules about the room itself — moving the class to another room can fix them. */
const ROOM_RULES: HardRule[] = ['H3', 'H4', 'H5', 'H11']

const covers = (p: Placement, day: number, period: number) => p.day === day && period >= p.period && period < p.period + p.length

/**
 * The classes a conflict is about. The validator names assignments; its message names the slot ("Thu P5"), so keep
 * the placements at that slot. Without a slot: the placements of different assignments that overlap, else all.
 */
function involved(c: CollegeData, tt: Timetable, x: Conflict): Placement[] {
  const ids = new Set(x.assignmentIds)
  const all = tt.placements.filter((p) => ids.has(p.assignmentId))
  const days = c.calendar.days
  const slots = [...x.message.matchAll(/(\S+) P(\d+)/g)]
    .map((m) => ({ day: days.indexOf(m[1]), period: Number(m[2]) - 1 }))
    .filter((s) => s.day >= 0)
  // a room named in the message ("LT-101 is double-booked") narrows it to the classes in that room
  const rooms = new Set(c.rooms.filter((r) => x.message.includes(r.name)).map((r) => r.id))
  const inRoom = (ps: Placement[]) => (rooms.size && ps.some((p) => rooms.has(p.roomId)) ? ps.filter((p) => rooms.has(p.roomId)) : ps)
  if (slots.length) {
    const at = all.filter((p) => slots.some((s) => covers(p, s.day, s.period)))
    if (at.length) return inRoom(at)
  }
  if (ids.size > 1) {
    const overlap = all.filter((p) => all.some((q) => q.assignmentId !== p.assignmentId && q.day === p.day && q.period < p.period + p.length && p.period < q.period + q.length))
    if (overlap.length) return inRoom(overlap)
  }
  return inRoom(all)
}

function items(c: CollegeData, tt: Timetable, conflicts: Conflict[]): ConflictItem[] {
  const assignments = new Map(c.assignments.map((a) => [a.id, a]))
  const sections = new Map(c.sections.map((s) => [s.id, s]))
  return conflicts.map((x) => {
    const placements = involved(c, tt, x)
    const deptIds = [...new Set(x.assignmentIds.map((id) => sections.get(assignments.get(id)?.sectionId ?? '')?.deptId).filter((d): d is Id => !!d))]
    const fixes: Fix[] = []
    const locked = placements.filter((p) => p.locked)
    if (locked.length) fixes.push({ kind: 'unlock', placements: locked })
    if (ROOM_RULES.includes(x.rule)) {
      const movable = placements.find((p) => !p.locked)
      if (movable) fixes.push({ kind: 'moveRoom', placement: movable })
    }
    for (const deptId of deptIds) fixes.push({ kind: 'generateDept', deptId })
    fixes.push({ kind: 'generateAll' })
    return { rule: x.rule, message: x.message, deptIds, placements, fixes }
  })
}

export function conflictReport(c: CollegeData, today: string): ConflictReport {
  const draft = c.draft ? items(c, c.draft, validate(c, c.draft)) : []
  const published = c.published ? items(c, c.published.timetable, validate(c, c.published.timetable)) : []
  const leaveDays = c.leaves
    .filter((l) => l.status === 'approved' && l.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => ({
      date: l.date,
      leaveId: l.id,
      teacherId: l.teacherId,
      uncovered: coverOf(c, l.id).filter((s) => s.status === 'uncovered'),
      clashes: dateCheck(c, l.date),
    }))
    .filter((d) => d.uncovered.length > 0 || d.clashes.length > 0)
  const blocked = publishCheck(c).blocked
  return { draft, published, blocked, leaveDays, clean: draft.length === 0 && published.length === 0 && leaveDays.length === 0 && blocked.length === 0 }
}

/** Number to show on the Conflict Center tab: clashes plus leave days that need attention. */
export const conflictCount = (r: ConflictReport) => r.draft.length + r.published.length + r.leaveDays.length
