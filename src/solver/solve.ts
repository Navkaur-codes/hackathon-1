// Greedy, most-constrained-first scheduler (docs/CLAUDE.md, v0.2 design).
// Invariant: every placement it adds satisfies H1–H14 given what is already booked. When a session
// cannot be placed legally it is reported as unplaced — the solver never emits a clash.

import { sectionBreakSlots, sectionFlexBreaks, slotKey, type FlexBreak } from '../lib/structure'
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
  /** Try moving one already-placed class to make room when a class is stuck (default true). */
  repair?: boolean
  /**
   * College Admin's whole-college generate: any suitable room of the college may be used (own department first,
   * shared next, another department's room only when it helps). Every such use must then be recorded as an
   * allocation grant (`lib/allocation.ts`) so rule H11 holds.
   */
  anyRoom?: boolean
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
  notOwnRoom: 3, // S6 — shared or borrowed room
  otherDeptRoom: 8, // S6 — another department's room the College Admin would allocate (anyRoom)
  lateLab: 6, // S7
  lunchMoved: 3, // flexible break: keep the preferred lunch slot unless moving it buys a better placement
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

  // Section slots that can never hold a class (own fixed breaks + college blocked slots).
  const closed = new Map<Id, Set<string>>()
  for (const s of college.sections) closed.set(s.id, new Set([...sectionBreakSlots(college, s), ...blocked]))
  // Flexible breaks: `${sectionId}|${day}` → breaks where one option slot must stay free (H7).
  const flex = new Map<string, FlexBreak[]>()
  for (const s of college.sections)
    for (const f of sectionFlexBreaks(college, s)) flex.set(`${s.id}|${f.day}`, [...(flex.get(`${s.id}|${f.day}`) ?? []), f])

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

  const unbook = (a: Assignment, section: Section, teacherId: Id, p: Placement) => {
    const tb = setOf(teacherBusy, `${teacherId}|${p.day}`)
    const sb = setOf(sectionBusy, `${section.id}|${p.day}`)
    for (let i = 0; i < p.length; i++) {
      tb.delete(p.period + i)
      sb.delete(p.period + i)
      if (roomIndex.has(p.roomId)) roomBusy[rb(p.roomId, p.day, p.period + i)] = 0
    }
    teacherWeek.set(teacherId, (teacherWeek.get(teacherId) ?? 0) - p.length)
    const sd = `${section.id}|${a.subjectId}|${p.day}`
    subjectDay.set(sd, (subjectDay.get(sd) ?? 0) - 1)
    periodsDone.set(a.id, (periodsDone.get(a.id) ?? 0) - p.length)
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
    if (room.owner === 'shared' || room.owner === section.deptId || opts.anyRoom) return true
    const g = grantsTo(section.deptId, room.id)
    if (!g) return false
    if (g === 'all') return true
    for (let i = 0; i < length; i++) if (!g.has(slotKey(day, period + i))) return false
    return true
  }
  /** S6 penalty of using a room for a section, before the best-fit slack: own · shared or loaned · another department's. */
  const ownerPenalty = (r: Room, section: Section) =>
    r.owner === section.deptId
      ? 0
      : r.owner === 'shared' || grantsTo(section.deptId, r.id) !== undefined
        ? W.notOwnRoom
        : W.otherDeptRoom // only reachable with anyRoom: the College Admin will allocate it
  /** Usable rooms, cheapest owner first, then smallest — the order the room loop stops early on. */
  const roomsFor = (section: Section, subject: Subject) =>
    college.rooms
      .filter(
        (r) =>
          r.type === subject.roomType &&
          r.capacity >= section.strength &&
          (r.owner === 'shared' || r.owner === section.deptId || grantsTo(section.deptId, r.id) !== undefined || opts.anyRoom),
      )
      .sort((x, y) => ownerPenalty(x, section) - ownerPenalty(y, section) || x.capacity - y.capacity)

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
      const flexToday = flex.get(`${section.id}|${d}`)

      // H9 — teacher limits
      if (tBusy.size + length > teacher.maxPerDay) continue
      if ((teacherWeek.get(teacher.id) ?? 0) + length > teacher.maxPerWeek) continue

      for (let start = 0; start + length <= P; start++) {
        if (!s.ok[d * P + start]) continue
        let free = true
        for (let i = 0; i < length && free; i++) if (tBusy.has(start + i) || sBusy.has(start + i)) free = false
        if (!free) continue // H1, H2

        // H7 — a flexible break keeps at least one of its option slots free for the section
        let lunchMoved = 0
        if (flexToday) {
          let keepsBreak = true
          for (const f of flexToday) {
            const inBlock = (p: number) => p >= start && p < start + length
            if (!f.options.some((p) => !sBusy.has(p) && !inBlock(p))) keepsBreak = false
            if (inBlock(f.preferred)) lunchMoved++
          }
          if (!keepsBreak) continue
        }

        // H14 — teacher keeps lunch
        if (lunchNeed > 0) {
          let lunchFree = 0
          for (const p of cal.lunchWindow) if (!tBusy.has(p) && (p < start || p >= start + length)) lunchFree++
          if (lunchFree < lunchNeed) continue
        }

        // Room: H3 free, H11 allowed at these slots; best penalty among them. Rooms are sorted by owner penalty,
        // so once a room's owner penalty alone cannot beat the best found, no later room can (exact, just faster).
        let room: Room | null = null
        let roomPenalty = Infinity
        for (const r of s.rooms) {
          const ownerPen = ownerPenalty(r, section)
          if (ownerPen >= roomPenalty) break
          const pen = ownerPen + (r.capacity - section.strength) * W.roomSlack
          if (pen >= roomPenalty) continue
          let ok = roomAllowedAt(r, section, d, start, length)
          for (let i = 0; i < length && ok; i++) if (roomBusy[rb(r.id, d, start + i)]) ok = false
          if (!ok) continue
          room = r
          roomPenalty = pen
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
          lunchMoved * W.lunchMoved +
          roomPenalty +
          s.noise[d * P + start] * W.jitter

        count++
        if (!best || penalty < best.penalty) best = { day: d, period: start, room, penalty }
      }
    }
    return { count, best }
  }

  // ── Booking helpers shared by the main loop and repair ───────────────
  /** Movable placements (not fixed) and the session each came from. */
  const placedBy = new Map<Placement, Session>()

  const toPlacement = (s: Session, c: Choice): Placement => ({
    assignmentId: s.assignment.id,
    collegeId: cid,
    deptId: s.section.deptId,
    day: c.day,
    period: c.period,
    length: s.length,
    roomId: c.room.id,
    locked: false,
  })

  const commit = (s: Session, c: Choice) => {
    const placement = toPlacement(s, c)
    book(s.assignment, s.section, s.teacher.id, placement)
    placements.push(placement)
    placedBy.set(placement, s)
    // Only sessions sharing this teacher, section or room can have changed options. With anyRoom almost every
    // session could use almost every room, so there a room-sharer is re-scored only when its cached best choice
    // sits in this room at an overlapping time — every cached choice stays legal (never a clash); only its count
    // of options may be a little stale, which affects the order, not correctness.
    const overlaps = (b: Choice | null, len: number) =>
      !!b && b.room.id === c.room.id && b.day === c.day && b.period < c.period + s.length && c.period < b.period + len
    for (const x of remaining) {
      const sharesPerson = x.teacher.id === s.teacher.id || x.section.id === s.section.id
      const sharesRoom = opts.anyRoom ? overlaps(cache.get(x)?.best ?? null, x.length) : x.rooms.includes(c.room)
      if (sharesPerson || sharesRoom) cache.delete(x)
    }
    return placement
  }

  const remove = (placement: Placement) => {
    const s = placedBy.get(placement)!
    unbook(s.assignment, s.section, s.teacher.id, placement)
    placements.splice(placements.indexOf(placement), 1)
    placedBy.delete(placement)
    return s
  }

  /**
   * Repair (1 level): lift one already-placed class that shares the stuck class's teacher, section or a
   * usable room; if the stuck class now fits AND the lifted class finds another legal slot, keep both.
   * Otherwise put everything back exactly as it was. Never weakens a hard rule.
   */
  const MAX_REPAIR_TRIES = 80
  const tryRepair = (stuck: Session) => {
    const blockers = [...placedBy.entries()]
      .filter(([, x]) => x.teacher.id === stuck.teacher.id || x.section.id === stuck.section.id || stuck.rooms.some((r) => x.rooms.includes(r)))
      .slice(0, MAX_REPAIR_TRIES)
    for (const [placement] of blockers) {
      const lifted = remove(placement)
      const forStuck = evaluate(stuck).best
      if (forStuck) {
        const placedStuck = commit(stuck, forStuck)
        const forLifted = evaluate(lifted).best
        if (forLifted) {
          commit(lifted, forLifted)
          cache.clear()
          return true
        }
        remove(placedStuck)
      }
      // restore the lifted class where it was
      book(lifted.assignment, lifted.section, lifted.teacher.id, placement)
      placements.push(placement)
      placedBy.set(placement, lifted)
    }
    cache.clear()
    return false
  }

  /** Plain-language reason + concrete fix for a class that cannot be placed. */
  const diagnose = (s: Session): { reason: string; suggestion: string } => {
    const { section, subject, teacher, length } = s
    const what = `${subject.name} (${section.name})`
    if (s.rooms.length === 0) {
      const ofType = college.rooms.filter((r) => r.type === subject.roomType)
      const bigEnough = ofType.filter((r) => r.capacity >= section.strength)
      if (ofType.length === 0)
        return { reason: `${what}: the college has no ${subject.roomType} room.`, suggestion: `Add a ${subject.roomType} room.` }
      if (bigEnough.length === 0)
        return {
          reason: `${what}: no ${subject.roomType} room seats ${section.strength} students (largest has ${Math.max(...ofType.map((r) => r.capacity))}).`,
          suggestion: `Add a bigger ${subject.roomType} room or split ${section.name}.`,
        }
      return {
        reason: `${what}: every ${subject.roomType} room big enough belongs to another department.`,
        suggestion: `Request one through Room Exchange (e.g. ${bigEnough[0].name}) or mark it shared.`,
      }
    }
    if (s.options === 0)
      return {
        reason: `${what}: ${teacher.name} is never available when ${section.name} can have a ${length > 1 ? `${length}-period block` : 'class'}.`,
        suggestion: `Reduce ${teacher.name}'s unavailable slots${length > 1 ? ', move a break,' : ''} or assign another teacher.`,
      }
    if ((teacherWeek.get(teacher.id) ?? 0) + length > teacher.maxPerWeek)
      return {
        reason: `${what}: ${teacher.name} already teaches ${teacherWeek.get(teacher.id)} of a maximum ${teacher.maxPerWeek} periods a week.`,
        suggestion: `Raise ${teacher.name}'s weekly limit or assign another teacher.`,
      }
    let dayRoom = false
    for (let d = 0; d < D; d++) if ((teacherBusy.get(`${teacher.id}|${d}`)?.size ?? 0) + length <= teacher.maxPerDay) dayRoom = true
    if (!dayRoom)
      return {
        reason: `${what}: ${teacher.name} is at the daily limit of ${teacher.maxPerDay} periods on every day.`,
        suggestion: `Raise ${teacher.name}'s daily limit or assign another teacher.`,
      }
    let sectionRun = false
    for (let d = 0; d < D && !sectionRun; d++) {
      const busy = sectionBusy.get(`${section.id}|${d}`)
      for (let st = 0; st + length <= P && !sectionRun; st++) {
        let free = true
        for (let i = 0; i < length; i++) if (busy?.has(st + i) || closed.get(section.id)!.has(slotKey(d, st + i))) free = false
        if (free) sectionRun = true
      }
    }
    if (!sectionRun)
      return {
        reason:
          length > 1
            ? `${what}: ${section.name} has no ${length} consecutive free periods left in the week.`
            : `${what}: ${section.name}'s week is full.`,
        suggestion: `Add a period to the day, a working day, or reduce ${section.name}'s periods.`,
      }
    return {
      reason: `${what}: no slot where ${section.name}, ${teacher.name} and a ${subject.roomType} room are free together.`,
      suggestion: `Free up ${teacher.name}, add a ${subject.roomType} room, or let another teacher take this class.`,
    }
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

    if (pick.best) {
      commit(s, pick.best)
    } else if (!(opts.repair !== false && tryRepair(s))) {
      const why = diagnose(s)
      markUnplaced(s.assignment, s.length, why.reason, why.suggestion)
    }
  }

  const unplaced: Unplaced[] = [...unplacedPeriods].map(([assignmentId, u]) => ({ assignmentId, ...u }))
  return { collegeId: cid, seed, placements, unplaced }
}
