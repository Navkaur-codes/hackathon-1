// Meet-a-Teacher (root §3 meeting rules). A student asks a teacher of their section or department for one slot on
// a real date where both are free in the **published** timetable (finder.commonFree on the pattern day, then that
// date's leave, substitution duties and accepted meetings). Office hours are highlighted, not required. Meetings
// never block teaching: a newer published version that needs the slot turns them into `needsReschedule`.
// Pure: callers pass "now" (ISO) and the clock (`Clock`).

import type { CollegeData, Id, MeetingRequest, Room } from '../types'
import { busyOnDate, dateInfo } from './bookings'
import { commonFree, occupancy } from './finder'
import { periodTimes, slotKey } from './structure'

export type MeetOutcome = { ok: true; college: CollegeData } | { ok: false; reason: string }
const fail = (reason: string): MeetOutcome => ({ ok: false, reason })

/** Today's date and minutes past midnight on this device — slots that have started are no longer bookable. */
export type Clock = { today: string; minutes: number }

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** A student may ask a teacher who teaches their section or belongs to its department. */
export function canMeet(c: CollegeData, sectionId: Id, teacherId: Id): boolean {
  const section = c.sections.find((s) => s.id === sectionId)
  const teacher = c.teachers.find((t) => t.id === teacherId)
  if (!section || !teacher) return false
  return teacher.deptId === section.deptId || c.assignments.some((a) => a.sectionId === sectionId && a.teacherId === teacherId)
}

/** Teachers a section may ask: those who teach it first (with what), then the rest of its department. */
export function teachersFor(c: CollegeData, sectionId: Id) {
  const section = c.sections.find((s) => s.id === sectionId)
  if (!section) return []
  const subjects = new Map(c.subjects.map((s) => [s.id, s.code]))
  const teaches = new Map<Id, string[]>()
  for (const a of c.assignments)
    if (a.sectionId === sectionId && a.teacherId) teaches.set(a.teacherId, [...(teaches.get(a.teacherId) ?? []), subjects.get(a.subjectId) ?? ''])
  return c.teachers
    .filter((t) => canMeet(c, sectionId, t.id))
    .map((t) => ({ teacher: t, teaches: teaches.get(t.id) ?? [], accepting: c.officeHours.find((o) => o.teacherId === t.id)?.accepting ?? true }))
    .sort((a, b) => Number(b.teaches.length > 0) - Number(a.teaches.length > 0) || a.teacher.name.localeCompare(b.teacher.name))
}

export type Bookable = { period: number; start: string; end: string; officeHour: boolean }

/**
 * Slots on `date` where teacher and section are both free in the published timetable: commonFree on the pattern day
 * (classes, breaks, blocked slots, unavailability), minus that date's leave and substitution duties, the teacher's
 * accepted meetings and slots that have already started. Empty when nothing is published or it is not a teaching day.
 */
export function bookableSlots(c: CollegeData, teacherId: Id, sectionId: Id, date: string, clock: Clock, exceptId?: Id): Bookable[] {
  const tt = c.published?.timetable
  if (!tt || date < clock.today || date < c.semester.startDate || date > c.semester.endDate) return []
  const info = dateInfo(c, date)
  if (!info || info.status !== 'teaching' || info.day === null) return []
  if (c.leaves.some((l) => l.teacherId === teacherId && l.date === date && l.status === 'approved')) return []
  const day = info.day
  const free = new Set(
    commonFree(c, occupancy(c, tt), [
      { kind: 'teacher', id: teacherId },
      { kind: 'section', id: sectionId },
    ]),
  )
  const duty = new Set(c.substitutions.filter((s) => s.date === date && s.substituteTeacherId === teacherId).map((s) => s.period))
  const met = new Set(c.meetings.filter((m) => m.id !== exceptId && m.teacherId === teacherId && m.date === date && m.status === 'accepted').map((m) => m.period))
  const hours = new Set(c.officeHours.find((o) => o.teacherId === teacherId)?.slots ?? [])
  return periodTimes(c.calendar)
    .filter((t) => free.has(slotKey(day, t.index)) && !duty.has(t.index) && !met.has(t.index))
    .filter((t) => date > clock.today || toMin(t.start) > clock.minutes)
    .map((t) => ({ period: t.index, start: t.start, end: t.end, officeHour: hours.has(slotKey(day, t.index)) }))
}

const open = (m: MeetingRequest) => m.status === 'pending' || m.status === 'proposed'
const same = (m: MeetingRequest, studentName: string, sectionId: Id) => m.sectionId === sectionId && m.studentName.trim().toLowerCase() === studentName.trim().toLowerCase()

export type MeetingAsk = { studentName: string; sectionId: Id; teacherId: Id; date: string; period: number; topic: string; note: string }

/** A student asks for a meeting. Refused beyond the college's max open requests, outside bookable slots, or with a teacher they may not ask. */
export function requestMeeting(c: CollegeData, ask: MeetingAsk, now: string, clock: Clock): MeetOutcome {
  if (!ask.studentName.trim()) return fail('Type your name first — the teacher needs to know who is asking.')
  if (!ask.topic.trim()) return fail('Say what it is about.')
  if (!canMeet(c, ask.sectionId, ask.teacherId)) return fail('You can ask only teachers of your section or department.')
  if (c.officeHours.find((o) => o.teacherId === ask.teacherId)?.accepting === false) return fail('This teacher is not taking meeting requests right now.')
  const max = c.calendar.maxMeetingRequestsPerStudent
  const mine = c.meetings.filter((m) => same(m, ask.studentName, ask.sectionId) && open(m)).length
  if (mine >= max) return fail(`You already have ${mine} open ${mine === 1 ? 'request' : 'requests'} — the most your college allows is ${max}. Wait for an answer or withdraw one.`)
  if (!bookableSlots(c, ask.teacherId, ask.sectionId, ask.date, clock).some((b) => b.period === ask.period))
    return fail('That time is not free for both of you — pick one of the free slots.')
  const m: MeetingRequest = {
    id: `${c.college.id}-meet-${c.meetings.length + 1}-${ask.date}-${ask.period}`,
    collegeId: c.college.id,
    studentName: ask.studentName.trim(),
    sectionId: ask.sectionId,
    teacherId: ask.teacherId,
    date: ask.date,
    day: dateInfo(c, ask.date)!.day!,
    period: ask.period,
    topic: ask.topic.trim(),
    note: ask.note.trim(),
    status: 'pending',
    createdAt: now,
  }
  return { ok: true, college: { ...c, meetings: [...c.meetings, m] } }
}

function change(c: CollegeData, id: Id, check: (m: MeetingRequest) => string | null, patch: (m: MeetingRequest) => Partial<MeetingRequest>): MeetOutcome {
  const m = c.meetings.find((x) => x.id === id)
  if (!m) return fail('No such meeting request.')
  const why = check(m)
  if (why) return fail(why)
  return { ok: true, college: { ...c, meetings: c.meetings.map((x) => (x.id === id ? { ...x, ...patch(x) } : x)) } }
}

/** Rooms free on that date and period for a meeting (no class, booking or accepted meeting there). */
export function meetingRooms(c: CollegeData, date: string, period: number, exceptId?: Id): Room[] {
  const taken = new Set(c.meetings.filter((m) => m.id !== exceptId && m.status === 'accepted' && m.date === date && m.period === period && m.roomId).map((m) => m.roomId))
  // talking rooms before labs, smallest first
  const order = { seminar: 0, lecture: 1, lab: 2 }
  return c.rooms
    .filter((r) => !taken.has(r.id) && !busyOnDate(c, r.id, date).has(period))
    .sort((a, b) => order[a.type] - order[b.type] || a.capacity - b.capacity)
}

const teacherOnly = (teacherId: Id) => (m: MeetingRequest) =>
  m.teacherId !== teacherId ? 'Not your request.' : m.status !== 'pending' && m.status !== 'needsReschedule' ? 'This request is already answered.' : null

/** The teacher accepts, optionally in a free room. The slot must still be free for both. */
export function acceptMeeting(c: CollegeData, teacherId: Id, id: Id, roomId: Id | undefined, reply: string, at: string, clock: Clock): MeetOutcome {
  return change(
    c,
    id,
    (m) =>
      teacherOnly(teacherId)(m) ??
      (!bookableSlots(c, teacherId, m.sectionId, m.date, clock, m.id).some((b) => b.period === m.period)
        ? 'That time is no longer free — propose another one.'
        : roomId && !meetingRooms(c, m.date, m.period, m.id).some((r) => r.id === roomId)
          ? 'That room is taken then.'
          : null),
    () => ({ status: 'accepted', roomId: roomId || undefined, reply: reply.trim() || undefined, decidedAt: at }),
  )
}

/** The teacher proposes another bookable time; the student takes it or not. */
export function proposeMeeting(c: CollegeData, teacherId: Id, id: Id, date: string, period: number, reply: string, at: string, clock: Clock): MeetOutcome {
  return change(
    c,
    id,
    (m) =>
      teacherOnly(teacherId)(m) ??
      (!bookableSlots(c, teacherId, m.sectionId, date, clock, m.id).some((b) => b.period === period) ? 'That time is not free for both of you.' : null),
    () => ({ status: 'proposed', proposed: { date, period }, reply: reply.trim() || undefined, decidedAt: at }),
  )
}

export const declineMeeting = (c: CollegeData, teacherId: Id, id: Id, reply: string, at: string): MeetOutcome =>
  change(c, id, teacherOnly(teacherId), () => ({ status: 'declined', reply: reply.trim() || undefined, decidedAt: at }))

const studentOnly = (studentName: string, sectionId: Id) => (m: MeetingRequest) => (same(m, studentName, sectionId) ? null : 'Not your request.')

/** The student takes the teacher's proposed time (if it is still free) — the meeting is then accepted. */
export function takeProposal(c: CollegeData, studentName: string, sectionId: Id, id: Id, at: string, clock: Clock): MeetOutcome {
  return change(
    c,
    id,
    (m) =>
      studentOnly(studentName, sectionId)(m) ??
      (m.status !== 'proposed' || !m.proposed
        ? 'There is no new time to take.'
        : !bookableSlots(c, m.teacherId, sectionId, m.proposed.date, clock, m.id).some((b) => b.period === m.proposed!.period)
          ? 'That time is no longer free — ask again.'
          : null),
    (m) => ({ status: 'accepted', date: m.proposed!.date, day: dateInfo(c, m.proposed!.date)!.day!, period: m.proposed!.period, proposed: undefined, decidedAt: at }),
  )
}

export const withdrawMeeting = (c: CollegeData, studentName: string, sectionId: Id, id: Id, at: string): MeetOutcome =>
  change(
    c,
    id,
    (m) => studentOnly(studentName, sectionId)(m) ?? (m.status === 'declined' || m.status === 'withdrawn' ? 'Already closed.' : null),
    () => ({ status: 'withdrawn', decidedAt: at }),
  )

/**
 * After a new version is published: an accepted meeting whose slot now holds a class of its teacher or section
 * becomes `needsReschedule` (meetings never block teaching). Called by `publish`.
 */
export function meetingsAfterPublish(c: CollegeData): CollegeData {
  const tt = c.published?.timetable
  if (!tt || c.meetings.length === 0) return c
  const occ = occupancy(c, tt)
  const clash = (m: MeetingRequest) => {
    const k = slotKey(m.day, m.period)
    return !!occ.teacher.get(m.teacherId)?.has(k) || !!occ.section.get(m.sectionId)?.has(k)
  }
  return { ...c, meetings: c.meetings.map((m) => (m.status === 'accepted' && clash(m) ? { ...m, status: 'needsReschedule' } : m)) }
}

export const inboxOf = (c: CollegeData, teacherId: Id) =>
  c.meetings.filter((m) => m.teacherId === teacherId).sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period)

export const meetingsOf = (c: CollegeData, studentName: string, sectionId: Id) =>
  c.meetings.filter((m) => same(m, studentName, sectionId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

/** For the HOD: counts only — never who asked or about what (root §3). */
export function meetingCounts(c: CollegeData, deptId: Id) {
  const teachers = new Set(c.teachers.filter((t) => t.deptId === deptId).map((t) => t.id))
  const counts = { pending: 0, accepted: 0, needsReschedule: 0 }
  for (const m of c.meetings)
    if (teachers.has(m.teacherId) && (m.status === 'pending' || m.status === 'accepted' || m.status === 'needsReschedule')) counts[m.status]++
  return counts
}
