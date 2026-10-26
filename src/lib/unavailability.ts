// Teacher unavailability requests (v0.7): "I can't teach Fri P6–P7 any more". The HOD approves → the slots join
// the teacher's `unavailable` list (rule H6); the department goes back to Draft and the draft must be generated
// again, exactly like a setup edit. Pure: callers pass time.

import type { CollegeData, Id, SlotKey, UnavailabilityRequest } from '../types'
import { deptEdit } from './deptPlan'

export type UnavailOutcome = { ok: true; college: CollegeData } | { ok: false; reason: string }
const fail = (reason: string): UnavailOutcome => ({ ok: false, reason })

const list = (c: CollegeData) => c.unavailabilityRequests ?? []

export function requestUnavailable(c: CollegeData, teacherId: Id, slots: SlotKey[], reason: string, now: string): UnavailOutcome {
  const t = c.teachers.find((x) => x.id === teacherId)
  if (!t) return fail('Unknown teacher.')
  const D = c.calendar.days.length
  const P = c.calendar.periodsPerDay
  const valid = slots.filter((k) => {
    const [d, p] = k.split('-').map(Number)
    return Number.isInteger(d) && Number.isInteger(p) && d >= 0 && d < D && p >= 0 && p < P
  })
  const fresh = [...new Set(valid)].filter((k) => !t.unavailable.includes(k))
  if (fresh.length === 0) return fail('Pick at least one slot you are not already unavailable in.')
  if (!reason.trim()) return fail('Say why — your HOD reads it.')
  const r: UnavailabilityRequest = {
    id: `${teacherId}-unavail-${list(c).length + 1}`,
    collegeId: c.college.id,
    teacherId,
    slots: fresh,
    reason: reason.trim(),
    status: 'pending',
    createdAt: now,
  }
  return { ok: true, college: { ...c, unavailabilityRequests: [...list(c), r] } }
}

const decide = (c: CollegeData, id: Id, patch: Partial<UnavailabilityRequest>): CollegeData => ({
  ...c,
  unavailabilityRequests: list(c).map((u) => (u.id === id ? { ...u, ...patch } : u)),
})

/** Approve: the slots become unavailable for the teacher; their department goes back to Draft, the draft is out of date. */
export function approveUnavailable(c: CollegeData, id: Id, at: string): UnavailOutcome {
  const u = list(c).find((x) => x.id === id)
  if (!u || u.status !== 'pending') return fail('Nothing to decide.')
  const t = c.teachers.find((x) => x.id === u.teacherId)
  if (!t) return fail('Unknown teacher.')
  const apply = (x: CollegeData): CollegeData => ({
    ...x,
    teachers: x.teachers.map((y) => (y.id === t.id ? { ...y, unavailable: [...new Set([...y.unavailable, ...u.slots])] } : y)),
    draftStale: x.draft ? true : x.draftStale,
  })
  return { ok: true, college: decide(deptEdit(t.deptId, apply)(c), id, { status: 'approved', decidedAt: at }) }
}

export function rejectUnavailable(c: CollegeData, id: Id, reply: string, at: string): UnavailOutcome {
  const u = list(c).find((x) => x.id === id)
  if (!u || u.status !== 'pending') return fail('Nothing to decide.')
  return { ok: true, college: decide(c, id, { status: 'rejected', reply: reply.trim() || undefined, decidedAt: at }) }
}

/** The teacher takes back a request the HOD has not decided yet. */
export function withdrawUnavailable(c: CollegeData, teacherId: Id, id: Id): UnavailOutcome {
  const u = list(c).find((x) => x.id === id)
  if (!u || u.teacherId !== teacherId) return fail('Not your request.')
  if (u.status !== 'pending') return fail('Already decided.')
  return { ok: true, college: { ...c, unavailabilityRequests: list(c).filter((x) => x.id !== id) } }
}

/** Requests of one department (or all), pending first. */
export const unavailabilityInbox = (c: CollegeData, deptId?: Id) =>
  list(c)
    .filter((u) => !deptId || c.teachers.find((t) => t.id === u.teacherId)?.deptId === deptId)
    .sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || b.createdAt.localeCompare(a.createdAt))
