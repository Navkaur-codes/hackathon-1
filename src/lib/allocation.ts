// Semester room allocation by the College Admin (root §2, H11). The timetable is one weekly pattern for the whole
// semester, so a class in another department's room has that room for the semester. Every such use is recorded,
// never silent: an approved `Grant { kind: 'allocation' }` from the owner to the user department for exactly the
// weekly slots used — in the draft or in the published version (so a live version stays valid while a newer
// draft changes). Allocations are derived from the timetables, so they are re-synced after every change.

import type { CollegeData, Grant, Id, Placement, Room, SlotKey, Timetable } from '../types'
import { slotKey } from './structure'

const slotsOf = (p: Placement): SlotKey[] => Array.from({ length: p.length }, (_, i) => slotKey(p.day, p.period + i))

/** Is this slot of the room already covered for the department by a weekly HOD loan? */
function loanCovers(c: CollegeData, roomId: Id, deptId: Id, k: SlotKey) {
  return c.grants.some(
    (g) => g.kind !== 'allocation' && g.status === 'approved' && g.roomId === roomId && g.toDeptId === deptId && (g.slots === 'all' || g.slots.includes(k)),
  )
}

/** Recompute the College Admin's allocations from the draft and the published version. */
export function syncAllocations(c: CollegeData): CollegeData {
  const rooms = new Map(c.rooms.map((r) => [r.id, r]))
  const uses = new Map<string, { roomId: Id; from: Id; to: Id; slots: Set<SlotKey> }>()
  const timetables: Timetable[] = [c.draft, c.published?.timetable].filter((t): t is Timetable => !!t)
  for (const t of timetables)
    for (const p of t.placements) {
      const room = rooms.get(p.roomId)
      if (!room || room.owner === 'shared' || room.owner === p.deptId) continue
      for (const k of slotsOf(p)) {
        if (loanCovers(c, room.id, p.deptId, k)) continue
        const key = `${room.id}|${p.deptId}`
        const u = uses.get(key) ?? { roomId: room.id, from: room.owner, to: p.deptId, slots: new Set<SlotKey>() }
        u.slots.add(k)
        uses.set(key, u)
      }
    }
  const allocations: Grant[] = [...uses.values()].map((u) => ({
    id: `${c.college.id}-alloc-${u.roomId}-${u.to}`,
    collegeId: c.college.id,
    roomId: u.roomId,
    fromDeptId: u.from,
    toDeptId: u.to,
    slots: [...u.slots].sort(),
    status: 'approved',
    kind: 'allocation',
  }))
  return { ...c, grants: [...c.grants.filter((g) => g.kind !== 'allocation'), ...allocations] }
}

export type RoomOption = {
  room: Room
  /** own department · shared · weekly loan to the department · another department's room (will be allocated) */
  usable: 'own' | 'shared' | 'loan' | 'allocate'
  current: boolean
}

/** The draft placement matching `p` (same class, same day and start). */
const find = (t: Timetable | undefined, p: Pick<Placement, 'assignmentId' | 'day' | 'period'>) =>
  t?.placements.find((x) => x.assignmentId === p.assignmentId && x.day === p.day && x.period === p.period)

/**
 * Rooms a class could move to for its whole block: right type, enough seats, free in the draft, not blocked.
 * Ordered own → shared → loan → allocate, then smallest that fits.
 */
export function roomOptions(c: CollegeData, p: Pick<Placement, 'assignmentId' | 'day' | 'period'>): RoomOption[] {
  const placement = find(c.draft, p)
  const a = c.assignments.find((x) => x.id === p.assignmentId)
  const subject = c.subjects.find((s) => s.id === a?.subjectId)
  const section = c.sections.find((s) => s.id === a?.sectionId)
  if (!placement || !subject || !section) return []
  const slots = slotsOf(placement)
  const blocked = new Set(c.calendar.blockedSlots)
  const busy = new Set<string>()
  for (const x of c.draft!.placements) if (x !== placement) for (const k of slotsOf(x)) busy.add(`${x.roomId}|${k}`)
  const order = { own: 0, shared: 1, loan: 2, allocate: 3 }
  return c.rooms
    .filter((r) => r.type === subject.roomType && r.capacity >= section.strength)
    .filter((r) => r.id === placement.roomId || slots.every((k) => !busy.has(`${r.id}|${k}`) && !blocked.has(k)))
    .map((room): RoomOption => ({
      room,
      usable:
        room.owner === section.deptId
          ? 'own'
          : room.owner === 'shared'
            ? 'shared'
            : slots.every((k) => loanCovers(c, room.id, section.deptId, k))
              ? 'loan'
              : 'allocate',
      current: room.id === placement.roomId,
    }))
    .sort((x, y) => order[x.usable] - order[y.usable] || x.room.capacity - y.room.capacity)
}

export type MoveOutcome = { ok: true; college: CollegeData } | { ok: false; reason: string }

/** College Admin moves one class of the draft to another room (any department's: it is then allocated). */
export function moveToRoom(c: CollegeData, p: Pick<Placement, 'assignmentId' | 'day' | 'period'>, roomId: Id): MoveOutcome {
  const placement = find(c.draft, p)
  if (!placement) return { ok: false, reason: 'That class is no longer in the draft.' }
  if (placement.locked) return { ok: false, reason: 'That class is locked.' }
  const option = roomOptions(c, p).find((o) => o.room.id === roomId)
  if (!option) {
    const room = c.rooms.find((r) => r.id === roomId)
    return { ok: false, reason: room ? `${room.name} is the wrong type, too small or not free for the whole class.` : 'That room does not exist.' }
  }
  if (option.current) return { ok: true, college: c }
  const draft = { ...c.draft!, placements: c.draft!.placements.map((x) => (x === placement ? { ...x, roomId } : x)) }
  return { ok: true, college: syncAllocations({ ...c, draft }) }
}
