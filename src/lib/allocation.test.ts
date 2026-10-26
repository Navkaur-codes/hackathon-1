import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { solveBest } from '../solver/best'
import { solve } from '../solver/solve'
import { validate } from '../solver/validate'
import type { CollegeData, Placement } from '../types'
import { moveToRoom, roomOptions, syncAllocations } from './allocation'
import { deptSolveOptions, mergeDept } from './deptPlan'
import { revoke } from './exchange'
import { publish, setDraft } from './publish'

const [diet] = buildDemoColleges()
const AT = '2026-10-27T10:00:00.000Z'
const cseLab = diet.rooms.find((r) => r.owner === 'diet-cse' && r.type === 'lab')!
// ECE's own lab and the shared labs too small → ECE's labs only fit in CSE's lab
const squeezed: CollegeData = { ...diet, rooms: diet.rooms.map((r) => (r.type === 'lab' && r.id !== cseLab.id ? { ...r, capacity: 1 } : r)) }

/** What the College Admin's "Generate whole college" stores. */
const wholeCollege = (c: CollegeData, baseSeed = 1) => syncAllocations(setDraft(c, solveBest(c, { attempts: 5, baseSeed, anyRoom: true }).timetable))
const crossDept = (c: CollegeData, t = c.draft!) =>
  t.placements.filter((p) => {
    const owner = c.rooms.find((r) => r.id === p.roomId)!.owner
    return owner !== 'shared' && owner !== p.deptId
  })
const allocations = (c: CollegeData) => c.grants.filter((g) => g.kind === 'allocation')

describe('T5.6 the College Admin allocates rooms for the semester', () => {
  it("whole-college generate puts ECE's labs in the CSE lab and records them as an allocation", () => {
    const r = solveBest(squeezed, { attempts: 5, anyRoom: true })
    expect(r.conflicts).toEqual([]) // judged with its allocations
    expect(r.unplacedPeriods).toBe(0)
    const c = syncAllocations(setDraft(squeezed, r.timetable))
    expect(validate(c, c.draft!)).toEqual([])
    const ece = crossDept(c).filter((p) => p.deptId === 'diet-ece')
    expect(ece.length).toBeGreaterThan(0)
    expect(ece.every((p) => p.roomId === cseLab.id)).toBe(true)
    expect(allocations(c)).toContainEqual(expect.objectContaining({ roomId: cseLab.id, fromDeptId: 'diet-cse', toDeptId: 'diet-ece', status: 'approved' }))
    // without the College Admin's anyRoom the same college cannot place them (T5.3)
    expect(solveBest(squeezed, { attempts: 3 }).unplacedPeriods).toBeGreaterThan(0)
  })

  it('never a clash with anyRoom: both demos and the squeezed college over many seeds (validator, after allocation)', () => {
    const [, dcas] = buildDemoColleges()
    for (const c of [diet, dcas, squeezed])
      for (let seed = 1; seed <= 12; seed++) {
        const t = solve(c, { seed, anyRoom: true })
        const stored = syncAllocations(setDraft(c, t))
        expect(validate(stored, t)).toEqual([])
        expect(t.unplaced).toEqual([])
      }
  })

  it('every use of another department’s room is covered by an allocation for exactly its slots', () => {
    const c = wholeCollege(diet)
    expect(validate(c, c.draft!)).toEqual([])
    for (const p of crossDept(c))
      for (let i = 0; i < p.length; i++) {
        const k = `${p.day}-${p.period + i}`
        expect(allocations(c).some((g) => g.roomId === p.roomId && g.toDeptId === p.deptId && g.slots !== 'all' && g.slots.includes(k as never))).toBe(true)
      }
    // nothing allocated that is not used
    const used = new Set(crossDept(c).map((p) => `${p.roomId}|${p.deptId}`))
    for (const g of allocations(c)) expect(used.has(`${g.roomId}|${g.toDeptId}`)).toBe(true)
  })

  it("an HOD re-generating the department keeps its allocated room; HODs cannot revoke an allocation", () => {
    let c = wholeCollege(squeezed)
    c = syncAllocations(mergeDept(c, 'diet-ece', solveBest(c, { attempts: 5, baseSeed: 9, ...deptSolveOptions(c, 'diet-ece') }).timetable))
    expect(validate(c, c.draft!)).toEqual([])
    expect(c.draft!.unplaced).toEqual([])
    expect(crossDept(c).some((p) => p.deptId === 'diet-ece' && p.roomId === cseLab.id)).toBe(true)
    const g = allocations(c)[0]
    expect(revoke(c, g.id, 'diet-cse', AT)).toMatchObject({ ok: false, reason: expect.stringMatching(/allocated for the semester/) })
  })

  it('the published version keeps its allocations while a newer draft no longer needs them', () => {
    const one = publish(wholeCollege(squeezed), AT)
    if (!one.ok) throw new Error(one.reasons.join())
    // labs restored → a fresh whole-college draft needs no CSE lab for ECE …
    const roomy: CollegeData = { ...one.college, rooms: diet.rooms }
    const next = syncAllocations(setDraft(roomy, solveBest(roomy, { attempts: 3, anyRoom: true }).timetable))
    expect(crossDept(next).some((p) => p.deptId === 'diet-ece' && p.roomId === cseLab.id)).toBe(false)
    // … but the live version still uses it, so the allocation stays and the published timetable stays valid
    expect(allocations(next).some((g) => g.roomId === cseLab.id && g.toDeptId === 'diet-ece')).toBe(true)
    expect(validate(next, next.published!.timetable)).toEqual([])
  })
})

describe('T5.7 moving a class to another room by hand', () => {
  const c = wholeCollege(diet)
  const cseTheory = c.draft!.placements.find((p) => p.deptId === 'diet-cse' && p.length === 1)!
  const key = (p: Placement) => ({ assignmentId: p.assignmentId, day: p.day, period: p.period })

  it('options: right type, enough seats, free for the whole block; own → shared → other department', () => {
    const opts = roomOptions(c, key(cseTheory))
    expect(opts.some((o) => o.current)).toBe(true)
    const order = opts.map((o) => o.usable)
    expect([...order].sort((a, b) => ['own', 'shared', 'loan', 'allocate'].indexOf(a) - ['own', 'shared', 'loan', 'allocate'].indexOf(b))).toEqual(order)
    for (const o of opts) expect(o.room.type).toBe('lecture')
    // a room busy at that time is never offered
    const busy = c.draft!.placements.find((p) => p !== cseTheory && p.day === cseTheory.day && p.period === cseTheory.period)!
    expect(opts.some((o) => o.room.id === busy.roomId)).toBe(false)
  })

  it('moving into another department’s room allocates it; moving back removes the allocation', () => {
    // a CSE class with another department's room free at its time
    const cls = c.draft!.placements.find((p) => p.deptId === 'diet-cse' && roomOptions(c, key(p)).some((o) => o.usable === 'allocate'))!
    const target = roomOptions(c, key(cls)).find((o) => o.usable === 'allocate')!
    const moved = moveToRoom(c, key(cls), target.room.id)
    if (!moved.ok) throw new Error(moved.reason)
    expect(validate(moved.college, moved.college.draft!)).toEqual([])
    expect(allocations(moved.college)).toContainEqual(expect.objectContaining({ roomId: target.room.id, toDeptId: 'diet-cse' }))
    const back = moveToRoom(moved.college, key(cls), cls.roomId)
    if (!back.ok) throw new Error(back.reason)
    expect(allocations(back.college).some((g) => g.roomId === target.room.id && g.toDeptId === 'diet-cse')).toBe(false)
  })

  it('refuses a busy room, the wrong type and a class that is not in the draft', () => {
    const busy = c.draft!.placements.find((p) => p !== cseTheory && p.day === cseTheory.day && p.period === cseTheory.period)!
    expect(moveToRoom(c, key(cseTheory), busy.roomId)).toMatchObject({ ok: false, reason: expect.stringMatching(/not free/) })
    expect(moveToRoom(c, key(cseTheory), cseLab.id).ok).toBe(false)
    expect(moveToRoom(c, { ...key(cseTheory), day: 99 }, cseLab.id)).toMatchObject({ ok: false, reason: expect.stringMatching(/no longer in the draft/) })
  })
})
