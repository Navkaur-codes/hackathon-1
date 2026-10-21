import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import type { Placement, Timetable } from '../types'
import { solveBest } from './best'
import { runSolver } from './runSolver'
import { score } from './score'
import { solve } from './solve'

const [diet, dcas] = buildDemoColleges()

describe('T6a quality score', () => {
  it('is 0–100 with every part between 0 and 1', () => {
    for (const c of [diet, dcas]) {
      for (const seed of [1, 2, 3]) {
        const s = score(c, solve(c, { seed }))
        expect(s.total).toBeGreaterThanOrEqual(0)
        expect(s.total).toBeLessThanOrEqual(100)
        for (const v of Object.values(s.parts)) {
          expect(v).toBeGreaterThanOrEqual(0)
          expect(v).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('an empty timetable scores 100 — completeness is judged by unplaced periods, not by the score', () => {
    const empty: Timetable = { collegeId: diet.college.id, seed: 0, placements: [], unplaced: [] }
    expect(score(diet, empty).total).toBe(100)
  })

  it('drops when the same subject is crammed into one day', () => {
    const t = solve(diet, { seed: 1 })
    const good = score(diet, t)
    // move every session of one 4-period theory subject onto Monday, periods 0–3 (quality only — may clash)
    const target = t.placements.find((p) => p.assignmentId.endsWith('--diet-cse-y2-ds'))!.assignmentId
    let k = 0
    const crammed: Placement[] = t.placements.map((p) => (p.assignmentId === target ? { ...p, day: 0, period: k++ } : p))
    const bad = score(diet, { ...t, placements: crammed })
    expect(bad.parts.sameDay).toBeLessThan(good.parts.sameDay)
    expect(bad.parts.spread).toBeLessThan(good.parts.spread)
    expect(bad.total).toBeLessThan(good.total)
  })

  it('is deterministic', () => {
    const t = solve(dcas, { seed: 4 })
    expect(score(dcas, t)).toEqual(score(dcas, t))
  })
})

describe('restarts (solveBest)', () => {
  it('is never worse than the first attempt, and verifies itself', () => {
    for (const c of [diet, dcas]) {
      const single = solve(c, { seed: 1 })
      const best = solveBest(c, { attempts: 20, baseSeed: 1 })
      expect(best.conflicts).toEqual([])
      expect(best.unplacedPeriods).toBeLessThanOrEqual(single.unplaced.reduce((s, u) => s + u.periods, 0))
      expect(best.score.total).toBeGreaterThanOrEqual(score(c, single).total)
      expect(best.attempts).toBe(20)
      expect(best.timetable.seed).toBe(best.bestSeed)
    }
  })

  it('reports semester totals for the card', () => {
    const r = solveBest(diet, { attempts: 5 })
    expect(r.unplacedPeriods).toBe(0)
    expect(r.placedPeriods).toBe(diet.assignments.reduce((s, a) => s + diet.subjects.find((x) => x.id === a.subjectId)!.periodsPerWeek, 0))
    expect(r.teachingDays).toBe(105)
    expect(r.semesterHours).toBeGreaterThan(0)
    expect(r.preflight.filter((w) => w.level === 'error')).toEqual([])
  })

  it('is reproducible from its seed', () => {
    const r = solveBest(dcas, { attempts: 8, baseSeed: 10 })
    expect(solve(dcas, { seed: r.bestSeed })).toEqual(r.timetable)
  })
})

describe('runSolver', () => {
  it('falls back to inline solving where Web Workers do not exist, with the same result', async () => {
    const viaRunner = await runSolver(dcas, { attempts: 3 })
    const direct = solveBest(dcas, { attempts: 3 })
    expect(viaRunner.timetable).toEqual(direct.timetable)
    expect(viaRunner.score).toEqual(direct.score)
  })
})
