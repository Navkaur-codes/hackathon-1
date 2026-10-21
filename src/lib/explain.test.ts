import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { solve } from '../solver/solve'
import { validate } from '../solver/validate'
import type { Placement, Timetable } from '../types'
import { explainPlacement } from './explain'

const [diet, dcas] = buildDemoColleges()

describe('T3.3 Clash Court', () => {
  it('every check is ✓ for every class the solver placed (both demos)', () => {
    for (const c of [diet, dcas]) {
      const t = solve(c, { seed: 1 })
      for (const p of t.placements) {
        const failing = explainPlacement(c, t, p).filter((x) => !x.ok)
        expect(failing, `${p.assignmentId} ${p.day}-${p.period}`).toEqual([])
      }
    }
  })

  it('covers the rules that apply to a single class', () => {
    const t = solve(diet, { seed: 1 })
    const rules = new Set(explainPlacement(diet, t, t.placements[0]).map((x) => x.rule))
    for (const r of ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'H11', 'H14']) expect(rules.has(r as never), r).toBe(true)
  })

  it('reads like a person wrote it', () => {
    const t = solve(diet, { seed: 1 })
    const p = t.placements.find((x) => x.assignmentId.endsWith('-ds') && x.deptId === 'diet-cse')!
    const texts = explainPlacement(diet, t, p).map((x) => x.text)
    expect(texts.some((s) => /^Dr\. Harpreet Kaur has no other class at \w{3} \d\d:\d\d\.$/.test(s) || /^Prof\. Aman Bedi has no other class/.test(s))).toBe(true)
    expect(texts.some((s) => /seats \d+ ≥ 60 students\./.test(s))).toBe(true)
    expect(texts.some((s) => /free for lunch on/.test(s))).toBe(true)
  })

  /** Break one rule on purpose; the failing check must name the same rule the validator reports. */
  const breakAndCompare = (t: Timetable, broken: Placement[], target: (p: Placement) => boolean) => {
    const tt = { ...t, placements: broken }
    const validatorRules = new Set(validate(diet, tt).map((c) => c.rule))
    const p = broken.find(target)!
    const explainRules = new Set(explainPlacement(diet, tt, p).filter((x) => !x.ok).map((x) => x.rule))
    expect(explainRules.size).toBeGreaterThan(0)
    for (const r of explainRules) expect(validatorRules.has(r), `${r} also reported by the validator`).toBe(true)
    return explainRules
  }

  it('a class moved into its own lunch break fails H7, agreeing with the validator', () => {
    const t = solve(diet, { seed: 1 })
    const victim = t.placements.find((p) => p.deptId === 'diet-cse' && p.length === 1)!
    const moved = { ...victim, period: 3 } // CSE lunch slot
    const rules = breakAndCompare(t, t.placements.map((p) => (p === victim ? moved : p)), (p) => p === moved)
    expect(rules.has('H7')).toBe(true)
  })

  it('a teacher double-booked fails H1, agreeing with the validator', () => {
    const t = solve(diet, { seed: 1 })
    const a = t.placements.find((p) => p.assignmentId.endsWith('-dm'))! // Dr. Gill, Discrete Maths
    const b = t.placements.find((p) => p.assignmentId.endsWith('--diet-ece-y2-em'))! // Dr. Gill, Engineering Maths (ECE)
    const clash = { ...b, day: a.day, period: a.period }
    const rules = breakAndCompare(t, t.placements.map((p) => (p === b ? clash : p)), (p) => p === clash)
    expect(rules.has('H1')).toBe(true)
  })

  it('a section in another department’s room without a grant fails H11', () => {
    const t = solve(diet, { seed: 1 })
    const victim = t.placements.find((p) => p.deptId === 'diet-me' && p.length === 1)!
    const moved = { ...victim, roomId: 'diet-rm-lt-101' } // CSE's room
    const rules = breakAndCompare(t, t.placements.map((p) => (p === victim ? moved : p)), (p) => p === moved)
    expect(rules.has('H11')).toBe(true)
  })
})
