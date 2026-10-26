// Room Exchange: departments lend each other rooms for weekly slots (root §2, rule H11). Pure: the caller passes
// the time. Every action checks that the acting department is the right one — an HOD can never decide for
// another department. The solver and the validator already honour approved grants, so a loan needs no
// engine change: approve → the borrower may generate into those slots; revoke → the validator flags any
// class still sitting there until the borrower generates again.

import type { CollegeData, Grant, Id, Placement, SlotKey } from '../types'
import { occupancy, weekStrip } from './finder'
import { slotKey } from './structure'

export type ExchangeOutcome = { ok: true; college: CollegeData } | { ok: false; reason: string }

const fail = (reason: string): ExchangeOutcome => ({ ok: false, reason })
const deptCode = (c: CollegeData, id: Id) => c.departments.find((d) => d.id === id)?.code ?? id
const slotsOf = (c: CollegeData, g: Grant): SlotKey[] =>
  g.slots === 'all' ? c.calendar.days.flatMap((_, d) => Array.from({ length: c.calendar.periodsPerDay }, (_, p) => slotKey(d, p))) : g.slots

/** "Thu P3–P4 · Fri P1" — consecutive slots of a day joined. */
export function describeSlots(c: CollegeData, slots: SlotKey[] | 'all'): string {
  if (slots === 'all') return 'every slot'
  const byDay = new Map<number, number[]>()
  for (const k of slots) {
    const [d, p] = k.split('-').map(Number)
    byDay.set(d, [...(byDay.get(d) ?? []), p])
  }
  return [...byDay]
    .sort(([a], [b]) => a - b)
    .map(([d, ps]) => {
      const sorted = [...new Set(ps)].sort((a, b) => a - b)
      const runs: string[] = []
      for (let i = 0; i < sorted.length; ) {
        let j = i
        while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++
        runs.push(i === j ? `P${sorted[i] + 1}` : `P${sorted[i] + 1}–P${sorted[j] + 1}`)
        i = j + 1
      }
      return `${c.calendar.days[d] ?? `day ${d + 1}`} ${runs.join(', ')}`
    })
    .join(' · ')
}

/**
 * Why a slot of this room cannot be lent right now (busy in the draft, a break / blocked slot, or already lent),
 * keyed by slot; free slots are absent. Used for the slot picker and to validate requests and offers.
 */
export function unavailableSlots(c: CollegeData, roomId: Id, exceptGrantId?: Id): Map<SlotKey, string> {
  const out = new Map<SlotKey, string>()
  const strip = c.draft ? weekStrip(c, occupancy(c, c.draft), 'room', roomId) : null
  const blocked = new Set(c.calendar.blockedSlots)
  c.calendar.days.forEach((_, d) => {
    for (let p = 0; p < c.calendar.periodsPerDay; p++) {
      const k = slotKey(d, p)
      if (blocked.has(k)) out.set(k, 'blocked for the whole college')
      else if (strip?.[d][p] === 'busy') out.set(k, 'in use in the college draft')
    }
  })
  for (const g of c.grants)
    if (g.roomId === roomId && g.status === 'approved' && g.id !== exceptGrantId)
      for (const k of slotsOf(c, g)) out.set(k, `already lent to ${deptCode(c, g.toDeptId)}`)
  return out
}

let seq = 0
const newId = (c: CollegeData, at: string) => `${c.college.id}-g-${at.replace(/\D/g, '').slice(0, 14)}-${(seq++).toString(36)}`

function checkSlots(c: CollegeData, roomId: Id, slots: SlotKey[]): string | null {
  if (slots.length === 0) return 'Pick at least one slot.'
  const taken = unavailableSlots(c, roomId)
  const clash = slots.find((k) => taken.has(k))
  return clash ? `${describeSlots(c, [clash])} is ${taken.get(clash)}.` : null
}

/** The borrower asks the owner for a room in weekly slots. */
export function requestRoom(c: CollegeData, borrowerDeptId: Id, roomId: Id, slots: SlotKey[], note: string, at: string): ExchangeOutcome {
  const room = c.rooms.find((r) => r.id === roomId)
  if (!room) return fail('That room does not exist.')
  if (room.owner === 'shared') return fail(`${room.name} is shared — every department may use it already.`)
  if (room.owner === borrowerDeptId) return fail(`${room.name} is already your department’s room.`)
  if (!c.departments.some((d) => d.id === borrowerDeptId)) return fail('Unknown department.')
  const problem = checkSlots(c, roomId, slots)
  if (problem) return fail(problem)
  const g: Grant = {
    id: newId(c, at),
    collegeId: c.college.id,
    roomId,
    fromDeptId: room.owner,
    toDeptId: borrowerDeptId,
    slots: [...new Set(slots)].sort(),
    status: 'requested',
    kind: 'request',
    ...(note.trim() ? { note: note.trim() } : {}),
    createdAt: at,
  }
  return { ok: true, college: { ...c, grants: [...c.grants, g] } }
}

/** The owner offers idle weekly slots of one of its rooms to another department. */
export function offerRoom(c: CollegeData, ownerDeptId: Id, roomId: Id, slots: SlotKey[], toDeptId: Id, note: string, at: string): ExchangeOutcome {
  const room = c.rooms.find((r) => r.id === roomId)
  if (!room || room.owner !== ownerDeptId) return fail('You can only offer your own department’s rooms.')
  if (toDeptId === ownerDeptId || !c.departments.some((d) => d.id === toDeptId)) return fail('Pick another department to offer it to.')
  const problem = checkSlots(c, roomId, slots)
  if (problem) return fail(problem)
  const g: Grant = {
    id: newId(c, at),
    collegeId: c.college.id,
    roomId,
    fromDeptId: ownerDeptId,
    toDeptId,
    slots: [...new Set(slots)].sort(),
    status: 'offered',
    kind: 'offer',
    ...(note.trim() ? { note: note.trim() } : {}),
    createdAt: at,
  }
  return { ok: true, college: { ...c, grants: [...c.grants, g] } }
}

function decide(c: CollegeData, grantId: Id, status: Grant['status'], at: string): CollegeData {
  return { ...c, grants: c.grants.map((g) => (g.id === grantId ? { ...g, status, decidedAt: at } : g)) }
}

/**
 * Say yes to a pending loan: the owner approves a request, the borrower accepts an offer. Refused if the slots
 * were lent to someone else meanwhile.
 */
export function approve(c: CollegeData, grantId: Id, actingDeptId: Id, at: string): ExchangeOutcome {
  const g = c.grants.find((x) => x.id === grantId)
  if (!g) return fail('That loan no longer exists.')
  if (g.status === 'requested' && actingDeptId !== g.fromDeptId) return fail('Only the department that owns the room can approve this request.')
  if (g.status === 'offered' && actingDeptId !== g.toDeptId) return fail('Only the department it was offered to can accept this offer.')
  if (g.status !== 'requested' && g.status !== 'offered') return fail('This loan has already been decided.')
  const lent = unavailableSlots({ ...c, draft: undefined }, g.roomId, g.id)
  const clash = slotsOf(c, g).find((k) => lent.has(k))
  if (clash) return fail(`${describeSlots(c, [clash])} is ${lent.get(clash)} — it cannot be lent twice.`)
  return { ok: true, college: decide(c, grantId, 'approved', at) }
}

/** Say no to a pending loan: the owner rejects a request, the borrower declines an offer; either may withdraw their own. */
export function reject(c: CollegeData, grantId: Id, actingDeptId: Id, at: string): ExchangeOutcome {
  const g = c.grants.find((x) => x.id === grantId)
  if (!g) return fail('That loan no longer exists.')
  if (g.status !== 'requested' && g.status !== 'offered') return fail('This loan has already been decided.')
  if (actingDeptId !== g.fromDeptId && actingDeptId !== g.toDeptId) return fail('Only the two departments involved can decide this loan.')
  return { ok: true, college: decide(c, grantId, 'rejected', at) }
}

/** Classes of the borrower that sit in the lent room during the loan — they lose the room if it is revoked. */
export function affectedBy(c: CollegeData, grantId: Id): Placement[] {
  const g = c.grants.find((x) => x.id === grantId)
  if (!g || !c.draft) return []
  const slots = new Set(slotsOf(c, g))
  return c.draft.placements.filter(
    (p) => p.roomId === g.roomId && p.deptId === g.toDeptId && Array.from({ length: p.length }, (_, i) => slotKey(p.day, p.period + i)).some((k) => slots.has(k)),
  )
}

/**
 * The owner takes an approved loan back. Classes still in the room (see `affectedBy`) are then flagged by the
 * independent validator (H11) and block publishing until the borrower generates again.
 */
export function revoke(c: CollegeData, grantId: Id, actingDeptId: Id, at: string): ExchangeOutcome {
  const g = c.grants.find((x) => x.id === grantId)
  if (!g) return fail('That loan no longer exists.')
  if (g.status !== 'approved') return fail('Only an approved loan can be revoked.')
  if (actingDeptId !== g.fromDeptId) return fail('Only the department that owns the room can revoke the loan.')
  return { ok: true, college: decide(c, grantId, 'revoked', at) }
}

/** Loans a department is part of, newest first. */
export const loansOf = (c: CollegeData, deptId: Id) =>
  c.grants.filter((g) => g.fromDeptId === deptId || g.toDeptId === deptId).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
