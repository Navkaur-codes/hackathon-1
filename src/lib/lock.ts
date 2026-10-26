// Lock & regenerate (v0.7, rule H10). A locked class lives on the draft (`Placement.locked`) and is handed to every
// generate as a fixed booking — whole college and department alike, the same solver (root §5). The independent
// validator checks it survived (`mustKeep`). Nothing is ever silently moved: a lock that became illegal shows up
// as a clash in the Conflict Center.

import type { CollegeData, Placement } from '../types'

export type LockOutcome = { ok: true; college: CollegeData } | { ok: false; reason: string }

type Where = Pick<Placement, 'assignmentId' | 'day' | 'period'>
const same = (p: Where, q: Where) => p.assignmentId === q.assignmentId && p.day === q.day && p.period === q.period

/** Locked classes of the draft. */
export const lockedOf = (c: CollegeData): Placement[] => (c.draft?.placements ?? []).filter((p) => p.locked)

/** Lock or unlock one class of the draft. */
export function toggleLock(c: CollegeData, where: Where): LockOutcome {
  const d = c.draft
  if (!d) return { ok: false, reason: 'Generate a draft first.' }
  if (!d.placements.some((p) => same(p, where))) return { ok: false, reason: 'That class is no longer in the draft.' }
  return { ok: true, college: { ...c, draft: { ...d, placements: d.placements.map((p) => (same(p, where) ? { ...p, locked: !p.locked } : p)) } } }
}

export function unlockAll(c: CollegeData): CollegeData {
  if (!c.draft || lockedOf(c).length === 0) return c
  return { ...c, draft: { ...c.draft, placements: c.draft.placements.map((p) => (p.locked ? { ...p, locked: false } : p)) } }
}

/** Fixed bookings for a whole-college generate: the locked classes. */
export const lockedFixed = (c: CollegeData): { fixed: Placement[] } => ({ fixed: lockedOf(c) })
