// Independent clash checker (root CLAUDE.md §3, §5). It must never import the solver — it is the judge.
// It rebuilds its own indexes from the raw college data and checks every hard rule H1–H14.

import { sectionBreakSlots, slotKey } from '../lib/structure'
import type { CollegeData, Id, Placement, SlotKey, Timetable } from '../types'

export type HardRule = `H${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14}`

export type Conflict = {
  rule: HardRule
  message: string
  assignmentIds: Id[]
}

export type ValidateOptions = {
  /** Placements that were locked before this run and must appear unchanged (H10). */
  mustKeep?: Placement[]
  /**
   * Teachers on approved leave for the date being checked (H6). Leave is date-specific: it is passed
   * only when validating the adjusted timetable of that date, never the weekly master timetable.
   */
  leave?: { teacherId: Id; day: number }[]
}

const samePlacement = (a: Placement, b: Placement) =>
  a.assignmentId === b.assignmentId && a.day === b.day && a.period === b.period && a.length === b.length && a.roomId === b.roomId

export function validate(college: CollegeData, timetable: Timetable, opts: ValidateOptions = {}): Conflict[] {
  const conflicts: Conflict[] = []
  const add = (rule: HardRule, message: string, ...assignmentIds: Id[]) =>
    conflicts.push({ rule, message, assignmentIds: [...new Set(assignmentIds)] })

  const cid = college.college.id
  const cal = college.calendar
  const dayCount = cal.days.length
  const dayName = (d: number) => cal.days[d] ?? `day ${d + 1}`
  const at = (d: number, p: number) => `${dayName(d)} P${p + 1}`

  const assignments = new Map(college.assignments.map((a) => [a.id, a]))
  const sections = new Map(college.sections.map((s) => [s.id, s]))
  const subjects = new Map(college.subjects.map((s) => [s.id, s]))
  const teachers = new Map(college.teachers.map((t) => [t.id, t]))
  const rooms = new Map(college.rooms.map((r) => [r.id, r]))
  const blocked = new Set(cal.blockedSlots)
  const leave = new Set((opts.leave ?? []).map((l) => `${l.teacherId}|${l.day}`))
  const breaksBySection = new Map<Id, Set<SlotKey>>()
  const breaksOf = (sectionId: Id) => {
    let b = breaksBySection.get(sectionId)
    if (!b) {
      b = sectionBreakSlots(college, sections.get(sectionId)!)
      breaksBySection.set(sectionId, b)
    }
    return b
  }

  if (timetable.collegeId !== cid) {
    add('H13', `Timetable belongs to college "${timetable.collegeId}", not "${cid}".`)
  }

  // occupancy: key → assignment ids using it
  const teacherAt = new Map<string, Id[]>()
  const sectionAt = new Map<string, Id[]>()
  const roomAt = new Map<string, Id[]>()
  const push = (m: Map<string, Id[]>, k: string, id: Id) => m.set(k, [...(m.get(k) ?? []), id])
  const teacherDay = new Map<string, number>()
  const teacherWeek = new Map<Id, number>()
  const periodsPlaced = new Map<Id, number>()
  const shortLabBlocks = new Map<Id, number>()

  for (const p of timetable.placements) {
    const a = assignments.get(p.assignmentId)
    if (!a) {
      add('H12', `A class refers to an unknown assignment "${p.assignmentId}".`, p.assignmentId)
      continue
    }
    const section = sections.get(a.sectionId)
    const subject = subjects.get(a.subjectId)
    const room = rooms.get(p.roomId)
    const teacher = a.teacherId ? teachers.get(a.teacherId) : undefined
    const label = `${section?.name ?? a.sectionId} · ${subject?.code ?? a.subjectId}`

    // H12 — references and bounds
    if (!section || !subject) {
      add('H12', `${label}: its section or subject no longer exists.`, a.id)
      continue
    }
    if (!a.teacherId || !teacher) {
      add('H12', `${label}: has no teacher assigned but was scheduled.`, a.id)
      continue
    }
    if (!room) {
      add('H12', `${label}: scheduled in an unknown room "${p.roomId}".`, a.id)
      continue
    }
    if (p.day < 0 || p.day >= dayCount || p.period < 0 || p.length < 1) {
      add('H12', `${label}: scheduled outside the college week (day ${p.day + 1}, period ${p.period + 1}).`, a.id)
      continue
    }

    // H13 — nothing crosses colleges
    for (const [what, owner] of [
      ['assignment', a.collegeId],
      ['section', section.collegeId],
      ['teacher', teacher.collegeId],
      ['room', room.collegeId],
      ['class', p.collegeId],
    ] as const) {
      if (owner !== cid) add('H13', `${label}: its ${what} belongs to another college.`, a.id)
    }

    // H8 — block shape (theory = 1 period, lab = consecutive block that fits the day)
    const blockLength = subject.blockLength ?? cal.labBlockLength
    if (subject.kind === 'theory' && p.length !== 1) {
      add('H8', `${label}: a theory class must take exactly one period (got ${p.length}).`, a.id)
    }
    if (subject.kind === 'lab') {
      if (p.length > blockLength) add('H8', `${label}: lab block of ${p.length} periods is longer than ${blockLength}.`, a.id)
      if (p.length < blockLength) shortLabBlocks.set(a.id, (shortLabBlocks.get(a.id) ?? 0) + 1)
    }
    if (p.period + p.length > cal.periodsPerDay) {
      add('H8', `${label}: runs past the end of ${dayName(p.day)}.`, a.id)
      continue
    }

    // H4 / H5 — room type and capacity
    if (room.type !== subject.roomType) {
      add('H4', `${label}: needs a ${subject.roomType} room but is in ${room.name} (${room.type}).`, a.id)
    }
    if (room.capacity < section.strength) {
      add('H5', `${label}: ${section.strength} students do not fit in ${room.name} (${room.capacity} seats).`, a.id)
    }

    // H11 — room ownership / grants
    const slots = Array.from({ length: p.length }, (_, i) => slotKey(p.day, p.period + i))
    if (room.owner !== 'shared' && room.owner !== section.deptId) {
      const covered = slots.every((k) =>
        college.grants.some(
          (g) =>
            g.status === 'approved' &&
            g.roomId === room.id &&
            g.toDeptId === section.deptId &&
            (g.slots === 'all' || g.slots.includes(k)),
        ),
      )
      if (!covered) add('H11', `${label}: uses ${room.name}, which belongs to another department, without an approved grant.`, a.id)
    }

    // H6 — leave day
    if (leave.has(`${teacher.id}|${p.day}`)) {
      add('H6', `${label}: ${teacher.name} is on approved leave on ${dayName(p.day)}.`, a.id)
    }

    const breaks = breaksOf(section.id)
    for (let i = 0; i < p.length; i++) {
      const period = p.period + i
      const k = slotKey(p.day, period)

      // H6 — teacher availability
      if (teacher.unavailable.includes(k)) add('H6', `${label}: ${teacher.name} is unavailable at ${at(p.day, period)}.`, a.id)

      // H7 / H8 — breaks and blocked slots
      if (blocked.has(k)) add('H7', `${label}: ${at(p.day, period)} is blocked for the whole college.`, a.id)
      if (breaks.has(k)) {
        if (p.length > 1) add('H8', `${label}: lab block crosses ${section.name}'s break at ${at(p.day, period)}.`, a.id)
        else add('H7', `${label}: ${at(p.day, period)} is ${section.name}'s break.`, a.id)
      }

      push(teacherAt, `${teacher.id}|${k}`, a.id)
      push(sectionAt, `${section.id}|${k}`, a.id)
      push(roomAt, `${room.id}|${k}`, a.id)
    }

    teacherDay.set(`${teacher.id}|${p.day}`, (teacherDay.get(`${teacher.id}|${p.day}`) ?? 0) + p.length)
    teacherWeek.set(teacher.id, (teacherWeek.get(teacher.id) ?? 0) + p.length)
    periodsPlaced.set(a.id, (periodsPlaced.get(a.id) ?? 0) + p.length)
  }

  // H1 / H2 / H3 — single booking (across all departments)
  const doubles = (m: Map<string, Id[]>, rule: HardRule, what: (key: string) => string) => {
    for (const [key, ids] of m) {
      if (ids.length > 1) {
        const [, k] = key.split('|')
        const [d, p] = k.split('-').map(Number)
        add(rule, `${what(key.split('|')[0])} is double-booked at ${at(d, p)}.`, ...ids)
      }
    }
  }
  doubles(teacherAt, 'H1', (id) => teachers.get(id)?.name ?? id)
  doubles(sectionAt, 'H2', (id) => sections.get(id)?.name ?? id)
  doubles(roomAt, 'H3', (id) => rooms.get(id)?.name ?? id)

  // H9 — teacher limits
  for (const [key, n] of teacherDay) {
    const [tid, d] = key.split('|')
    const t = teachers.get(tid)!
    if (n > t.maxPerDay) add('H9', `${t.name} teaches ${n} periods on ${dayName(Number(d))} (limit ${t.maxPerDay}).`)
  }
  for (const [tid, n] of teacherWeek) {
    const t = teachers.get(tid)!
    if (n > t.maxPerWeek) add('H9', `${t.name} teaches ${n} periods this week (limit ${t.maxPerWeek}).`)
  }

  // H12 — never more periods than the curriculum asks for; at most one shorter lab block
  for (const [aid, n] of periodsPlaced) {
    const subject = subjects.get(assignments.get(aid)!.subjectId)!
    if (n > subject.periodsPerWeek) add('H12', `${subject.code}: ${n} periods scheduled but the curriculum has ${subject.periodsPerWeek}.`, aid)
  }
  for (const [aid, n] of shortLabBlocks) {
    if (n > 1) add('H8', `${subjects.get(assignments.get(aid)!.subjectId)!.code}: lab split into more than one short block.`, aid)
  }

  // H14 — every teacher keeps a free slot in the lunch window on days they teach
  const need = Math.min(cal.teacherMinFreeInLunchWindow, cal.lunchWindow.length)
  if (need > 0) {
    for (const key of teacherDay.keys()) {
      const [tid, ds] = key.split('|')
      const d = Number(ds)
      const free = cal.lunchWindow.filter((p) => !teacherAt.has(`${tid}|${slotKey(d, p)}`)).length
      if (free < need) {
        const ids = cal.lunchWindow.flatMap((p) => teacherAt.get(`${tid}|${slotKey(d, p)}`) ?? [])
        add('H14', `${teachers.get(tid)!.name} has no lunch break on ${dayName(d)}.`, ...ids)
      }
    }
  }

  // H10 — locked placements must survive unchanged
  for (const locked of opts.mustKeep ?? []) {
    if (!timetable.placements.some((p) => samePlacement(p, locked))) {
      add('H10', `A locked class (${locked.assignmentId} at ${at(locked.day, locked.period)}) was moved or removed.`, locked.assignmentId)
    }
  }

  return conflicts
}
