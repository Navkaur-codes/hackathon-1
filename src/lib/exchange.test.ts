import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { solveBest } from '../solver/best'
import { validate } from '../solver/validate'
import type { CollegeData, SlotKey } from '../types'
import { deptSolveOptions, mergeDept } from './deptPlan'
import { affectedBy, approve, describeSlots, offerRoom, reject, requestRoom, revoke, unavailableSlots, type ExchangeOutcome } from './exchange'
import { publishCheck } from './publish'

const [diet] = buildDemoColleges()
const AT = '2026-10-27T10:00:00.000Z'
const ok = (r: ExchangeOutcome) => {
  if (!r.ok) throw new Error(r.reason)
  return r.college
}
const generate = (c: CollegeData, deptId: string) => mergeDept(c, deptId, solveBest(c, { attempts: 5, ...deptSolveOptions(c, deptId) }).timetable)

// ECE's own and the shared labs are made too small, so ECE's labs fit only in CSE's lab — and only on loan.
const cseLab = diet.rooms.find((r) => r.owner === 'diet-cse' && r.type === 'lab')!
const squeezed: CollegeData = {
  ...diet,
  rooms: diet.rooms.map((r) => (r.type === 'lab' && r.id !== cseLab.id ? { ...r, capacity: 1 } : r)),
}
const eceLabs = squeezed.assignments.filter((a) => a.sectionId.startsWith('diet-ece') && squeezed.subjects.find((s) => s.id === a.subjectId)!.kind === 'lab')
// CSE planned first; then the slots CSE leaves free in its lab on two days
const withCse = generate(squeezed, 'diet-cse')
const freeLabSlots = (days: number[]) => {
  const taken = unavailableSlots(withCse, cseLab.id)
  return days.flatMap((d) => Array.from({ length: squeezed.calendar.periodsPerDay }, (_, p) => `${d}-${p}` as SlotKey)).filter((k) => !taken.has(k))
}

describe('T5.3 without a loan another department’s room is never used', () => {
  it('ECE cannot place its labs and is told to ask through Room Exchange', () => {
    const c = generate(withCse, 'diet-ece')
    expect(c.draft!.placements.some((p) => p.roomId === cseLab.id && p.deptId === 'diet-ece')).toBe(false)
    const unplaced = c.draft!.unplaced.filter((u) => eceLabs.some((a) => a.id === u.assignmentId))
    expect(unplaced.length).toBe(eceLabs.length)
    expect(unplaced[0].suggestion).toMatch(/Room Exchange/)
    expect(validate(c, c.draft!)).toEqual([])
  })
})

describe('T5.4 an approved loan is used only in its slots', () => {
  it('ECE requests the CSE lab on two days, CSE approves, ECE generates into exactly those slots', () => {
    const slots = freeLabSlots([3, 4])
    let c = ok(requestRoom(withCse, 'diet-ece', cseLab.id, slots, 'Microprocessors practicals', AT))
    const g = c.grants.at(-1)!
    expect(g).toMatchObject({ status: 'requested', kind: 'request', fromDeptId: 'diet-cse', toDeptId: 'diet-ece', note: 'Microprocessors practicals' })
    c = ok(approve(c, g.id, 'diet-cse', AT))
    c = generate(c, 'diet-ece')
    const inLab = c.draft!.placements.filter((p) => p.roomId === cseLab.id && p.deptId === 'diet-ece')
    expect(inLab.length).toBeGreaterThan(0)
    const granted = new Set(slots)
    for (const p of inLab) for (let i = 0; i < p.length; i++) expect(granted.has(`${p.day}-${p.period + i}` as SlotKey)).toBe(true)
    expect(c.draft!.unplaced.filter((u) => eceLabs.some((a) => a.id === u.assignmentId))).toEqual([])
    expect(validate(c, c.draft!)).toEqual([])
  })
})

describe('T5.5 revoking a loan flags the classes that used it', () => {
  it('affected classes are listed, the validator flags them (H11), publishing is blocked until ECE re-generates', () => {
    let c = ok(requestRoom(withCse, 'diet-ece', cseLab.id, freeLabSlots([3, 4]), '', AT))
    const id = c.grants.at(-1)!.id
    c = generate(ok(approve(c, id, 'diet-cse', AT)), 'diet-ece')
    const using = c.draft!.placements.filter((p) => p.roomId === cseLab.id && p.deptId === 'diet-ece')
    expect(affectedBy(c, id)).toEqual(using)
    c = ok(revoke(c, id, 'diet-cse', AT))
    const h11 = validate(c, c.draft!).filter((x) => x.rule === 'H11')
    expect(h11.length).toBe(using.length)
    expect(publishCheck(c).blocked.join(' ')).toMatch(/H11/)
    c = generate(c, 'diet-ece')
    expect(c.draft!.placements.some((p) => p.roomId === cseLab.id && p.deptId === 'diet-ece')).toBe(false)
    expect(validate(c, c.draft!)).toEqual([])
  })
})

describe('who may do what in Room Exchange', () => {
  const slots = freeLabSlots([3])
  const requested = ok(requestRoom(withCse, 'diet-ece', cseLab.id, slots, '', AT))
  const reqId = requested.grants.at(-1)!.id

  it('only the owner approves a request; only the borrower accepts an offer; outsiders decide nothing', () => {
    expect(approve(requested, reqId, 'diet-ece', AT)).toMatchObject({ ok: false, reason: expect.stringMatching(/owns the room/) })
    expect(approve(requested, reqId, 'diet-me', AT).ok).toBe(false)
    expect(reject(requested, reqId, 'diet-me', AT).ok).toBe(false)
    const offered = ok(offerRoom(withCse, 'diet-cse', cseLab.id, slots, 'diet-me', 'free on Thursdays', AT))
    const offId = offered.grants.at(-1)!.id
    expect(approve(offered, offId, 'diet-cse', AT).ok).toBe(false)
    expect(approve(offered, offId, 'diet-ece', AT).ok).toBe(false)
    expect(ok(approve(offered, offId, 'diet-me', AT)).grants.at(-1)!.status).toBe('approved')
    expect(ok(reject(offered, offId, 'diet-me', AT)).grants.at(-1)!.status).toBe('rejected')
    // only the owner revokes; only approved loans
    const approved = ok(approve(requested, reqId, 'diet-cse', AT))
    expect(revoke(approved, reqId, 'diet-ece', AT).ok).toBe(false)
    expect(revoke(requested, reqId, 'diet-cse', AT).ok).toBe(false)
    expect(approve(approved, reqId, 'diet-cse', AT)).toMatchObject({ ok: false, reason: expect.stringMatching(/already been decided/) })
  })

  it('refuses shared rooms, own rooms, busy slots, other departments’ offers and lending the same slot twice', () => {
    const shared = squeezed.rooms.find((r) => r.owner === 'shared')!
    expect(requestRoom(withCse, 'diet-ece', shared.id, ['0-0'], '', AT)).toMatchObject({ ok: false, reason: expect.stringMatching(/shared/) })
    expect(requestRoom(withCse, 'diet-cse', cseLab.id, slots, '', AT)).toMatchObject({ ok: false, reason: expect.stringMatching(/already your/) })
    expect(requestRoom(withCse, 'diet-ece', cseLab.id, [], '', AT).ok).toBe(false)
    const busy = withCse.draft!.placements.find((p) => p.roomId === cseLab.id)!
    expect(requestRoom(withCse, 'diet-ece', cseLab.id, [`${busy.day}-${busy.period}` as SlotKey], '', AT)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/in use in the college draft/),
    })
    expect(offerRoom(withCse, 'diet-ece', cseLab.id, slots, 'diet-me', '', AT).ok).toBe(false)
    // ECE and ME both ask for the same slots: the first approval wins, the second is refused
    const both = ok(requestRoom(requested, 'diet-me', cseLab.id, slots, '', AT))
    const meId = both.grants.at(-1)!.id
    const first = ok(approve(both, reqId, 'diet-cse', AT))
    expect(approve(first, meId, 'diet-cse', AT)).toMatchObject({ ok: false, reason: expect.stringMatching(/already lent to ECE/) })
  })

  it('slots are described in words', () => {
    expect(describeSlots(diet, ['3-2', '3-3', '4-0', '3-5'])).toBe('Thu P3–P4, P6 · Fri P1')
    expect(describeSlots(diet, 'all')).toBe('every slot')
  })
})
