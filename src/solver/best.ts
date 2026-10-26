// Seeded restarts: run the solver with different seeds and keep the best weekly pattern —
// fewest unplaced periods first, then the highest quality score. Also bundles everything the UI shows.

import { syncAllocations } from '../lib/allocation'
import { semesterDelivery, semesterSummary } from '../lib/semester'
import type { CollegeData, Placement, Timetable } from '../types'
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

  // with anyRoom the result is judged as it will be stored: every use of another department's room allocated
  const judged = opts.anyRoom ? syncAllocations({ ...college, draft: best!.t }) : college
  return {
    ...describeTimetable(judged, best!.t, { mustKeep: opts.fixed?.filter((p) => p.locked) }),
    attempts,
    ms: Date.now() - started,
  }
}

/**
 * Everything the UI shows about a stored timetable, recomputed from the college as it is now — the store
 * keeps only the `Timetable`, so score, clashes and pre-flight can never drift from the data.
 */
export function describeTimetable(college: CollegeData, timetable: Timetable, opts: { mustKeep?: Placement[] } = {}): SolveResult {
  const delivery = semesterDelivery(college, timetable)
  return {
    timetable,
    score: score(college, timetable),
    conflicts: validate(college, timetable, opts),
    preflight: preflight(college),
    attempts: 1,
    bestSeed: timetable.seed,
    unplacedPeriods: unplacedOf(timetable),
    placedPeriods: timetable.placements.reduce((s, p) => s + p.length, 0),
    semesterHours: Math.round(delivery.reduce((s, d) => s + d.minutes, 0) / 60),
    teachingDays: semesterSummary(college).teachingDays,
    ms: 0,
  }
}
