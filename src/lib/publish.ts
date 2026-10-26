// Draft → published version (root §5: publish is blocked on ANY clash the independent validator finds).
// Pure: the caller passes the time, so versions are reproducible in tests.

import { score } from '../solver/score'
import { validate } from '../solver/validate'
import type { CollegeData, Timetable } from '../types'

/** A freshly generated timetable becomes the working draft (no longer stale). */
export const setDraft = (c: CollegeData, timetable: Timetable): CollegeData => ({ ...c, draft: timetable, draftStale: false })

export type PublishCheck = {
  /** Reasons publishing is impossible right now (empty = allowed). */
  blocked: string[]
  /** Periods that could not be placed — publishing them needs the admin's explicit OK. */
  unplaced: number
}

export function publishCheck(c: CollegeData): PublishCheck {
  const draft = c.draft
  if (!draft) return { blocked: ['Generate a timetable first — there is no draft to publish.'], unplaced: 0 }
  const blocked: string[] = []
  if (draft.collegeId !== c.college.id) blocked.push('This draft belongs to another college.')
  if (c.draftStale) blocked.push('The structure or setup changed after this draft was generated — generate again before publishing.')
  const conflicts = validate(c, draft)
  if (conflicts.length)
    blocked.push(
      `The independent check found ${conflicts.length} ${conflicts.length === 1 ? 'clash' : 'clashes'}: ${conflicts
        .slice(0, 3)
        .map((x) => `${x.rule} ${x.message}`)
        .join(' · ')}${conflicts.length > 3 ? ' …' : ''}`,
    )
  return { blocked, unplaced: draft.unplaced.reduce((s, u) => s + u.periods, 0) }
}

export type PublishOutcome = { ok: true; college: CollegeData } | { ok: false; reasons: string[] }

/** Publish the draft as the next version. `acceptUnplaced` must be true when some periods could not be placed. */
export function publish(c: CollegeData, at: string, opts: { acceptUnplaced?: boolean } = {}): PublishOutcome {
  const check = publishCheck(c)
  if (check.blocked.length) return { ok: false, reasons: check.blocked }
  if (check.unplaced > 0 && !opts.acceptUnplaced)
    return { ok: false, reasons: [`${check.unplaced} ${check.unplaced === 1 ? 'period is' : 'periods are'} not placed — confirm to publish anyway.`] }
  const draft = c.draft!
  const log = c.publishLog ?? []
  const version = (log.at(-1)?.version ?? 0) + 1
  return {
    ok: true,
    college: {
      ...c,
      published: { timetable: draft, version, at },
      publishLog: [
        ...log,
        { version, at, score: score(c, draft).total, periods: draft.placements.reduce((s, p) => s + p.length, 0), unplaced: check.unplaced },
      ],
    },
  }
}

/** Take the published version down (teachers and students then see nothing); the history keeps it. */
export function unpublish(c: CollegeData, at: string): CollegeData {
  if (!c.published) return c
  const v = c.published.version
  return {
    ...c,
    published: undefined,
    publishLog: (c.publishLog ?? []).map((e) => (e.version === v ? { ...e, unpublishedAt: at } : e)),
  }
}
