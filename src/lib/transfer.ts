// Export a whole college to a JSON file and import it back — backup, moving between browsers, sharing a
// setup. An import is checked before it can touch the store: shape, ids, collegeId on every record (H13)
// and every reference (H12).

import type { CollegeData, Id } from '../types'

export const EXPORT_FORMAT = 1
type ExportFile = { app: 'kaalchakra'; format: number; exportedAt: string; college: CollegeData }

export function exportCollege(c: CollegeData, at: string): string {
  const file: ExportFile = { app: 'kaalchakra', format: EXPORT_FORMAT, exportedAt: at, college: c }
  return JSON.stringify(file, null, 2)
}

export const exportFileName = (c: CollegeData, at: string) => `kaalchakra-${c.college.id}-${at.slice(0, 10)}.json`

const LISTS = ['departments', 'programmes', 'sections', 'subjects', 'teachers', 'rooms', 'assignments', 'grants', 'leaves', 'substitutions', 'officeHours', 'meetings'] as const

/** Problems that make a college unsafe to load (empty = fine). Checks only what the app relies on. */
export function checkCollege(c: CollegeData): string[] {
  const problems: string[] = []
  if (!c || typeof c !== 'object' || !c.college?.id || !c.calendar || !c.semester) return ['This is not a Kaalchakra college.']
  const cid = c.college.id
  for (const list of LISTS) if (!Array.isArray(c[list])) problems.push(`"${list}" is missing.`)
  if (problems.length) return problems
  if (!Array.isArray(c.calendar.days) || !(c.calendar.periodsPerDay > 0)) problems.push('The calendar has no days or slots.')

  const seen = new Set<Id>()
  const foreign = new Map<Id, number>()
  for (const list of LISTS)
    for (const r of c[list] as { id: Id; collegeId: Id }[]) {
      if (seen.has(r.id)) problems.push(`Duplicate id ${r.id}.`)
      seen.add(r.id)
      if (r.collegeId !== cid) foreign.set(r.collegeId, (foreign.get(r.collegeId) ?? 0) + 1)
    }
  for (const [other, n] of foreign)
    problems.push(`${n} ${n === 1 ? 'record belongs' : 'records belong'} to college "${other}", not ${cid}.`)
  if (c.calendar.collegeId !== cid || c.semester.collegeId !== cid) problems.push('Calendar or semester belongs to another college.')

  const ids = (list: { id: Id }[]) => new Set(list.map((x) => x.id))
  const depts = ids(c.departments)
  const progs = ids(c.programmes)
  const secs = ids(c.sections)
  const subs = ids(c.subjects)
  const teachers = ids(c.teachers)
  const rooms = ids(c.rooms)
  const missing = (what: string, id: Id, owner: Id) => problems.push(`${owner} points at a missing ${what} (${id}).`)
  for (const p of c.programmes) if (!depts.has(p.deptId)) missing('department', p.deptId, p.id)
  for (const s of c.sections) {
    if (!progs.has(s.programmeId)) missing('programme', s.programmeId, s.id)
    if (!depts.has(s.deptId)) missing('department', s.deptId, s.id)
  }
  for (const s of c.subjects) if (!progs.has(s.programmeId)) missing('programme', s.programmeId, s.id)
  for (const t of c.teachers) if (!depts.has(t.deptId)) missing('department', t.deptId, t.id)
  for (const r of c.rooms) if (r.owner !== 'shared' && !depts.has(r.owner)) missing('department', r.owner, r.id)
  for (const a of c.assignments) {
    if (!secs.has(a.sectionId)) missing('section', a.sectionId, a.id)
    if (!subs.has(a.subjectId)) missing('subject', a.subjectId, a.id)
    if (a.teacherId && !teachers.has(a.teacherId)) missing('teacher', a.teacherId, a.id)
  }
  for (const g of c.grants) if (!rooms.has(g.roomId)) missing('room', g.roomId, g.id)
  for (const t of [c.draft, c.published?.timetable])
    if (t && t.collegeId !== cid) problems.push('A stored timetable belongs to another college.')
  return problems.slice(0, 12)
}

export type ImportOutcome = { ok: true; college: CollegeData } | { ok: false; errors: string[] }

/**
 * Read an exported file. With `intoCollegeId` (a College Admin replacing their own college) the file must be
 * of that same college. A draft comes along unchanged — publishing re-runs the independent check anyway.
 */
export function importCollege(text: string, intoCollegeId?: Id): ImportOutcome {
  let file: Partial<ExportFile>
  try {
    file = JSON.parse(text)
  } catch {
    return { ok: false, errors: ['This file is not valid JSON.'] }
  }
  if (file?.app !== 'kaalchakra' || !file.college) return { ok: false, errors: ['This is not a Kaalchakra export.'] }
  if (file.format !== EXPORT_FORMAT) return { ok: false, errors: [`Unsupported export format ${file.format}.`] }
  const c = file.college
  if (intoCollegeId && c.college?.id !== intoCollegeId)
    return { ok: false, errors: [`This file is for ${c.college?.code ?? 'another college'} (${c.college?.name ?? '?'}), not this college.`] }
  const problems = checkCollege(c)
  if (problems.length) return { ok: false, errors: problems }
  return { ok: true, college: c }
}
