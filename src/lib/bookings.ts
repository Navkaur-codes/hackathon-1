// Single-date room requests (user request before v0.6, pulled forward from v0.7). A booking is for ONE real date
// and never changes the weekly pattern: a period is free when the **published** timetable has no class in the room
// on that date's pattern day (holiday / no-class dates have none), it is not a blocked slot of a teaching day, and
// no other approved booking holds it. Pure: the caller passes "now" and "today".

import type { CollegeData, Id, RoomBooking } from '../types'
import { semesterDates } from './semester'
import { slotKey } from './structure'

export type BookingOutcome = { ok: true; college: CollegeData } | { ok: false; reason: string }
const fail = (reason: string): BookingOutcome => ({ ok: false, reason })

/** The calendar facts of one real date (status, pattern day, label). */
export function dateInfo(c: CollegeData, date: string) {
  return semesterDates({ calendar: c.calendar, semester: { ...c.semester, startDate: date, endDate: date } })[0]
}

/** Periods of a room that are NOT free on a date, with the reason (free periods are absent). */
export function busyOnDate(c: CollegeData, roomId: Id, date: string, exceptBookingId?: Id): Map<number, string> {
  const out = new Map<number, string>()
  const info = dateInfo(c, date)
  const teaching = info && info.status === 'teaching' && info.day !== null
  if (teaching) {
    const day = info.day!
    for (let p = 0; p < c.calendar.periodsPerDay; p++) if (c.calendar.blockedSlots.includes(slotKey(day, p))) out.set(p, 'blocked for the whole college')
    const assignments = new Map(c.assignments.map((a) => [a.id, a]))
    const subjects = new Map(c.subjects.map((s) => [s.id, s]))
    const sections = new Map(c.sections.map((s) => [s.id, s]))
    for (const pl of c.published?.timetable.placements ?? [])
      if (pl.roomId === roomId && pl.day === day)
        for (let i = 0; i < pl.length; i++) {
          const a = assignments.get(pl.assignmentId)
          out.set(pl.period + i, `${subjects.get(a?.subjectId ?? '')?.code ?? 'a class'} for ${sections.get(a?.sectionId ?? '')?.name ?? '?'}`)
        }
  }
  for (const b of c.bookings ?? [])
    if (b.id !== exceptBookingId && b.roomId === roomId && b.date === date && b.status === 'approved')
      for (const p of b.periods) out.set(p, `booked: ${b.purpose}`)
  return out
}

/** Who decides a booking: the owning department, or the College Admin for a shared room. */
export function approverOf(c: CollegeData, b: Pick<RoomBooking, 'roomId'>): Id | 'collegeAdmin' {
  const owner = c.rooms.find((r) => r.id === b.roomId)?.owner
  return !owner || owner === 'shared' ? 'collegeAdmin' : owner
}

let seq = 0

/**
 * A department asks for a room on one date. Its own room is approved at once; another department's room waits for
 * that HOD, a shared room for the College Admin.
 */
export function requestBooking(
  c: CollegeData,
  deptId: Id,
  roomId: Id,
  date: string,
  periods: number[],
  purpose: string,
  now: string,
  today: string,
): BookingOutcome {
  const room = c.rooms.find((r) => r.id === roomId)
  if (!room) return fail('That room does not exist.')
  if (!c.departments.some((d) => d.id === deptId)) return fail('Unknown department.')
  if (!purpose.trim()) return fail('Say what the room is for (e.g. extra class, seminar, test).')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('Pick a date.')
  if (date < today) return fail('That date has passed.')
  if (date < c.semester.startDate || date > c.semester.endDate) return fail('Pick a date inside the semester.')
  const info = dateInfo(c, date)
  if (!info || info.day === null) return fail('That is not a working day of the college.')
  const ps = [...new Set(periods)].sort((a, b) => a - b)
  if (ps.length === 0) return fail('Pick at least one period.')
  if (ps.some((p) => p < 0 || p >= c.calendar.periodsPerDay)) return fail('That period does not exist.')
  const busy = busyOnDate(c, roomId, date)
  const clash = ps.find((p) => busy.has(p))
  if (clash !== undefined) return fail(`P${clash + 1} is not free in ${room.name} that day (${busy.get(clash)}).`)
  const own = room.owner === deptId
  const booking: RoomBooking = {
    id: `${c.college.id}-bk-${now.replace(/\D/g, '').slice(0, 14)}-${(seq++).toString(36)}`,
    collegeId: c.college.id,
    roomId,
    deptId,
    date,
    periods: ps,
    purpose: purpose.trim(),
    status: own ? 'approved' : 'requested',
    createdAt: now,
    ...(own ? { decidedAt: now } : {}),
  }
  return { ok: true, college: { ...c, bookings: [...(c.bookings ?? []), booking] } }
}

const setStatus = (c: CollegeData, id: Id, status: RoomBooking['status'], at: string): CollegeData => ({
  ...c,
  bookings: (c.bookings ?? []).map((b) => (b.id === id ? { ...b, status, decidedAt: at } : b)),
})

/** The approver (owning HOD, or the College Admin for a shared room) says yes or no. */
export function decideBooking(c: CollegeData, id: Id, approver: Id | 'collegeAdmin', yes: boolean, at: string): BookingOutcome {
  const b = (c.bookings ?? []).find((x) => x.id === id)
  if (!b) return fail('That booking no longer exists.')
  if (b.status !== 'requested') return fail('This booking has already been decided.')
  if (approverOf(c, b) !== approver)
    return fail(approverOf(c, b) === 'collegeAdmin' ? 'Bookings of a shared room are decided by the College Admin.' : 'Only the department that owns the room can decide this booking.')
  if (yes) {
    const busy = busyOnDate(c, b.roomId, b.date, b.id)
    const clash = b.periods.find((p) => busy.has(p))
    if (clash !== undefined) return fail(`P${clash + 1} is no longer free that day (${busy.get(clash)}).`)
  }
  return { ok: true, college: setStatus(c, id, yes ? 'approved' : 'declined', at) }
}

/** The asking department withdraws its booking (pending or approved). */
export function withdrawBooking(c: CollegeData, id: Id, deptId: Id, at: string): BookingOutcome {
  const b = (c.bookings ?? []).find((x) => x.id === id)
  if (!b) return fail('That booking no longer exists.')
  if (b.deptId !== deptId) return fail('Only the department that asked can withdraw it.')
  if (b.status !== 'requested' && b.status !== 'approved' && b.status !== 'needsNewRoom') return fail('This booking is already closed.')
  return { ok: true, college: setStatus(c, id, 'withdrawn', at) }
}

/** After a new version is published: approved bookings whose periods now hold a class need a new room. */
export function bookingsAfterPublish(c: CollegeData): CollegeData {
  if (!c.bookings?.length) return c
  return {
    ...c,
    bookings: c.bookings.map((b) => {
      if (b.status !== 'approved') return b
      const busy = busyOnDate(c, b.roomId, b.date, b.id)
      return b.periods.some((p) => busy.has(p)) ? { ...b, status: 'needsNewRoom' as const } : b
    }),
  }
}

/** Bookings that wait for this approver, oldest first. */
export const bookingsToDecide = (c: CollegeData, approver: Id | 'collegeAdmin') =>
  (c.bookings ?? []).filter((b) => b.status === 'requested' && approverOf(c, b) === approver).sort((a, b) => a.createdAt.localeCompare(b.createdAt))

/** A department's own bookings, newest date first. */
export const bookingsOf = (c: CollegeData, deptId: Id) => (c.bookings ?? []).filter((b) => b.deptId === deptId).sort((a, b) => b.date.localeCompare(a.date))
