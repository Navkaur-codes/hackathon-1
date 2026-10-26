import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { solve } from '../solver/solve'
import type { CollegeData } from '../types'
import { approveLeave, cancelApprovedLeave, confirmCover, coverAfterPublish, coverOf, coverOptions, dateCheck, leaveInbox, leaveWaiting, rejectLeave, swapSubstitute } from './leave'
import { dayFor, requestLeave } from './myDay'
import { publish, setDraft } from './publish'
import { periodTimes, slotKey } from './structure'
import { approveUnavailable, rejectUnavailable, requestUnavailable, unavailabilityInbox, withdrawUnavailable } from './unavailability'

const [diet] = buildDemoColleges()
const NOW = '2026-10-27T10:00:00.000Z'
const TODAY = '2026-10-27'
const ok = <T extends { ok: boolean }>(r: T) => {
  if (!r.ok) throw new Error((r as unknown as { reason: string }).reason)
  return (r as unknown as { college: CollegeData }).college
}
const live = (() => {
  const r = publish(setDraft(diet, solve(diet, { seed: 1 })), NOW)
  if (!r.ok) throw new Error(r.reasons.join())
  return r.college
})()
const tt = live.published!.timetable
const kaur = diet.teachers.find((t) => t.name.includes('Kaur'))!
const teacherOf = new Map(diet.assignments.map((a) => [a.id, a.teacherId]))
// a date in the week of 16 Nov (no holiday) on Kaur's busiest pattern day
const busiest = diet.calendar.days
  .map((_, d) => ({ d, n: tt.placements.filter((p) => p.day === d && teacherOf.get(p.assignmentId) === kaur.id).length }))
  .sort((a, b) => b.n - a.n)[0].d
const DATE = `2026-11-${String(16 + busiest).padStart(2, '0')}`
const asked = ok(requestLeave(live, kaur.id, DATE, 'Conference', NOW, TODAY))
const leaveId = asked.leaves.at(-1)!.id
const approved = ok(approveLeave(asked, leaveId, NOW, TODAY))

describe('T7.6 approve leave → absence mode', () => {
  it('one cover per class of that date, each substitute free, available, within limits and with lunch; verified', () => {
    const mine = dayFor(asked, DATE, { kind: 'teacher', id: kaur.id })!.classes.filter((x) => x.kind === 'own')
    const cover = coverOf(approved, leaveId)
    expect(cover).toHaveLength(mine.length)
    expect(cover.map((s) => [s.assignmentId, s.period])).toEqual(mine.map((x) => [x.placement.assignmentId, x.placement.period]))
    expect(approved.leaves.find((l) => l.id === leaveId)).toMatchObject({ status: 'approved', decidedAt: NOW })
    expect(dateCheck(approved, DATE)).toEqual([])
    for (const s of cover.filter((x) => x.substituteTeacherId)) {
      const t = diet.teachers.find((x) => x.id === s.substituteTeacherId)!
      expect(t.id).not.toBe(kaur.id)
      expect(t.unavailable).not.toContain(slotKey(s.day, s.period))
      const duties = dayFor(approved, DATE, { kind: 'teacher', id: t.id })!.classes.filter((x) => x.kind !== 'covered')
      expect(duties.reduce((n, x) => n + x.placement.length, 0)).toBeLessThanOrEqual(t.maxPerDay)
    }
    // the weekly pattern never changes; other dates untouched
    expect(approved.published).toBe(live.published)
    expect(approved.substitutions.every((s) => s.date === DATE)).toBe(true)
  })

  it('the teacher sees covered classes; a substitute sees the duty; the section sees the substitute', () => {
    const first = coverOf(approved, leaveId).find((s) => s.substituteTeacherId)!
    expect(dayFor(approved, DATE, { kind: 'teacher', id: kaur.id })!.classes.find((x) => x.placement.period === first.period)!.kind).toBe('covered')
    expect(dayFor(approved, DATE, { kind: 'teacher', id: first.substituteTeacherId! })!.classes.some((x) => x.kind === 'duty')).toBe(true)
  })

  it('swap only to a ranked free teacher → confirmed and still verified; confirm keeps the suggestion', () => {
    const s = coverOf(approved, leaveId).find((x) => x.substituteTeacherId)!
    const options = coverOptions(approved, s.id)
    expect(options.map((o) => o.teacherId)).toContain(s.substituteTeacherId)
    const other = options.find((o) => o.teacherId !== s.substituteTeacherId)
    expect(other).toBeDefined()
    if (other) {
      const c = ok(swapSubstitute(approved, s.id, other.teacherId))
      expect(c.substitutions.find((x) => x.id === s.id)).toMatchObject({ substituteTeacherId: other.teacherId, status: 'confirmed' })
      expect(dateCheck(c, DATE)).toEqual([])
    }
    const busy = tt.placements.find((p) => p.day === s.day && p.period === s.period && teacherOf.get(p.assignmentId) !== kaur.id)!
    expect(swapSubstitute(approved, s.id, teacherOf.get(busy.assignmentId)!).ok).toBe(false)
    expect(swapSubstitute(approved, s.id, kaur.id).ok).toBe(false)
    expect(ok(confirmCover(approved, s.id)).substitutions.find((x) => x.id === s.id)!.status).toBe('confirmed')
  })

  it('reject keeps no cover; cancel removes the cover; decided requests and past dates are refused', () => {
    const r = ok(rejectLeave(asked, leaveId, 'Exams that week', NOW))
    expect(r.leaves.find((l) => l.id === leaveId)).toMatchObject({ status: 'rejected', reply: 'Exams that week' })
    expect(r.substitutions).toEqual([])
    const off = ok(cancelApprovedLeave(approved, leaveId, NOW))
    expect(off.leaves.find((l) => l.id === leaveId)!.status).toBe('cancelled')
    expect(coverOf(off, leaveId)).toEqual([])
    expect(approveLeave(approved, leaveId, NOW, TODAY).ok).toBe(false)
    expect(approveLeave(asked, leaveId, NOW, '2026-12-01').ok).toBe(false)
    // nothing published → nothing to decide on
    expect(approveLeave({ ...asked, published: undefined }, leaveId, NOW, TODAY).ok).toBe(false)
    // a cancelled date may be asked for again
    expect(requestLeave(off, kaur.id, DATE, 'Again', NOW, TODAY).ok).toBe(true)
  })

  it('inbox and badge by department', () => {
    expect(leaveInbox(asked, kaur.deptId, TODAY).pending.map((l) => l.id)).toEqual([leaveId])
    expect(leaveInbox(asked, diet.departments.find((d) => d.id !== kaur.deptId)!.id, TODAY).pending).toEqual([])
    expect(leaveInbox(approved, kaur.deptId, TODAY).upcoming.map((l) => l.id)).toEqual([leaveId])
    expect(leaveWaiting(asked, kaur.deptId)).toBe(1)
    expect(leaveWaiting(approved)).toBe(0)
  })

  it('a re-publish plans the cover again against the new version, keeping confirmed choices that are still free', () => {
    const s = coverOf(approved, leaveId).find((x) => x.substituteTeacherId)!
    const confirmed = ok(confirmCover(approved, s.id))
    const r = publish(setDraft(confirmed, solve(diet, { seed: 5 })), NOW)
    if (!r.ok) throw new Error(r.reasons.join())
    const after = r.college
    const kaurNow = dayFor(after, DATE, { kind: 'teacher', id: kaur.id })!.classes.filter((x) => x.kind !== 'duty')
    expect(coverOf(after, leaveId).map((x) => [x.assignmentId, x.period])).toEqual(kaurNow.map((x) => [x.placement.assignmentId, x.placement.period]))
    expect(dateCheck(after, DATE)).toEqual([])
    // same class still at the same time → the confirmed teacher kept when free
    const again = coverOf(after, leaveId).find((x) => x.assignmentId === s.assignmentId && x.period === s.period)
    if (again && coverOptions(after, again.id).some((o) => o.teacherId === s.substituteTeacherId)) expect(again.substituteTeacherId).toBe(s.substituteTeacherId)
    // past leave is left alone
    expect(coverAfterPublish(approved, '2026-12-31')).toBe(approved)
  })
})

describe('T7.7 unavailability requests', () => {
  const k = slotKey(0, periodTimes(diet.calendar).length - 1)
  it('teacher asks, HOD approves → slots unavailable, department back to Draft, draft out of date', () => {
    const ready = { ...live, draft: tt, departments: live.departments.map((d) => ({ ...d, status: 'ready' as const })) }
    const c = ok(requestUnavailable(ready, kaur.id, [k, k, 'x-y' as never], 'Evening course', NOW))
    const req = c.unavailabilityRequests!.at(-1)!
    expect(req).toMatchObject({ slots: [k], status: 'pending' })
    expect(unavailabilityInbox(c, kaur.deptId)[0].id).toBe(req.id)
    const a = ok(approveUnavailable(c, req.id, NOW))
    expect(a.teachers.find((t) => t.id === kaur.id)!.unavailable).toContain(k)
    expect(a.departments.find((d) => d.id === kaur.deptId)!.status).toBe('draft')
    expect(a.departments.filter((d) => d.id !== kaur.deptId).every((d) => d.status === 'ready')).toBe(true)
    expect(a.draftStale).toBe(true)
    expect(approveUnavailable(a, req.id, NOW).ok).toBe(false)
  })

  it('refused without new slots or a reason; reject and withdraw', () => {
    expect(requestUnavailable(live, kaur.id, [], 'x', NOW).ok).toBe(false)
    expect(requestUnavailable(live, kaur.id, [k], ' ', NOW).ok).toBe(false)
    const c = ok(requestUnavailable(live, kaur.id, [k], 'Course', NOW))
    const id = c.unavailabilityRequests!.at(-1)!.id
    expect(ok(rejectUnavailable(c, id, 'Needed then', NOW)).unavailabilityRequests!.at(-1)).toMatchObject({ status: 'rejected', reply: 'Needed then' })
    expect(withdrawUnavailable(c, diet.teachers[1].id, id).ok).toBe(false)
    expect(ok(withdrawUnavailable(c, kaur.id, id)).unavailabilityRequests).toEqual([])
  })
})

