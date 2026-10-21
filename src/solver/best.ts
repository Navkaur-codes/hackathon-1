// Seeded restarts: run the solver with different seeds and keep the best weekly pattern —
// fewest unplaced periods first, then the highest quality score. Also bundles everything the UI shows.

import { semesterDelivery, semesterSummary } from '../lib/semester'
import type { CollegeData, Timetable } from '../types'
import { preflight, type Warning } from './preflight'
import { score, type Score } from './score'
import { solve, type SolveOptions } from './solve'
import { validate, type Conflict } from './validate'

export type SolveResult = {
  timetable: Timetable
  score: Score
  /** Independent validator output — must be empty. */
  conflicts: Conflict[]
  preflight: Warning[]
  attempts: number
  /** Seed of the attempt that was kept, so the same timetable can be reproduced. */
  bestSeed: number
  unplacedPeriods: number
  placedPeriods: number
  /** Contact hours the pattern delivers over the whole semester (holidays deducted). */
  semesterHours: number
  teachingDays: number
  ms: number
}

export type BestOptions = Omit<SolveOptions, 'seed'> & { attempts?: number; baseSeed?: number }

const unplacedOf = (t: Timetable) => t.unplaced.reduce((s, u) => s + u.periods, 0)

export function solveBest(college: CollegeData, opts: BestOptions = {}): SolveResult {
  const started = Date.now()
  const attempts = Math.max(1, opts.attempts ?? 20)
  const baseSeed = opts.baseSeed ?? 1
  let best: { t: Timetable; s: Score; u: number } | null = null

  for (let i = 0; i < attempts; i++) {
    const t = solve(college, { ...opts, seed: baseSeed + i })
    const u = unplacedOf(t)
    if (best && u > best.u) continue
    const s = score(college, t)
    if (!best || u < best.u || s.total > best.s.total) best = { t, s, u }
  }

  const timetable = best!.t
  const delivery = semesterDelivery(college, timetable)
  return {
    timetable,
    score: best!.s,
    conflicts: validate(college, timetable, { mustKeep: opts.fixed?.filter((p) => p.locked) }),
    preflight: preflight(college),
    attempts,
    bestSeed: timetable.seed,
    unplacedPeriods: best!.u,
    placedPeriods: timetable.placements.reduce((s, p) => s + p.length, 0),
    semesterHours: Math.round(delivery.reduce((s, d) => s + d.minutes, 0) / 60),
    teachingDays: semesterSummary(college).teachingDays,
    ms: Date.now() - started,
  }
}
