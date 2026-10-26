// Leave inbox + Absence Mode (v0.7) on the v0.2 leave-cover engine. Leave is for one date and is decided on the
// **published** version: approving it auto-allots the best free teacher to every class that date
// (`planLeaveCover`), the HOD may swap or confirm, and the date's adjusted timetable must pass the independent
// validator (`validateDate`). The weekly pattern never changes (root §3 leave rules). Pure: callers pass time.

import { coverCandidates, planLeaveCover, validateDate, type Candidate } from '../solver/substitutes'
import type { CollegeData, Id, LeaveRequest, Substitution } from '../types'

export type LeaveOutcome = { ok: true; college: CollegeData } | { ok: false; reason: string }
const fail = (reason: string): LeaveOutcome => ({ ok: false, reason })

const deptOfTeacher = (c: CollegeData, teacherId: Id) => c.teachers.find((t) => t.id === teacherId)?.deptId

/** Leave of one department (or all), pending first, then upcoming approved by date, then the rest newest first. */
export function leaveInbox(c: CollegeData, deptId?: Id, today = '') {
  const mine = c.leaves.filter((l) => !deptId || deptOfTeacher(c, l.teacherId) === deptId)
  return {
    pending: mine.filter((l) => l.status === 'pending').sort((a, b) => a.date.localeCompare(b.date)),
    upcoming: mine.filter((l) => l.status === 'approved' && l.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
    closed: mine.filter((l) => l.status !== 'pending' && !(l.status === 'approved' && l.date >= today)).sort((a, b) => b.date.localeCompare(a.date)),
  }
}

/** The cover of one leave (its substitutions), in slot order. */
export const coverOf = (c: CollegeData, leaveId: Id) => c.substitutions.filter((s) => s.leaveId === leaveId).sort((a, b) => a.period - b.period)

/** Clashes on a date's adjusted timetable (published pattern + that date's substitutions). Empty = verified. */
export function dateCheck(c: CollegeData, date: string) {
  const tt = c.published?.timetable
  return tt ? validateDate(c, tt, date, c.substitutions) : []
}

const setLeave = (c: CollegeData, id: Id, patch: Partial<LeaveRequest>): CollegeData => ({
  ...c,
  leaves: c.leaves.map((l) => (l.id === id ? { ...l, ...patch } : l)),
})

/** A leave plus its cover, checked: refuses (never stores) a cover the validator does not accept. */
function withCover(c: CollegeData, leave: LeaveRequest): LeaveOutcome {
  const tt = c.published!.timetable
  const others = c.substitutions.filter((s) => s.leaveId !== leave.id)
  const cover = planLeaveCover(c, tt, leave, others)
  const next = { ...c, substitutions: [...others, ...cover] }
  const clashes = validateDate(next, tt, leave.date, next.substitutions)
  return clashes.length ? fail(`The cover would clash: ${clashes[0].message}`) : { ok: true, college: next }
}

/** Approve a pending leave: the best free teacher is allotted to every class the teacher has that date. */
export function approveLeave(c: CollegeData, id: Id, at: string, today: string): LeaveOutcome {
  const l = c.leaves.find((x) => x.id === id)
  if (!l) return fail('No such leave request.')
  if (l.status !== 'pending') return fail('This request is already decided.')
  if (!c.published) return fail('Nothing is published — publish a timetable before deciding leave.')
  if (l.date < today) return fail('That date has passed.')
  return withCover(setLeave(c, id, { status: 'approved', decidedAt: at }), { ...l, status: 'approved' })
}

export function rejectLeave(c: CollegeData, id: Id, reply: string, at: string): LeaveOutcome {
  const l = c.leaves.find((x) => x.id === id)
  if (!l) return fail('No such leave request.')
  if (l.status !== 'pending') return fail('This request is already decided.')
  return { ok: true, college: setLeave(c, id, { status: 'rejected', reply: reply.trim() || undefined, decidedAt: at }) }
}

/** Call off an approved leave (e.g. the teacher can come after all): its cover is removed. */
export function cancelApprovedLeave(c: CollegeData, id: Id, at: string): LeaveOutcome {
  const l = c.leaves.find((x) => x.id === id)
  if (!l || l.status !== 'approved') return fail('Only an approved leave can be called off.')
  return { ok: true, college: { ...setLeave(c, id, { status: 'cancelled', decidedAt: at }), substitutions: c.substitutions.filter((s) => s.leaveId !== id) } }
}

/** Ranked free teachers who could take this substituted class instead (the current substitute included). */
export function coverOptions(c: CollegeData, subId: Id): Candidate[] {
  const s = c.substitutions.find((x) => x.id === subId)
  const tt = c.published?.timetable
  if (!s || !tt) return []
  const placement = tt.placements.find((p) => p.assignmentId === s.assignmentId && p.period === s.period && p.day === s.day)
  if (!placement) return []
  return coverCandidates(
    c,
    tt,
    s.date,
    placement,
    c.substitutions.filter((x) => x.id !== subId),
  )
}

/** The HOD picks another substitute (only one of `coverOptions`) — the class is then `confirmed`. */
export function swapSubstitute(c: CollegeData, subId: Id, teacherId: Id): LeaveOutcome {
  const s = c.substitutions.find((x) => x.id === subId)
  if (!s) return fail('No such class to cover.')
  const pick = coverOptions(c, subId).find((x) => x.teacherId === teacherId)
  if (!pick) return fail('That teacher is not free for this class.')
  const name = c.teachers.find((t) => t.id === teacherId)?.name ?? teacherId
  const sub: Substitution = { ...s, substituteTeacherId: teacherId, status: 'confirmed', note: `${name} — ${pick.note}` }
  const next = { ...c, substitutions: c.substitutions.map((x) => (x.id === subId ? sub : x)) }
  const clashes = dateCheck(next, s.date)
  return clashes.length ? fail(`That would clash: ${clashes[0].message}`) : { ok: true, college: next }
}

/** Keep the suggested substitute. */
export function confirmCover(c: CollegeData, subId: Id): LeaveOutcome {
  const s = c.substitutions.find((x) => x.id === subId)
  if (!s || s.status !== 'suggested') return fail('Nothing to confirm.')
  return { ok: true, college: { ...c, substitutions: c.substitutions.map((x) => (x.id === subId ? { ...x, status: 'confirmed' } : x)) } }
}

/**
 * After a new version is published: the cover of every approved leave from `today` on is planned again against
 * it (classes may have moved). A confirmed substitute is kept when they are still free for the same class.
 * Called by `publish`.
 */
export function coverAfterPublish(c: CollegeData, today: string): CollegeData {
  if (!c.published) return c
  let next = c
  const leaves = c.leaves.filter((l) => l.status === 'approved' && l.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  for (const leave of leaves) {
    const before = coverOf(next, leave.id)
    const r = withCover(next, leave)
    if (!r.ok) continue
    next = r.college
    for (const old of before) {
      if (old.status !== 'confirmed' || !old.substituteTeacherId) continue
      const now = coverOf(next, leave.id).find((s) => s.assignmentId === old.assignmentId && s.period === old.period)
      if (now && now.substituteTeacherId !== old.substituteTeacherId) {
        const kept = swapSubstitute(next, now.id, old.substituteTeacherId)
        if (kept.ok) next = kept.college
      } else if (now && now.status === 'suggested') next = { ...next, substitutions: next.substitutions.map((s) => (s.id === now.id ? { ...s, status: 'confirmed' } : s)) }
    }
  }
  return next
}

/** For the badge: leave and unavailability requests waiting for this department (or all). */
export const leaveWaiting = (c: CollegeData, deptId?: Id) =>
  c.leaves.filter((l) => l.status === 'pending' && (!deptId || deptOfTeacher(c, l.teacherId) === deptId)).length +
  (c.unavailabilityRequests ?? []).filter((u) => u.status === 'pending' && (!deptId || deptOfTeacher(c, u.teacherId) === deptId)).length
