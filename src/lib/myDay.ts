// A teacher's or a section's real day (rule G6), read from the **published** timetable only — a draft never
// reaches teachers or students (root §2). Today = the weekly pattern on that date + that date's substitutions.
// Also the teacher's own requests: leave for one date and office hours. Pure: callers pass "now" and "today".

import type { CollegeData, Id, LeaveRequest, Placement, Room, Section, SlotKey, Subject, Substitution, Teacher } from '../types'
import { dateInfo } from './bookings'
import { periodTimes, resolvedBreakSlots, slotKey } from './structure'

export type Who = { kind: 'teacher'; id: Id } | { kind: 'section'; id: Id }

export type DayClass = {
  placement: Placement
  subject: Subject
  section: Section
  room: Room | undefined
  /** Teacher of the weekly pattern. */
  regular: Teacher | undefined
  /** Teacher actually taking the class that date (the substitute when covered; undefined when uncovered). */
  teacher: Teacher | undefined
  /**
   * `own` the usual class · `covered` someone else takes it that date · `duty` a teacher covers someone else's class ·
   * `uncovered` the teacher is on leave and nobody is free.
   */
  kind: 'own' | 'covered' | 'duty' | 'uncovered'
  substitution?: Substitution
  start: string
  end: string
}

export type DayStatus = 'teaching' | 'holiday' | 'noClass' | 'off' | 'outside'

export type MyDay = {
  date: string
  /** Pattern day index of the date, null when the college does not work that weekday. */
  day: number | null
  status: DayStatus
  /** Holiday / no-class label. */
  label?: string
  classes: DayClass[]
  /** Section only: that date's break slots (resolved flexible lunch included) with their label. */
  breaks: Map<number, string>
}

/** The published weekly pattern, or undefined when nothing is published. */
export const publishedTimetable = (c: CollegeData) => c.published?.timetable

/** One real date for a teacher or a section — undefined when the college has published nothing. */
export function dayFor(c: CollegeData, date: string, who: Who): MyDay | undefined {
  const tt = publishedTimetable(c)
  if (!tt) return undefined
  const inside = date >= c.semester.startDate && date <= c.semester.endDate
  const info = dateInfo(c, date)
  const status: DayStatus = !inside ? 'outside' : !info ? 'off' : info.status
  const base: MyDay = { date, day: info?.day ?? null, status, label: info?.label, classes: [], breaks: new Map() }
  if (status !== 'teaching' || base.day === null) return base
  const day = base.day

  const times = periodTimes(c.calendar)
  const assignments = new Map(c.assignments.map((a) => [a.id, a]))
  const subjects = new Map(c.subjects.map((s) => [s.id, s]))
  const sections = new Map(c.sections.map((s) => [s.id, s]))
  const rooms = new Map(c.rooms.map((r) => [r.id, r]))
  const teachers = new Map(c.teachers.map((t) => [t.id, t]))
  const subs = c.substitutions.filter((s) => s.date === date)
  const subOf = (p: Placement) => subs.find((s) => s.assignmentId === p.assignmentId && s.period === p.period)

  const classes: DayClass[] = []
  for (const p of tt.placements) {
    if (p.day !== day) continue
    const a = assignments.get(p.assignmentId)
    const subject = a && subjects.get(a.subjectId)
    const section = a && sections.get(a.sectionId)
    if (!a || !subject || !section) continue
    const sub = subOf(p)
    const regularId = a.teacherId ?? undefined
    const takerId = sub ? (sub.substituteTeacherId ?? undefined) : regularId
    let kind: DayClass['kind'] | null
    if (who.kind === 'section') kind = a.sectionId !== who.id ? null : !sub ? 'own' : sub.status === 'uncovered' ? 'uncovered' : 'covered'
    else if (regularId === who.id) kind = !sub ? 'own' : sub.status === 'uncovered' ? 'uncovered' : 'covered'
    else kind = sub && sub.substituteTeacherId === who.id && sub.status !== 'uncovered' ? 'duty' : null
    if (!kind) continue
    classes.push({
      placement: p,
      subject,
      section,
      room: rooms.get(p.roomId),
      regular: regularId ? teachers.get(regularId) : undefined,
      teacher: takerId ? teachers.get(takerId) : undefined,
      kind,
      substitution: sub,
      start: times[p.period]?.start ?? '',
      end: times[p.period + p.length - 1]?.end ?? '',
    })
  }
  classes.sort((x, y) => x.placement.period - y.placement.period)

  if (who.kind === 'section') {
    const section = sections.get(who.id)
    if (section) {
      const busy = new Set<SlotKey>()
      for (const p of tt.placements)
        if (assignments.get(p.assignmentId)?.sectionId === section.id) for (let i = 0; i < p.length; i++) busy.add(slotKey(p.day, p.period + i))
      for (const [k, label] of resolvedBreakSlots(c, section, busy)) {
        const [d, period] = k.split('-').map(Number)
        if (d === day) base.breaks.set(period, label ?? 'Break')
      }
    }
  }
  return { ...base, classes }
}

/** Local calendar date of a moment as ISO (what "today" means on this device). */
export const localIso = (at: Date) =>
  `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`

export type NowNext = {
  day: MyDay
  /** What is happening at `at`. */
  now:
    | { kind: 'class'; cls: DayClass; until: string }
    | { kind: 'break'; label: string; until: string }
    | { kind: 'free' }
    | { kind: 'before' }
    | { kind: 'after' }
    | { kind: 'noClasses' }
  /** The next class later that day, if any. */
  next?: DayClass
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Now / Next for a teacher or a section at a moment (device local time), from the published timetable. */
export function nowNext(c: CollegeData, at: Date, who: Who): NowNext | undefined {
  const day = dayFor(c, localIso(at), who)
  if (!day) return undefined
  if (day.status !== 'teaching') return { day, now: { kind: 'noClasses' } }
  const times = periodTimes(c.calendar)
  const minutes = at.getHours() * 60 + at.getMinutes()
  const period = times.findIndex((t) => toMin(t.start) <= minutes && minutes < toMin(t.end))
  const next = day.classes.find((x) => toMin(x.start) > minutes)
  if (times.length === 0 || minutes < toMin(times[0].start)) return { day, now: { kind: 'before' }, next }
  if (period === -1) return { day, now: { kind: 'after' } }
  const cls = day.classes.find((x) => x.placement.period <= period && period < x.placement.period + x.placement.length)
  if (cls) return { day, now: { kind: 'class', cls, until: cls.end }, next }
  const label = day.breaks.get(period)
  if (label) return { day, now: { kind: 'break', label, until: times[period].end }, next }
  // a free slot with nothing left today means the day is over for this person
  return next ? { day, now: { kind: 'free' }, next } : { day, now: { kind: 'after' } }
}

export type WeekLoad = { perDay: number[]; week: number; maxPerDay: number; maxPerWeek: number }

/** A teacher's periods per working day and per week in the published pattern, against their limits. */
export function weekLoad(c: CollegeData, teacherId: Id): WeekLoad | undefined {
  const tt = publishedTimetable(c)
  const t = c.teachers.find((x) => x.id === teacherId)
  if (!tt || !t) return undefined
  const mine = new Set(c.assignments.filter((a) => a.teacherId === teacherId).map((a) => a.id))
  const perDay = c.calendar.days.map(() => 0)
  for (const p of tt.placements) if (mine.has(p.assignmentId) && perDay[p.day] !== undefined) perDay[p.day] += p.length
  return { perDay, week: perDay.reduce((s, n) => s + n, 0), maxPerDay: t.maxPerDay, maxPerWeek: t.maxPerWeek }
}

/** Slots of the week where the teacher teaches in the published pattern, with what. */
export function teachingSlots(c: CollegeData, teacherId: Id): Map<SlotKey, string> {
  const out = new Map<SlotKey, string>()
  const tt = publishedTimetable(c)
  if (!tt) return out
  const assignments = new Map(c.assignments.map((a) => [a.id, a]))
  const subjects = new Map(c.subjects.map((s) => [s.id, s]))
  const sections = new Map(c.sections.map((s) => [s.id, s]))
  for (const p of tt.placements) {
    const a = assignments.get(p.assignmentId)
    if (a?.teacherId !== teacherId) continue
    for (let i = 0; i < p.length; i++)
      out.set(slotKey(p.day, p.period + i), `${subjects.get(a.subjectId)?.code ?? 'class'} · ${sections.get(a.sectionId)?.name ?? ''}`)
  }
  return out
}

// ── Teacher requests ─────────────────────────────────────────────────

export type SelfOutcome = { ok: true; college: CollegeData } | { ok: false; reason: string }
const fail = (reason: string): SelfOutcome => ({ ok: false, reason })

/**
 * A teacher asks for leave on one date. The HOD approves it and Kaalchakra allots substitutes (screens in v0.7);
 * the weekly pattern never changes. Refused: no published timetable, past date, outside the semester, a day without
 * classes for this teacher, a second open request for the same date, no reason.
 */
export function requestLeave(c: CollegeData, teacherId: Id, date: string, reason: string, now: string, today: string): SelfOutcome {
  if (!c.teachers.some((t) => t.id === teacherId)) return fail('Unknown teacher.')
  if (!reason.trim()) return fail('Say why — the HOD reads it.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('Pick a date.')
  if (date < today) return fail('That date has passed.')
  const day = dayFor(c, date, { kind: 'teacher', id: teacherId })
  if (!day) return fail('Your college has not published a timetable yet.')
  if (day.status === 'outside') return fail('That date is outside the semester.')
  if (day.status !== 'teaching') return fail(`No classes that day${day.label ? ` (${day.label})` : ''} — no leave needed.`)
  if (!day.classes.some((x) => x.kind === 'own')) return fail('You have no classes that day — no leave needed.')
  if (c.leaves.some((l) => l.teacherId === teacherId && l.date === date && (l.status === 'pending' || l.status === 'approved')))
    return fail('You already asked for leave that day.')
  const leave: LeaveRequest = {
    id: `${teacherId}-leave-${date}-${c.leaves.length + 1}`,
    collegeId: c.college.id,
    teacherId,
    date,
    day: day.day!,
    reason: reason.trim(),
    status: 'pending',
    createdAt: now,
  }
  return { ok: true, college: { ...c, leaves: [...c.leaves, leave] } }
}

/** A teacher takes back a leave request the HOD has not decided yet. */
export function cancelLeave(c: CollegeData, teacherId: Id, leaveId: Id): SelfOutcome {
  const l = c.leaves.find((x) => x.id === leaveId)
  if (!l || l.teacherId !== teacherId) return fail('Not your request.')
  if (l.status !== 'pending') return fail('The HOD has already decided it.')
  return { ok: true, college: { ...c, leaves: c.leaves.filter((x) => x.id !== leaveId) } }
}

/** Mark / unmark one weekly slot as an office hour. Only slots where the teacher is free and available. */
export function toggleOfficeHour(c: CollegeData, teacherId: Id, slot: SlotKey): SelfOutcome {
  const t = c.teachers.find((x) => x.id === teacherId)
  if (!t) return fail('Unknown teacher.')
  const current = c.officeHours.find((o) => o.teacherId === teacherId)
  const slots = current?.slots ?? []
  if (!slots.includes(slot)) {
    const busy = teachingSlots(c, teacherId).get(slot)
    if (busy) return fail(`You teach then (${busy}).`)
    if (t.unavailable.includes(slot)) return fail('You are marked unavailable then.')
    if (c.calendar.blockedSlots.includes(slot)) return fail('That slot is blocked for the whole college.')
  }
  const next = slots.includes(slot) ? slots.filter((s) => s !== slot) : [...slots, slot]
  return { ok: true, college: setHours(c, teacherId, { slots: next, accepting: current?.accepting ?? true }) }
}

/** Whether students may ask this teacher for meetings. */
export const setAccepting = (c: CollegeData, teacherId: Id, accepting: boolean): SelfOutcome =>
  c.teachers.some((t) => t.id === teacherId)
    ? { ok: true, college: setHours(c, teacherId, { slots: c.officeHours.find((o) => o.teacherId === teacherId)?.slots ?? [], accepting }) }
    : fail('Unknown teacher.')

function setHours(c: CollegeData, teacherId: Id, v: { slots: SlotKey[]; accepting: boolean }): CollegeData {
  const rest = c.officeHours.filter((o) => o.teacherId !== teacherId)
  return { ...c, officeHours: [...rest, { collegeId: c.college.id, teacherId, ...v }] }
}
