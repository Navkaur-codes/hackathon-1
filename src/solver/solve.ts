// Greedy, most-constrained-first scheduler (docs/CLAUDE.md, v0.2 design).
// Invariant: every placement it adds satisfies H1–H14 given what is already booked. When a session
// cannot be placed legally it is reported as unplaced — the solver never emits a clash.

import { sectionBreakSlots, slotKey } from '../lib/structure'
import type { Assignment, CollegeData, Id, Placement, Room, Section, Subject, Teacher, Timetable, Unplaced } from '../types'
import { mulberry32 } from './rng'

export type SolveOptions = {
  seed?: number
  /** Already-booked placements kept as-is: locked slots, or other departments' committed classes. */
  fixed?: Placement[]
  /** Only schedule these assignments (e.g. one department). Defaults to all. */
  assignmentIds?: Id[]
  /** Teachers on leave for the date being planned (date-specific adjusted timetables). */
  leave?: { teacherId: Id; day: number }[]
}

type Session = {
  assignment: Assignment
  section: Section
  subject: Subject
  teacher: Teacher
  length: number
  rooms: Room[]
  /** Static number of (day, start) options ignoring bookings — smaller = harder. */
  options: number
  tieBreak: number
  /** Seeded per-slot noise (index d*P+start) so different seeds explore different timetables. */
  noise: number[]
  /** Static legality per start slot (index d*P+start): breaks, blocked slots, availability, leave, day end. */
  ok: boolean[]
}

// Soft-rule weights (root CLAUDE.md §4). Hard rules are never weighed — they filter.
const W = {
  sameSubjectSameDay: 50, // S2
  sectionDayLoad: 1, // S1: prefer spreading a section's week
  teacherGap: 4, // S3
  sectionGap: 4, // S4
  teacherDayLoad: 2, // S5
  notOwnRoom: 3, // S6
  lateLab: 6, // S7
  roomSlack: 0.01, // best-fit room
  jitter: 0.5,
}

/** How many idle periods a block [start, start+length) adds between a day's first and last busy period. */
function gapDelta(busy: Set<number>, start: number, length: number) {
  if (busy.size === 0) return 0
  let min = Infinity
  let max = -Infinity
  for (const p of busy) {
    if (p < min) min = p
    if (p > max) max = p
  }
  const before = max - min + 1 - busy.size
  const nMin = Math.min(min, start)
  const nMax = Math.max(max, start + length - 1)
  return nMax - nMin + 1 - (busy.size + length) - before
}

export function solve(college: CollegeData, opts: SolveOptions = {}): Timetable {
  const seed = opts.seed ?? 1
  const rng = mulberry32(seed)
  const cal = college.calendar
  const D = cal.days.length
  const P = cal.periodsPerDay
  const cid = college.college.id

  const sections = new Map(college.sections.map((s) => [s.id, s]))
  const subjects = new Map(college.subjects.map((s) => [s.id, s]))
  const teachers = new Map(college.teachers.map((t) => [t.id, t]))
  const assignments = new Map(college.assignments.map((a) => [a.id, a]))
  const blocked = new Set(cal.blockedSlots)
  const onLeave = new Set((opts.leave ?? []).map((l) => `${l.teacherId}|${l.day}`))
  const unavailable = new Map(college.teachers.map((t) => [t.id, new Set<string>(t.unavailable)]))
  const lunchNeed = Math.min(cal.teacherMinFreeInLunchWindow, cal.lunchWindow.length)

  // Section slots that can never hold a class (own breaks + college blocked slots).
  const closed = new Map<Id, Set<string>>()
  for (const s of college.sections) closed.set(s.id, new Set([...sectionBreakSlots(college, s), ...blocked]))

  // ── Bookings ─────────────────────────────────────────────────────────
  const teacherBusy = new Map<string, Set<number>>() // `${tid}|${d}` → periods
  const sectionBusy = new Map<string, Set<number>>() // `${sid}|${d}` → periods
  const roomIndex = new Map(college.rooms.map((r, i) => [r.id, i]))
  const roomBusy = new Uint8Array(Math.max(1, college.rooms.length) * D * P) // [room][day][period]
  const rb = (roomId: Id, d: number, p: number) => (roomIndex.get(roomId) ?? 0) * D * P + d * P + p
  const teacherWeek = new Map<Id, number>()
  const subjectDay = new Map<string, number>() // `${sid}|${subjectId}|${d}` → sessions
  const periodsDone = new Map<Id, number>()

  const setOf = (m: Map<string, Set<number>>, k: string) => {
    let s = m.get(k)
    if (!s) m.set(k, (s = new Set()))
    return s
  }

  const placements: Placement[] = []

  const book = (a: Assignment, section: Section, teacherId: Id, p: Omit<Placement, 'assignmentId' | 'collegeId' | 'deptId'>) => {
    const tb = setOf(teacherBusy, `${teacherId}|${p.day}`)
    const sb = setOf(sectionBusy, `${section.id}|${p.day}`)
    for (let i = 0; i < p.length; i++) {
      tb.add(p.period + i)
      sb.add(p.period + i)
      if (roomIndex.has(p.roomId)) roomBusy[rb(p.roomId, p.day, p.period + i)] = 1
    }
    teacherWeek.set(teacherId, (teacherWeek.get(teacherId) ?? 0) + p.length)
    const sd = `${section.id}|${a.subjectId}|${p.day}`
    subjectDay.set(sd, (subjectDay.get(sd) ?? 0) + 1)
    periodsDone.set(a.id, (periodsDone.get(a.id) ?? 0) + p.length)
  }

  // Fixed placements are booked first and returned unchanged.
  for (const f of opts.fixed ?? []) {
    const a = assignments.get(f.assignmentId)
    const section = a && sections.get(a.sectionId)
    if (!a || !section || !a.teacherId) continue
    book(a, section, a.teacherId, f)
    placements.push(f)
  }

  // ── Rooms a section may use for a subject (H4, H5, H11) ──────────────
  // `${deptId}|${roomId}` → slots granted ('all' or a set of slot keys)
  const granted = new Map<string, 'all' | Set<string>>()
  for (const g of college.grants) {
    if (g.status !== 'approved') continue
    const k = `${g.toDeptId}|${g.roomId}`
    const prev = granted.get(k)
    if (prev === 'all' || g.slots === 'all') granted.set(k, 'all')
    else granted.set(k, new Set([...(prev ?? []), ...g.slots]))
  }
  const grantsTo = (deptId: Id, roomId: Id) => granted.get(`${deptId}|${roomId}`)
  const roomAllowedAt = (room: Room, section: Section, day: number, period: number, length: number) => {
    if (room.owner === 'shared' || room.owner === section.deptId) return true
    const g = grantsTo(section.deptId, room.id)
    if (!g) return false
    if (g === 'all') return true
    for (let i = 0; i < length; i++) if (!g.has(slotKey(day, period + i))) return false
    return true
  }
  const roomsFor = (section: Section, subject: Subject) =>
    college.rooms
      .filter(
        (r) =>
          r.type === subject.roomType &&
          r.capacity >= section.strength &&
          (r.owner === 'shared' || r.owner === section.deptId || grantsTo(section.deptId, r.id) !== undefined),
      )
      .sort((x, y) => Number(x.owner !== section.deptId) - Number(y.owner !== section.deptId) || x.capacity - y.capacity)

  // ── Static legality of a block for a section + teacher (ignores bookings) ──
  const staticOk = (section: Section, teacher: Teacher, day: number, start: number, length: number) => {
    if (start + length > P) return false
    if (onLeave.has(`${teacher.id}|${day}`)) return false
    const shut = closed.get(section.id)!
    for (let i = 0; i < length; i++) {
      const k = slotKey(day, start + i)
      if (shut.has(k) || unavailable.get(teacher.id)!.has(k)) return false
    }
    return true
  }

  // ── Build sessions ───────────────────────────────────────────────────
  const unplacedPeriods = new Map<Id, { periods: number; reason: string; suggestion: string }>()
  const markUnplaced = (a: Assignment, periods: number, reason: string, suggestion: string) => {
    const prev = unplacedPeriods.get(a.id)
    unplacedPeriods.set(a.id, { periods: (prev?.periods ?? 0) + periods, reason: prev?.reason ?? reason, suggestion: prev?.suggestion ?? suggestion })
  }

  const wanted = opts.assignmentIds ? new Set(opts.assignmentIds) : null
  const sessions: Session[] = []
  for (const a of college.assignments) {
    if (wanted && !wanted.has(a.id)) continue
    const section = sections.get(a.sectionId)
    const subject = subjects.get(a.subjectId)
    if (!section || !subject) continue
    const remaining = subject.periodsPerWeek - (periodsDone.get(a.id) ?? 0)
    if (remaining <= 0) continue
    const teacher = a.teacherId ? teachers.get(a.teacherId) : undefined
    if (!teacher) {
      markUnplaced(a, remaining, `No teacher assigned to ${subject.name} for ${section.name}.`, `Assign a teacher to ${subject.code} for ${section.name}.`)
      continue
    }
    const rooms = roomsFor(section, subject)
    const lengths: number[] = []
    if (subject.kind === 'lab') {
      const bl = Math.max(1, subject.blockLength ?? cal.labBlockLength)
      for (let i = 0; i < Math.floor(remaining / bl); i++) lengths.push(bl)
      if (remaining % bl) lengths.push(remaining % bl)
    } else {
      for (let i = 0; i < remaining; i++) lengths.push(1)
    }
    for (const length of lengths) {
      const ok = Array.from({ length: D * P }, (_, i) => staticOk(section, teacher, Math.floor(i / P), i % P, length))
      const options = ok.filter(Boolean).length
      const noise = Array.from({ length: D * P }, () => rng())
      sessions.push({ assignment: a, section, subject, teacher, length, rooms, options, tieBreak: rng(), noise, ok })
    }
  }

  const teacherDemand = new Map<Id, number>()
  for (const s of sessions) teacherDemand.set(s.teacher.id, (teacherDemand.get(s.teacher.id) ?? 0) + s.length)

  // Static priority (used to break ties): longer blocks, fewer options, busier teacher, seeded.
  const priority = (x: Session, y: Session) =>
    y.length - x.length ||
    x.options - y.options ||
    (teacherDemand.get(y.teacher.id) ?? 0) - (teacherDemand.get(x.teacher.id) ?? 0) ||
    x.tieBreak - y.tieBreak

  const EMPTY = new Set<number>()
  type Choice = { day: number; period: number; room: Room; penalty: number }

  /** All legal placements of a session given current bookings: how many, and the best one. */
  const evaluate = (s: Session): { count: number; best: Choice | null } => {
    const { section, subject, teacher, length } = s
    let best: Choice | null = null
    let count = 0

    for (let d = 0; d < D; d++) {
      const tBusy = teacherBusy.get(`${teacher.id}|${d}`) ?? EMPTY
      const sBusy = sectionBusy.get(`${section.id}|${d}`) ?? EMPTY

      // H9 — teacher limits
      if (tBusy.size + length > teacher.maxPerDay) continue
      if ((teacherWeek.get(teacher.id) ?? 0) + length > teacher.maxPerWeek) continue

      for (let start = 0; start + length <= P; start++) {
        if (!s.ok[d * P + start]) continue
        let free = true
        for (let i = 0; i < length && free; i++) if (tBusy.has(start + i) || sBusy.has(start + i)) free = false
        if (!free) continue // H1, H2

        // H14 — teacher keeps lunch
        if (lunchNeed > 0) {
          let lunchFree = 0
          for (const p of cal.lunchWindow) if (!tBusy.has(p) && (p < start || p >= start + length)) lunchFree++
          if (lunchFree < lunchNeed) continue
        }

        // Room: H3 free, H11 allowed at these slots; best penalty among them
        let room: Room | null = null
        let roomPenalty = Infinity
        for (const r of s.rooms) {
          let ok = roomAllowedAt(r, section, d, start, length)
          for (let i = 0; i < length && ok; i++) if (roomBusy[rb(r.id, d, start + i)]) ok = false
          if (!ok) continue
          const pen = (r.owner === section.deptId ? 0 : W.notOwnRoom) + (r.capacity - section.strength) * W.roomSlack
          if (pen < roomPenalty) {
            room = r
            roomPenalty = pen
          }
        }
        if (!room) continue

        // Soft penalty (S1–S7)
        const teacherGapDelta = gapDelta(tBusy, start, length)
        const sectionGapDelta = gapDelta(sBusy, start, length)
        const penalty =
          (subjectDay.get(`${section.id}|${subject.id}|${d}`) ?? 0) * W.sameSubjectSameDay +
          sBusy.size * W.sectionDayLoad +
          teacherGapDelta * W.teacherGap +
          sectionGapDelta * W.sectionGap +
          tBusy.size * W.teacherDayLoad +
          (subject.kind === 'lab' && start + length >= P ? W.lateLab : 0) +
          roomPenalty +
          s.noise[d * P + start] * W.jitter

        count++
        if (!best || penalty < best.penalty) best = { day: d, period: start, room, penalty }
      }
    }
    return { count, best }
  }

  // ── Place sessions, always taking the one with the fewest legal slots right now ──
  const remaining = sessions.slice().sort(priority)
  const cache = new Map<Session, ReturnType<typeof evaluate>>()
  const scored = (x: Session) => {
    let e = cache.get(x)
    if (!e) cache.set(x, (e = evaluate(x)))
    return e
  }
  while (remaining.length) {
    let pickIndex = 0
    let pick = scored(remaining[0])
    for (let i = 1; i < remaining.length && pick.count > 0; i++) {
      const e = scored(remaining[i])
      if (e.count < pick.count) {
        pick = e
        pickIndex = i
      }
    }
    const s = remaining.splice(pickIndex, 1)[0]
    cache.delete(s)
    const { assignment: a, section, subject, teacher, length } = s
    const best = pick.best

    if (!best) {
      markUnplaced(
        a,
        length,
        `No free slot where ${section.name}, ${teacher.name} and a ${subject.roomType} room are all available.`,
        `Free up ${teacher.name}, add a ${subject.roomType} room, or add a period to the week.`,
      )
      continue
    }

    const placement: Placement = {
      assignmentId: a.id,
      collegeId: cid,
      deptId: section.deptId,
      day: best.day,
      period: best.period,
      length,
      roomId: best.room.id,
      locked: false,
    }
    book(a, section, teacher.id, placement)
    placements.push(placement)
    // Only sessions sharing this teacher, section or room can have changed options.
    for (const x of remaining) {
      if (x.teacher.id === teacher.id || x.section.id === section.id || x.rooms.includes(best.room)) cache.delete(x)
    }
  }

  const unplaced: Unplaced[] = [...unplacedPeriods].map(([assignmentId, u]) => ({ assignmentId, ...u }))
  return { collegeId: cid, seed, placements, unplaced }
}
