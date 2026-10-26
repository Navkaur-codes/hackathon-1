import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { solve } from '../solver/solve'
import type { CollegeData } from '../types'
import { occupancy, weekStrip } from './finder'
import {
  acceptMeeting,
  bookableSlots,
  canMeet,
  declineMeeting,
  inboxOf,
  meetingCounts,
  meetingRooms,
  meetingsOf,
  proposeMeeting,
  requestMeeting,
  takeProposal,
  teachersFor,
  withdrawMeeting,
  type MeetOutcome,
} from './meetings'
import { publish, setDraft } from './publish'
import { slotKey } from './structure'

const [diet, dcas] = buildDemoColleges()
const NOW = '2026-10-27T10:00:00.000Z'
const CLOCK = { today: '2026-10-27', minutes: 0 }
const ok = (r: MeetOutcome) => {
  if (!r.ok) throw new Error(r.reason)
  return r.college
}
const live = (() => {
  const r = publish(setDraft(diet, solve(diet, { seed: 1 })), NOW)
  if (!r.ok) throw new Error(r.reasons.join())
  return r.college
})()
const tt = live.published!.timetable
const section = diet.sections[0]
const kaur = diet.teachers.find((t) => t.name.includes('Kaur'))!
// Mon 2 Nov 2026 (pattern day of Monday), no holiday that week
const MON = '2026-11-02'
const monDay = diet.calendar.weekdays.indexOf(1)
const ask = (over: Partial<Parameters<typeof requestMeeting>[1]> = {}) => {
  const period = bookableSlots(live, kaur.id, section.id, MON, CLOCK)[0].period
  return { studentName: 'Simran', sectionId: section.id, teacherId: kaur.id, date: MON, period, topic: 'DS doubts', note: '', ...over }
}

describe('T6.5 bookable = teacher free ∩ section free (published)', () => {
  it('every bookable slot is free for both on that pattern day, and every common free slot is bookable', () => {
    const occ = occupancy(live, tt)
    const t = weekStrip(live, occ, 'teacher', kaur.id)[monDay]
    const s = weekStrip(live, occ, 'section', section.id)[monDay]
    const expected = t.map((_, p) => p).filter((p) => t[p] === 'free' && s[p] === 'free')
    expect(bookableSlots(live, kaur.id, section.id, MON, CLOCK).map((b) => b.period)).toEqual(expected)
    expect(expected.length).toBeGreaterThan(0)
  })

  it('reads only the published version; nothing on holidays, past dates, started slots or the teacher\'s leave day', () => {
    expect(bookableSlots(setDraft(diet, tt), kaur.id, section.id, MON, CLOCK)).toEqual([])
    expect(bookableSlots(live, kaur.id, section.id, '2026-11-09', CLOCK)).toEqual([]) // Diwali
    expect(bookableSlots(live, kaur.id, section.id, '2026-10-20', CLOCK)).toEqual([]) // past
    const all = bookableSlots(live, kaur.id, section.id, MON, CLOCK)
    const late = bookableSlots(live, kaur.id, section.id, MON, { today: MON, minutes: 24 * 60 })
    expect(late).toEqual([])
    expect(all.length).toBeGreaterThan(late.length)
    const onLeave: CollegeData = { ...live, leaves: [{ id: 'L', collegeId: 'diet', teacherId: kaur.id, date: MON, day: monDay, reason: 'x', status: 'approved' }] }
    expect(bookableSlots(onLeave, kaur.id, section.id, MON, CLOCK)).toEqual([])
  })

  it('office hours are flagged, not required; a substitution duty that date takes the slot away', () => {
    const first = bookableSlots(live, kaur.id, section.id, MON, CLOCK)[0]
    const withHours = { ...live, officeHours: [{ collegeId: 'diet', teacherId: kaur.id, slots: [slotKey(monDay, first.period)], accepting: true }] }
    const flagged = bookableSlots(withHours, kaur.id, section.id, MON, CLOCK)
    expect(flagged.find((b) => b.period === first.period)!.officeHour).toBe(true)
    expect(flagged.filter((b) => b.officeHour)).toHaveLength(1)
    const duty: CollegeData = {
      ...live,
      substitutions: [{ id: 's', collegeId: 'diet', date: MON, assignmentId: 'x', day: monDay, period: first.period, originalTeacherId: 'y', substituteTeacherId: kaur.id, status: 'suggested', note: '' }],
    }
    expect(bookableSlots(duty, kaur.id, section.id, MON, CLOCK).map((b) => b.period)).not.toContain(first.period)
  })

  it('a student may ask only teachers of their section or department', () => {
    const list = teachersFor(live, section.id)
    expect(list.every((x) => canMeet(live, section.id, x.teacher.id))).toBe(true)
    expect(list[0].teaches.length).toBeGreaterThan(0)
    const outsider = diet.teachers.find((t) => t.deptId !== section.deptId && !diet.assignments.some((a) => a.sectionId === section.id && a.teacherId === t.id))!
    expect(canMeet(live, section.id, outsider.id)).toBe(false)
    const r = requestMeeting(live, ask({ teacherId: outsider.id }), NOW, CLOCK)
    expect(r.ok).toBe(false)
  })
})

describe('T6.6 requests and limits', () => {
  it('a request in a bookable slot is pending; outside one, without a name or topic, or to a closed teacher it is refused', () => {
    const c = ok(requestMeeting(live, ask(), NOW, CLOCK))
    expect(c.meetings.at(-1)).toMatchObject({ status: 'pending', date: MON, day: monDay, studentName: 'Simran', createdAt: NOW })
    const busy = tt.placements.find((p) => p.day === monDay && diet.assignments.find((a) => a.id === p.assignmentId)?.teacherId === kaur.id)!
    expect(requestMeeting(live, ask({ period: busy.period }), NOW, CLOCK).ok).toBe(false)
    expect(requestMeeting(live, ask({ studentName: ' ' }), NOW, CLOCK).ok).toBe(false)
    expect(requestMeeting(live, ask({ topic: '' }), NOW, CLOCK).ok).toBe(false)
    const closed = { ...live, officeHours: [{ collegeId: 'diet', teacherId: kaur.id, slots: [], accepting: false }] }
    expect(requestMeeting(closed, ask(), NOW, CLOCK).ok).toBe(false)
  })

  it('more open requests than the college allows are refused; a withdrawn one frees a place', () => {
    const max = diet.calendar.maxMeetingRequestsPerStudent
    const slots = bookableSlots(live, kaur.id, section.id, MON, CLOCK)
    let c = live
    for (let i = 0; i < max; i++) c = ok(requestMeeting(c, ask({ period: slots[i % slots.length].period, topic: `q${i}` }), NOW, CLOCK))
    const over = requestMeeting(c, ask({ topic: 'one more' }), NOW, CLOCK)
    expect(over.ok).toBe(false)
    if (!over.ok) expect(over.reason).toMatch(String(max))
    // the same name in another section is another student; withdrawing frees a place
    const s1 = diet.sections[1]
    const t1 = diet.assignments.find((a) => a.sectionId === s1.id)!.teacherId!
    const p1 = bookableSlots(c, t1, s1.id, MON, CLOCK)[0].period
    expect(requestMeeting(c, ask({ sectionId: s1.id, teacherId: t1, period: p1 }), NOW, CLOCK).ok).toBe(true)
    c = ok(withdrawMeeting(c, 'simran', section.id, c.meetings[0].id, NOW))
    expect(requestMeeting(c, ask({ topic: 'again' }), NOW, CLOCK).ok).toBe(true)
  })
})

describe('T6.7 teacher answers; who sees what', () => {
  const asked = ok(requestMeeting(live, ask(), NOW, CLOCK))
  const m = asked.meetings.at(-1)!

  it('accept with a free room; the slot is then taken for further requests and the room for other meetings', () => {
    const room = meetingRooms(asked, m.date, m.period)[0]
    const c = ok(acceptMeeting(asked, kaur.id, m.id, room.id, 'Come to the staff room', NOW, CLOCK))
    expect(c.meetings.at(-1)).toMatchObject({ status: 'accepted', roomId: room.id, reply: 'Come to the staff room' })
    expect(bookableSlots(c, kaur.id, section.id, MON, CLOCK).map((b) => b.period)).not.toContain(m.period)
    expect(meetingRooms(c, m.date, m.period).map((r) => r.id)).not.toContain(room.id)
    expect(meetingRooms(asked, m.date, m.period)[0].type).not.toBe('lab')
    // a room with a class then is never offered
    const used = tt.placements.find((p) => p.day === monDay)!
    expect(meetingRooms(asked, MON, used.period).map((r) => r.id)).not.toContain(used.roomId)
  })

  it('propose another time → the student takes it → accepted at the new time; decline; only the right people act', () => {
    const other = bookableSlots(asked, kaur.id, section.id, MON, CLOCK).find((b) => b.period !== m.period)!
    const p = ok(proposeMeeting(asked, kaur.id, m.id, MON, other.period, 'Later suits me', NOW, CLOCK))
    expect(p.meetings.at(-1)).toMatchObject({ status: 'proposed', proposed: { date: MON, period: other.period } })
    expect(takeProposal(p, 'Someone else', section.id, m.id, NOW, CLOCK).ok).toBe(false)
    const t = ok(takeProposal(p, 'Simran', section.id, m.id, NOW, CLOCK))
    expect(t.meetings.at(-1)).toMatchObject({ status: 'accepted', period: other.period, proposed: undefined })
    expect(ok(declineMeeting(asked, kaur.id, m.id, 'Exams week', NOW)).meetings.at(-1)).toMatchObject({ status: 'declined', reply: 'Exams week' })
    const another = diet.teachers.find((x) => x.id !== kaur.id)!
    expect(acceptMeeting(asked, another.id, m.id, undefined, '', NOW, CLOCK).ok).toBe(false)
    expect(declineMeeting(asked, another.id, m.id, '', NOW).ok).toBe(false)
  })

  it('a teacher sees only own requests; a student only their own; the HOD gets counts only', () => {
    expect(inboxOf(asked, kaur.id).map((x) => x.id)).toEqual([m.id])
    expect(inboxOf(asked, diet.teachers.find((x) => x.id !== kaur.id)!.id)).toEqual([])
    expect(meetingsOf(asked, 'SIMRAN ', section.id).map((x) => x.id)).toEqual([m.id])
    expect(meetingsOf(asked, 'Aman', section.id)).toEqual([])
    const counts = meetingCounts(asked, kaur.deptId)
    expect(counts).toEqual({ pending: 1, accepted: 0, needsReschedule: 0 })
    expect(Object.keys(counts)).not.toContain('topic')
    expect(meetingCounts(asked, diet.departments.find((d) => d.id !== kaur.deptId)!.id).pending).toBe(0)
  })
})

describe('T6.8 a re-publish that puts a class into an accepted meeting → needs reschedule', () => {
  it('only the clashing accepted meeting changes; the timetable is never bent around meetings', () => {
    const slots = bookableSlots(live, kaur.id, section.id, MON, CLOCK).map((b) => b.period)
    // a genuinely re-generated version 2 (valid, publishable) that needs one of these slots and leaves another free
    let found: { tt2: typeof tt; clash: number; keep: number } | undefined
    for (let seed = 2; seed < 40 && !found; seed++) {
      const tt2 = solve(diet, { seed })
      const occ = occupancy(diet, tt2)
      const busy = (p: number) => !!occ.teacher.get(kaur.id)?.has(slotKey(monDay, p)) || !!occ.section.get(section.id)?.has(slotKey(monDay, p))
      const clash = slots.find(busy)
      const keep = slots.find((p) => !busy(p))
      if (clash !== undefined && keep !== undefined) found = { tt2, clash, keep }
    }
    expect(found).toBeDefined()
    const { tt2, clash, keep } = found!
    let c = ok(requestMeeting(live, ask({ period: clash }), NOW, CLOCK))
    c = ok(requestMeeting(c, ask({ period: keep, topic: 'second' }), NOW, CLOCK))
    const [a, b] = c.meetings.slice(-2)
    c = ok(acceptMeeting(c, kaur.id, a.id, undefined, '', NOW, CLOCK))
    c = ok(acceptMeeting(c, kaur.id, b.id, undefined, '', NOW, CLOCK))
    const r = publish(setDraft(c, tt2), NOW)
    if (!r.ok) throw new Error(r.reasons.join())
    expect(r.college.published!.version).toBe(2)
    expect(r.college.meetings.find((x) => x.id === a.id)!.status).toBe('needsReschedule')
    expect(r.college.meetings.find((x) => x.id === b.id)!.status).toBe('accepted')
    expect(r.college.published!.timetable).toBe(tt2)
  })

  it('meetingsAfterPublish on its own: a class in the slot of the teacher or the section flags it', async () => {
    const { meetingsAfterPublish } = await import('./meetings')
    const slots = bookableSlots(live, kaur.id, section.id, MON, CLOCK)
    let c = ok(requestMeeting(live, ask({ period: slots[0].period }), NOW, CLOCK))
    const m = c.meetings.at(-1)!
    c = ok(acceptMeeting(c, kaur.id, m.id, undefined, '', NOW, CLOCK))
    expect(meetingsAfterPublish(c).meetings.at(-1)!.status).toBe('accepted')
    const sectionClass = tt.placements.find((p) => diet.assignments.find((x) => x.id === p.assignmentId)?.sectionId === section.id && p.length === 1)!
    const next = { ...tt, placements: tt.placements.map((p) => (p === sectionClass ? { ...p, day: monDay, period: m.period } : p)) }
    const flagged = meetingsAfterPublish({ ...c, published: { timetable: next, version: 2, at: NOW } })
    expect(flagged.meetings.at(-1)!.status).toBe('needsReschedule')
  })

  it('works on another college shape (DCAS)', () => {
    const r = publish(setDraft(dcas, solve(dcas, { seed: 1 })), NOW)
    if (!r.ok) throw new Error()
    const s = dcas.sections[0]
    const t = teachersFor(r.college, s.id)[0].teacher
    // the first date of that week where both have a free slot (a busy section may share none on some days)
    const date = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].find((d) => bookableSlots(r.college, t.id, s.id, d, CLOCK).length > 0)!
    const slot = bookableSlots(r.college, t.id, s.id, date, CLOCK)[0]
    expect(slot).toBeDefined()
    expect(requestMeeting(r.college, { studentName: 'Aman', sectionId: s.id, teacherId: t.id, date, period: slot.period, topic: 'Project', note: '' }, NOW, CLOCK).ok).toBe(true)
  })
})
