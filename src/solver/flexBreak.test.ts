// Flexible breaks (user request after P0.4-b): a section's lunch may sit in one of several slots each day,
// chosen by the solver. Exactly one option slot stays free per day (rule H7).

import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { templateSpec } from '../lib/edit'
import { explainPlacement } from '../lib/explain'
import { weekStrip, occupancy } from '../lib/finder'
import { buildGrid } from '../lib/gridModel'
import {
  breakSlots,
  buildCollege,
  chosenBreak,
  flexBreaks,
  resolvedBreakSlots,
  sectionFlexBreaks,
  slotKey,
} from '../lib/structure'
import type { BreakRule, CollegeData, Placement, SlotKey, Timetable } from '../types'
import { solveBest } from './best'
import { preflight } from './preflight'
import { solve } from './solve'
import { validate } from './validate'

const [diet] = buildDemoColleges()
const meY3 = diet.sections.find((s) => s.name === 'ME-Y3-A')!

/** Section slot keys booked in a timetable. */
const busyOf = (c: CollegeData, t: Timetable, sectionId: string) => {
  const out = new Set<SlotKey>()
  for (const p of t.placements)
    if (c.assignments.find((a) => a.id === p.assignmentId)?.sectionId === sectionId)
      for (let i = 0; i < p.length; i++) out.add(slotKey(p.day, p.period + i))
  return out
}

/** Every flexible break of every section keeps ≥ 1 free option each day. */
function everyLunchKept(c: CollegeData, t: Timetable) {
  for (const s of c.sections) {
    const busy = busyOf(c, t, s.id)
    for (const f of sectionFlexBreaks(c, s)) expect(f.options.some((p) => !busy.has(slotKey(f.day, p)))).toBe(true)
  }
}

describe('T7f.1 flexible break model', () => {
  const rules: BreakRule[] = [{ period: 3, label: 'Lunch' }, { period: 4, options: [4, 3], label: 'Lunch', days: [1, 2] }]

  it('fixed rules become break slots; flexible ones become one choice per day', () => {
    expect([...breakSlots(rules, 3)]).toEqual(['0-3', '1-3', '2-3'])
    expect(flexBreaks(rules, 3)).toEqual([
      { day: 1, options: [3, 4], preferred: 4, label: 'Lunch' },
      { day: 2, options: [3, 4], preferred: 4, label: 'Lunch' },
    ])
    // a single option is just a fixed break
    expect([...breakSlots([{ period: 2, options: [2] }], 2)]).toEqual(['0-2', '1-2'])
  })

  it('the break lands on the preferred slot if free, else the first free option', () => {
    const f = { day: 0, options: [3, 4], preferred: 3 }
    expect(chosenBreak(f, () => false)).toBe(3)
    expect(chosenBreak(f, (p) => p === 3)).toBe(4)
    const resolved = resolvedBreakSlots(diet, meY3, new Set(['2-3']))
    expect(resolved.has('2-4')).toBe(true) // Wed: 11:30 taken → lunch at 12:20
    expect(resolved.has('0-3')).toBe(true) // Mon: preferred 11:30
    expect(resolved.has('0-4')).toBe(false)
  })

  it('demo: DIET ME Year 3 has a flexible lunch at P4 (11:30) or P5 (12:20) every working day', () => {
    const f = sectionFlexBreaks(diet, meY3)
    expect(f).toHaveLength(diet.calendar.days.length)
    expect(f[0]).toMatchObject({ options: [3, 4], preferred: 3, label: 'Lunch' })
  })
})

describe('T7f.2 the solver never takes the last free option', () => {
  it('DIET over 20 seeds: 0 conflicts, 0 unplaced, ME-Y3 keeps a lunch slot every day', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const t = solve(diet, { seed })
      expect(validate(diet, t)).toEqual([])
      expect(t.unplaced).toEqual([])
      everyLunchKept(diet, t)
    }
  })

  it('every section flexible (college-wide, no department override) still solves cleanly', () => {
    const allFlex: CollegeData = {
      ...diet,
      calendar: { ...diet.calendar, breaks: [{ period: 3, options: [3, 4], label: 'Lunch' }] },
      departments: diet.departments.map((d) => ({ ...d, breaks: undefined })),
      programmes: diet.programmes.map((p) => ({ ...p, breaks: undefined })),
    }
    for (let seed = 1; seed <= 10; seed++) {
      const t = solve(allFlex, { seed })
      expect(validate(allFlex, t)).toEqual([])
      everyLunchKept(allFlex, t)
    }
  })

  it('quality with the flexible lunch is not lower than with the fixed lunch', () => {
    const fixed: CollegeData = { ...diet, programmes: diet.programmes.map((p) => ({ ...p, breaks: undefined })) }
    expect(solveBest(diet).score.total).toBeGreaterThanOrEqual(solveBest(fixed).score.total)
  })
})

describe('T7f.3 lunch moves only when that makes the week work', () => {
  // One section, 6 slots, lunch preferred at P4 (index 3); a 4-period lab only fits P1–P4 → lunch must move to P5.
  const spec = (breaks: BreakRule[]) => {
    const s = templateSpec('FLX', 'Flex College', '2026-11-02')
    s.calendar.lunchWindow = [3, 4]
    s.departments[0].rooms.push({ name: 'Lab 1', type: 'lab', capacity: 60 })
    s.departments[0].programmes[0].breaks = breaks
    s.departments[0].programmes[0].subjects.push({ code: 'PHL', name: 'Physics Lab', kind: 'lab', periodsPerWeek: 4, blockLength: 4, teachers: ['t2'] })
    return buildCollege(s)
  }
  const fixedC = spec([{ period: 3, label: 'Lunch' }])
  const flexC = spec([{ period: 3, options: [3, 4], label: 'Lunch' }])

  it('with a fixed lunch the lab cannot fit (pre-flight says so, the solver leaves it unplaced)', () => {
    expect(preflight(fixedC).some((w) => w.code === 'lab-block')).toBe(true)
    expect(solve(fixedC, { seed: 1 }).unplaced.length).toBeGreaterThan(0)
  })

  it('with a flexible lunch everything is placed, and lunch moves only on the lab day', () => {
    expect(preflight(flexC).some((w) => w.code === 'lab-block')).toBe(false)
    const t = solve(flexC, { seed: 1 })
    expect(validate(flexC, t)).toEqual([])
    expect(t.unplaced).toEqual([])
    const section = flexC.sections[0]
    const lab = t.placements.find((p) => p.length === 4)!
    const lunch = resolvedBreakSlots(flexC, section, busyOf(flexC, t, section.id))
    for (let d = 0; d < flexC.calendar.days.length; d++) expect(lunch.has(slotKey(d, d === lab.day ? 4 : 3))).toBe(true)
  })

  it('views show where lunch actually is: grid, Clash Court and Who is free', () => {
    const t = solve(flexC, { seed: 1 })
    const section = flexC.sections[0]
    const lab = t.placements.find((p) => p.length === 4)!
    const grid = buildGrid(flexC, t, 'section', section.id)
    expect(grid.breaks.filter((b) => b.day === lab.day).map((b) => b.period)).toEqual([4])
    const lines = explainPlacement(flexC, t, lab).filter((c) => c.rule === 'H7')
    expect(lines.every((c) => c.ok)).toBe(true)
    expect(lines.some((c) => /is at P5 .*taken by PHL/.test(c.text))).toBe(true)
    const strip = weekStrip(flexC, occupancy(flexC, t), 'section', section.id)
    expect(strip[lab.day][4]).toBe('break')
    expect(strip[lab.day][3]).toBe('busy')
  })
})

describe('T7f.4 the validator catches a day with no lunch left', () => {
  it('filling both option slots of a day is an H7 conflict naming the section', () => {
    const t = solve(diet, { seed: 1 })
    const busy = busyOf(diet, t, meY3.id)
    // a ME-Y3 day where exactly one option is still free, and one of its single-period classes from elsewhere that day
    const day = diet.calendar.days.findIndex((_, d) => [3, 4].filter((p) => !busy.has(slotKey(d, p))).length === 1)
    expect(day).toBeGreaterThanOrEqual(0)
    const freeOption = [3, 4].find((p) => !busy.has(slotKey(day, p)))!
    const mine = (p: Placement) => diet.assignments.find((a) => a.id === p.assignmentId)?.sectionId === meY3.id
    // (not one already sitting in a lunch option — moving that would just free it again)
    const victim = t.placements.find((p) => mine(p) && p.length === 1 && p.day === day && p.period !== 3 && p.period !== 4)!
    const moved: Timetable = { ...t, placements: t.placements.map((p) => (p === victim ? { ...p, period: freeOption } : p)) }
    const h7 = validate(diet, moved).filter((c) => c.rule === 'H7')
    expect(h7.some((c) => c.message.startsWith('ME-Y3-A has no lunch'))).toBe(true)
    // Clash Court agrees for the moved class
    const lines = explainPlacement(diet, moved, moved.placements.find((p) => p.assignmentId === victim.assignmentId && p.day === day && p.period === freeOption)!)
    expect(lines.some((c) => c.rule === 'H7' && !c.ok)).toBe(true)
  })
})
