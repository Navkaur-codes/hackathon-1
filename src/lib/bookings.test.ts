import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { solve } from '../solver/solve'
import type { CollegeData } from '../types'
import { approverOf, bookingsToDecide, busyOnDate, dateInfo, decideBooking, requestBooking, withdrawBooking, type BookingOutcome } from './bookings'
import { publish, setDraft } from './publish'

const [diet] = buildDemoColleges()
const NOW = '2026-10-27T10:00:00.000Z'
const TODAY = '2026-10-27'
const ok = (r: BookingOutcome) => {
  if (!r.ok) throw new Error(r.reason)
  return r.college
}
const live = (() => {
  const r = publish(setDraft(diet, solve(diet, { seed: 1 })), NOW)
  if (!r.ok) throw new Error()
  return r.college
})()
const cseLab = diet.rooms.find((r) => r.owner === 'diet-cse' && r.type === 'lab')!
const hall = diet.rooms.find((r) => r.owner === 'shared' && r.type === 'seminar')!
// a teaching day on which the CSE lab has a class (week of Mon 2 Nov 2026 — no holidays), and its used / free periods
const labDay = live.published!.timetable.placements.find((p) => p.roomId === cseLab.id)!.day
const DAY = `2026-11-0${2 + labDay}`
const NEXT_WEEK = `2026-11-${String(9 + labDay).padStart(2, '0')}`
const used = new Set(live.published!.timetable.placements.filter((p) => p.roomId === cseLab.id && p.day === labDay).flatMap((p) => Array.from({ length: p.length }, (_, i) => p.period + i)))
const freeP = [...Array(diet.calendar.periodsPerDay).keys()].filter((p) => !used.has(p))
const usedP = [...used]

describe('T5.8 single-date room requests', () => {
  it('free periods follow the published timetable on that real date; a holiday is all free', () => {
    expect(dateInfo(live, DAY)).toMatchObject({ status: 'teaching', day: labDay })
    const busy = busyOnDate(live, cseLab.id, DAY)
    expect([...busy.keys()].sort()).toEqual([...used].sort())
    // Diwali break (a holiday on a working day): no classes, so nothing is busy
    expect(busyOnDate(live, cseLab.id, '2026-11-09').size).toBe(0)
  })

  it('ECE asks for the CSE lab; only the CSE HOD decides; approved → those periods are taken that day only', () => {
    let c = ok(requestBooking(live, 'diet-ece', cseLab.id, DAY, [freeP[0]], 'Extra practical', NOW, TODAY))
    const b = c.bookings!.at(-1)!
    expect(b).toMatchObject({ status: 'requested', deptId: 'diet-ece', date: DAY })
    expect(approverOf(c, b)).toBe('diet-cse')
    expect(bookingsToDecide(c, 'diet-cse').map((x) => x.id)).toEqual([b.id])
    expect(decideBooking(c, b.id, 'diet-ece', true, NOW).ok).toBe(false)
    expect(decideBooking(c, b.id, 'collegeAdmin', true, NOW).ok).toBe(false)
    c = ok(decideBooking(c, b.id, 'diet-cse', true, NOW))
    expect(busyOnDate(c, cseLab.id, DAY).get(freeP[0])).toBe('booked: Extra practical')
    expect(busyOnDate(c, cseLab.id, NEXT_WEEK).get(freeP[0])).not.toBe('booked: Extra practical') // other dates unchanged
    // the same period cannot be booked twice
    expect(requestBooking(c, 'diet-me', cseLab.id, DAY, [freeP[0]], 'Test', NOW, TODAY)).toMatchObject({ ok: false, reason: expect.stringMatching(/not free/) })
    // the weekly pattern never changes
    expect(c.published).toBe(live.published)
  })

  it('a shared room is decided by the College Admin; a department’s own room is approved at once', () => {
    const shared = ok(requestBooking(live, 'diet-me', hall.id, DAY, [0], 'Guest lecture', NOW, TODAY))
    const s = shared.bookings!.at(-1)!
    expect(approverOf(shared, s)).toBe('collegeAdmin')
    expect(decideBooking(shared, s.id, 'diet-me', true, NOW).ok).toBe(false)
    expect(ok(decideBooking(shared, s.id, 'collegeAdmin', false, NOW)).bookings!.at(-1)!.status).toBe('declined')
    const own = ok(requestBooking(live, 'diet-cse', cseLab.id, DAY, [freeP[0]], 'Extra class', NOW, TODAY))
    expect(own.bookings!.at(-1)!.status).toBe('approved')
  })

  it('refuses busy periods, past dates, dates outside the semester, non-working days and an empty purpose', () => {
    expect(requestBooking(live, 'diet-ece', cseLab.id, DAY, [usedP[0]], 'X', NOW, TODAY)).toMatchObject({ ok: false, reason: expect.stringMatching(/not free/) })
    expect(requestBooking(live, 'diet-ece', cseLab.id, '2026-10-20', [freeP[0]], 'X', NOW, TODAY)).toMatchObject({ ok: false, reason: 'That date has passed.' })
    expect(requestBooking(live, 'diet-ece', cseLab.id, '2027-03-01', [freeP[0]], 'X', NOW, TODAY).ok).toBe(false)
    expect(requestBooking(live, 'diet-ece', cseLab.id, '2026-11-01', [freeP[0]], 'X', NOW, TODAY)).toMatchObject({ ok: false, reason: expect.stringMatching(/not a working day/) }) // Sunday
    expect(requestBooking(live, 'diet-ece', cseLab.id, DAY, [freeP[0]], '  ', NOW, TODAY).ok).toBe(false)
    expect(requestBooking(live, 'diet-ece', cseLab.id, DAY, [], 'X', NOW, TODAY).ok).toBe(false)
  })

  it('the asker withdraws; others cannot', () => {
    const c = ok(requestBooking(live, 'diet-ece', cseLab.id, DAY, [freeP[0]], 'X', NOW, TODAY))
    const id = c.bookings!.at(-1)!.id
    expect(withdrawBooking(c, id, 'diet-cse', NOW).ok).toBe(false)
    expect(ok(withdrawBooking(c, id, 'diet-ece', NOW)).bookings!.at(-1)!.status).toBe('withdrawn')
  })

  it('a re-publish that needs a booked period marks the booking "needs a new room"', () => {
    // an approved booking of a period the next version uses for a class
    const clashing: CollegeData = {
      ...live,
      bookings: [{ id: 'b1', collegeId: 'diet', roomId: cseLab.id, deptId: 'diet-ece', date: DAY, periods: [usedP[0]], purpose: 'Test', status: 'approved', createdAt: NOW }],
    }
    const r = publish(clashing, NOW)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.college.bookings![0].status).toBe('needsNewRoom')
    // a booking on a free period survives the re-publish
    const fine = publish({ ...clashing, bookings: [{ ...clashing.bookings![0], periods: [freeP[0]] }] }, NOW)
    if (fine.ok) expect(fine.college.bookings![0].status).toBe('approved')
  })
})
