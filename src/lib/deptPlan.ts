// A department's view of the college: what belongs to it, whether it is ready, and its Draft / Ready status.
// P0.5-b adds department generate against the rest of the college here.

import { preflight } from '../solver/preflight'
import { validate } from '../solver/validate'
import type { CollegeData, DeptStatus, Id } from '../types'

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

  const draft = c.draft
  const unplaced = draft ? draft.unplaced.filter((u) => d.assignmentIds.has(u.assignmentId)).reduce((s, u) => s + u.periods, 0) : 0
  const placed = !!draft && !c.draftStale && unplaced === 0 && d.assignments.every((a) => !a.teacherId || draft.placements.some((p) => p.assignmentId === a.id))
  items.push({
    id: 'placed',
    ok: placed,
    label: 'Placed in the college timetable',
    detail: !draft
      ? 'There is no college draft yet — generate the department.'
      : c.draftStale
        ? 'The college draft is out of date — generate again.'
        : unplaced
          ? `${unplaced} period${unplaced > 1 ? 's' : ''} of the department could not be placed.`
          : placed
            ? 'Every class of the department is in the college draft.'
            : 'Some classes of the department are not in the draft yet — generate again.',
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
