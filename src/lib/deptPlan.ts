// A department's view of the college: what belongs to it, whether it is ready, and its Draft / Ready status.
// Department generate against the rest of the college (P0.5-b) is at the bottom.

import { preflight } from '../solver/preflight'
import { validate } from '../solver/validate'
import type { CollegeData, DeptStatus, Id, Placement, Timetable } from '../types'

/** Ids of everything a department owns or teaches (for scoping lists, warnings and clashes). */
export function deptEntities(c: CollegeData, deptId: Id) {
  const sections = c.sections.filter((s) => s.deptId === deptId)
  const sectionIds = new Set(sections.map((s) => s.id))
  const assignments = c.assignments.filter((a) => sectionIds.has(a.sectionId))
  return {
    sections,
    sectionIds,
    assignments,
    assignmentIds: new Set(assignments.map((a) => a.id)),
    programmes: c.programmes.filter((p) => p.deptId === deptId),
    subjects: c.subjects.filter((s) => s.deptId === deptId),
    teachers: c.teachers.filter((t) => t.deptId === deptId),
    rooms: c.rooms.filter((r) => r.owner === deptId),
  }
}

export type ReadinessItem = {
  id: 'teachers' | 'preflight' | 'placed' | 'clashes'
  ok: boolean
  label: string
  detail: string
  /** Where to fix it on the HOD desk. */
  fix: 'assignments' | 'setup' | 'generate'
}

/** The checklist an HOD clears before marking the department Ready. */
export function readiness(c: CollegeData, deptId: Id): { items: ReadinessItem[]; ready: boolean } {
  const d = deptEntities(c, deptId)
  const items: ReadinessItem[] = []

  const open = d.assignments.filter((a) => !a.teacherId).length
  items.push({
    id: 'teachers',
    ok: open === 0,
    label: 'Every class has a teacher',
    detail: open === 0 ? `All ${d.assignments.length} classes of the department have a teacher.` : `${open} of ${d.assignments.length} classes still need a teacher.`,
    fix: 'assignments',
  })

  const mine = new Set<Id>([deptId, ...d.sectionIds, ...d.assignmentIds, ...d.subjects.map((s) => s.id), ...d.teachers.map((t) => t.id), ...d.rooms.map((r) => r.id)])
  const errors = preflight(c).filter((w) => w.level === 'error' && w.ids.some((id) => mine.has(id)))
  items.push({
    id: 'preflight',
    ok: errors.length === 0,
    label: 'No pre-flight problems',
    detail: errors.length === 0 ? 'Nothing impossible in the department’s setup.' : `${errors.length} problem${errors.length > 1 ? 's' : ''}: ${errors[0].message}`,
    fix: 'setup',
  })

  // judged for this department only: a change elsewhere in the college never holds it back
  const draft = c.draft
  const unplaced = draft ? draft.unplaced.filter((u) => d.assignmentIds.has(u.assignmentId)).reduce((s, u) => s + u.periods, 0) : 0
  const missing = draft ? coverage(c, draft).filter((g) => g.deptId === deptId).reduce((s, g) => s + g.missing, 0) : 0
  const placed = !!draft && unplaced === 0 && missing === 0
  items.push({
    id: 'placed',
    ok: placed,
    label: 'Placed in the college timetable',
    detail: !draft
      ? 'There is no college draft yet — generate the department.'
      : missing
        ? `${missing} period${missing > 1 ? 's' : ''} of the department changed since the draft was made — generate again.`
        : unplaced
          ? `${unplaced} period${unplaced > 1 ? 's' : ''} of the department could not be placed.`
          : 'Every class of the department is in the college draft.',
    fix: 'generate',
  })

  const clashes = draft ? validate(c, draft).filter((x) => x.assignmentIds.some((id) => d.assignmentIds.has(id))) : []
  items.push({
    id: 'clashes',
    ok: !!draft && clashes.length === 0,
    label: 'No clashes',
    detail: !draft ? 'Checked once the department is in the draft.' : clashes.length === 0 ? 'The independent check finds no clash involving the department.' : `${clashes.length} clash${clashes.length > 1 ? 'es' : ''}: ${clashes[0].message}`,
    fix: 'generate',
  })

  return { items, ready: items.every((i) => i.ok) }
}

export const setDeptStatus = (c: CollegeData, deptId: Id, status: DeptStatus): CollegeData => ({
  ...c,
  departments: c.departments.map((d) => (d.id === deptId ? { ...d, status } : d)),
})

/** Mark Ready only when the checklist is clear; otherwise the college is returned unchanged. */
export function markReady(c: CollegeData, deptId: Id): CollegeData {
  return readiness(c, deptId).ready ? setDeptStatus(c, deptId, 'ready') : c
}

/** Wrap an edit made for a department: if it changed anything, the department goes back to Draft. */
export const deptEdit =
  (deptId: Id, fn: (c: CollegeData) => CollegeData) =>
  (c: CollegeData): CollegeData => {
    const next = fn(c)
    return next === c ? c : setDeptStatus(next, deptId, 'draft')
  }

// ── Department generate (P0.5-b) ──────────────────────────────────────
// One ledger, one algorithm (root §5): the college draft is the global booking ledger. A department is solved
// with `solveBest` — only its assignments, every other department's placements as fixed bookings — and merged
// back. Nothing of another department ever moves.

/** Solver options for generating one department against the rest of the college (its own locked classes stay too). */
export function deptSolveOptions(c: CollegeData, deptId: Id): { assignmentIds: Id[]; fixed: Placement[] } {
  const mine = deptEntities(c, deptId).assignmentIds
  return {
    assignmentIds: [...mine],
    fixed: (c.draft?.placements ?? []).filter((p) => !mine.has(p.assignmentId) || p.locked),
  }
}

/**
 * Put a department's freshly generated timetable into the college draft: the result already holds the other
 * departments' placements (they were fixed), this department's new ones, and this department's unplaced;
 * the other departments' unplaced are kept from the old draft. The draft is no longer stale — from here the
 * clash check and `coverage` judge it.
 */
export function mergeDept(c: CollegeData, deptId: Id, result: Timetable): CollegeData {
  const mine = deptEntities(c, deptId).assignmentIds
  const keptUnplaced = (c.draft?.unplaced ?? []).filter((u) => !mine.has(u.assignmentId))
  const draft: Timetable = {
    collegeId: c.college.id,
    seed: result.seed,
    placements: result.placements,
    unplaced: [...keptUnplaced, ...result.unplaced.filter((u) => mine.has(u.assignmentId))],
  }
  return setDeptStatus({ ...c, draft, draftStale: false }, deptId, 'draft')
}

/** A class whose periods are not all accounted for in the draft (neither placed nor listed as unplaced). */
export type Gap = { assignmentId: Id; deptId: Id; missing: number }

/**
 * Classes the draft does not cover yet — e.g. a subject added, a teacher assigned or periods raised after the
 * draft was generated. Empty = every period of every class is placed or reported as unplaced.
 */
export function coverage(c: CollegeData, draft: Timetable | undefined): Gap[] {
  const placed = new Map<Id, number>()
  for (const p of draft?.placements ?? []) placed.set(p.assignmentId, (placed.get(p.assignmentId) ?? 0) + p.length)
  for (const u of draft?.unplaced ?? []) placed.set(u.assignmentId, (placed.get(u.assignmentId) ?? 0) + u.periods)
  const subjects = new Map(c.subjects.map((s) => [s.id, s]))
  const sections = new Map(c.sections.map((s) => [s.id, s]))
  const gaps: Gap[] = []
  for (const a of c.assignments) {
    const missing = (subjects.get(a.subjectId)?.periodsPerWeek ?? 0) - (placed.get(a.id) ?? 0)
    if (missing > 0) gaps.push({ assignmentId: a.id, deptId: sections.get(a.sectionId)?.deptId ?? '', missing })
  }
  return gaps
}
