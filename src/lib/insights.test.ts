import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { solve } from '../solver/solve'
import { buildGrid } from './gridModel'
import { deliveryByProgramme, deptSummary, idleRooms, insightSource, roomUse, sharedLedger, teachableSlots, teacherLoads } from './insights'
import { publish, setDraft } from './publish'

const [diet, dcas] = buildDemoColleges()
const draft = solve(diet, { seed: 1 })
const drafted = setDraft(diet, draft)
const periodsIn = (roomId: string) => draft.placements.filter((p) => p.roomId === roomId).reduce((s, p) => s + p.length, 0)

describe('T7.5 shared-resource ledger', () => {
  it('per shared room, the department totals equal the periods placed in that room; idle = teachable − used', () => {
    const rows = sharedLedger(diet, draft)
    expect(rows.map((r) => r.room.id).sort()).toEqual(diet.rooms.filter((r) => r.owner === 'shared').map((r) => r.id).sort())
    const teachable = teachableSlots(diet).reduce((s, n) => s + n, 0)
    for (const r of rows) {
      expect(r.byDept.reduce((s, d) => s + d.periods, 0)).toBe(periodsIn(r.room.id))
      expect(r.used).toBe(periodsIn(r.room.id))
      expect(r.idle).toBe(teachable - r.used)
      expect(r.byDept.map((d) => d.deptId)).toEqual(diet.departments.map((d) => d.id))
    }
  })
})

describe('T7.8 loads and room use', () => {
  it('room use per day never exceeds the teachable slots; totals match the placements; blocked slots reduce teachable', () => {
    for (const u of roomUse(diet, draft)) {
      expect(u.used).toBe(periodsIn(u.room.id))
      u.perDay.forEach((n, d) => expect(n).toBeLessThanOrEqual(teachableSlots(diet)[d]))
      expect(u.share).toBeGreaterThanOrEqual(0)
      expect(u.share).toBeLessThanOrEqual(1)
    }
    const blocked = { ...diet, calendar: { ...diet.calendar, blockedSlots: ['0-0' as const, '0-1' as const] } }
    expect(teachableSlots(blocked)[0]).toBe(diet.calendar.periodsPerDay - 2)
    expect(roomUse(diet, draft).map((u) => u.room.owner).lastIndexOf('shared')).toBe(diet.rooms.length - 1)
  })

  it('teacher loads match the teacher grid; nobody over the limit in a solver timetable; busiest first', () => {
    const loads = teacherLoads(diet, draft)
    expect(loads).toHaveLength(diet.teachers.length)
    for (const l of loads) {
      expect(l.week).toBe(buildGrid(diet, draft, 'teacher', l.teacher.id).periods)
      expect(l.over).toBe(false)
      expect(l.peak).toBeLessThanOrEqual(l.teacher.maxPerDay)
    }
    expect(loads.map((l) => l.week)).toEqual([...loads.map((l) => l.week)].sort((a, b) => b - a))
    // a hand-made overload is flagged
    const t = loads[0].teacher
    const over = teacherLoads({ ...diet, teachers: diet.teachers.map((x) => (x.id === t.id ? { ...x, maxPerWeek: 1 } : x)) }, draft)
    expect(over.find((l) => l.teacher.id === t.id)!.over).toBe(true)
  })

  it('idle rooms are department rooms, most idle first', () => {
    const idle = idleRooms(diet, draft, 3)
    expect(idle).toHaveLength(3)
    expect(idle.every((u) => u.room.owner !== 'shared')).toBe(true)
    expect(idle[0].idle).toBeGreaterThanOrEqual(idle[2].idle)
  })

  it('department summary and delivery add up to the whole timetable', () => {
    const rows = deptSummary(diet, draft)
    expect(rows.reduce((s, r) => s + r.periods, 0)).toBe(draft.placements.reduce((s, p) => s + p.length, 0))
    expect(rows.every((r) => r.clashes === 0)).toBe(true)
    const d = deliveryByProgramme(diet, draft)
    expect(d.reduce((s, r) => s + r.placed, 0)).toBe(draft.placements.reduce((s, p) => s + p.length, 0))
    expect(d.every((r) => r.placed <= r.planned && r.hours > 0)).toBe(true)
  })

  it('reads the published version first, else the draft, else nothing; any calendar shape (DCAS)', () => {
    expect(insightSource(diet)).toBeUndefined()
    expect(insightSource(drafted)!.label).toMatch(/draft/)
    const r = publish(drafted, '2026-10-27T10:00:00.000Z')
    if (!r.ok) throw new Error()
    expect(insightSource({ ...r.college, draft: solve(diet, { seed: 9 }) })).toMatchObject({ timetable: draft, label: 'published version 1' })
    const dt = solve(dcas, { seed: 1 })
    expect(roomUse(dcas, dt)[0].perDay).toHaveLength(dcas.calendar.days.length)
    expect(sharedLedger(dcas, dt).every((row) => row.byDept.reduce((s, x) => s + x.periods, 0) === row.used)).toBe(true)
  })
})
