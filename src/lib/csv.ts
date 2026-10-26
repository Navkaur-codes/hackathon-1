// Paste from Excel / Google Sheets (tab-separated) or CSV. A header row is optional. Every bad row is
// reported with its line number; names resolve within THIS college only (rule G1, H13).

import Papa from 'papaparse'
import type { CollegeData, Id, RoomType } from '../types'
import { addRoom, addTeacher, setAssignmentTeacher, type RoomInput, type TeacherInput } from './edit'

export type RowError = { line: number; message: string }
export type Parsed<T> = { rows: { line: number; value: T }[]; errors: RowError[] }
export type AssignmentRow = { assignmentId: Id; teacherId: Id; label: string }

const HEADER = /^(name|teacher|room|section|subject|code|dept|department|type|kind|capacity|seats|owner|max)/i
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** Rows of trimmed cells with their 1-based line numbers; a leading header row is skipped. */
function table(text: string): { line: number; cells: string[] }[] {
  const parsed = Papa.parse<string[]>(text.replace(/\r\n?/g, '\n').replace(/\n+$/, ''), { skipEmptyLines: false })
  const rows = parsed.data
    .map((cells, i) => ({ line: i + 1, cells: cells.map((c) => (c ?? '').trim()) }))
    .filter((r) => r.cells.some((c) => c !== ''))
  if (rows.length && rows[0].cells.some((c) => HEADER.test(c)) && !rows[0].cells.some((c) => /^\d+$/.test(c))) rows.shift()
  return rows
}

const int = (s: string): number | null => (/^\d+$/.test(s) ? Number(s) : null)

const findDept = (c: CollegeData, s: string) => c.departments.find((d) => norm(d.code) === norm(s) || norm(d.name) === norm(s))

/** `name, department (code or name), max periods a day, max periods a week` — the last two optional. */
export function parseTeachers(text: string, c: CollegeData): Parsed<TeacherInput> {
  const out: Parsed<TeacherInput> = { rows: [], errors: [] }
  const seen = new Set(c.teachers.map((t) => norm(t.name)))
  const P = c.calendar.periodsPerDay
  for (const { line, cells } of table(text)) {
    const [name = '', dept = '', day = '', week = ''] = cells
    const d = findDept(c, dept)
    const maxPerDay = day ? int(day) : Math.min(4, P)
    const maxPerWeek = week ? int(week) : (maxPerDay ?? 4) * 4
    const err = (message: string) => out.errors.push({ line, message })
    if (!name) err('No teacher name.')
    else if (seen.has(norm(name))) err(`${name} is already a teacher here.`)
    else if (!d) err(dept ? `No department "${dept}" in ${c.college.code}.` : `No department for ${name}.`)
    else if (maxPerDay === null || maxPerDay < 1 || maxPerDay > P) err(`Max a day must be a number from 1 to ${P} (got "${day}").`)
    else if (maxPerWeek === null || maxPerWeek < 1) err(`Max a week must be a whole number (got "${week}").`)
    else {
      seen.add(norm(name))
      out.rows.push({ line, value: { name, deptId: d.id, maxPerDay, maxPerWeek } })
    }
  }
  return out
}

const ROOM_TYPES: [RegExp, RoomType][] = [
  [/^(lecture|lecture room|lecture hall|class ?room|lt|theory)$/i, 'lecture'],
  [/^(lab|laboratory|computer lab|practical)$/i, 'lab'],
  [/^(seminar|seminar hall|hall|auditorium)$/i, 'seminar'],
]

/** `name, type (lecture / lab / seminar), seats, owner (department code or name; blank or "shared" = shared)`. */
export function parseRooms(text: string, c: CollegeData): Parsed<RoomInput> {
  const out: Parsed<RoomInput> = { rows: [], errors: [] }
  const seen = new Set(c.rooms.map((r) => norm(r.name)))
  for (const { line, cells } of table(text)) {
    const [name = '', type = '', seats = '', owner = ''] = cells
    const t = ROOM_TYPES.find(([re]) => re.test(type.trim()))?.[1]
    const capacity = int(seats)
    const shared = !owner || /^(shared|common|all|college)$/i.test(owner)
    const d = shared ? null : findDept(c, owner)
    const err = (message: string) => out.errors.push({ line, message })
    if (!name) err('No room name.')
    else if (seen.has(norm(name))) err(`${name} already exists.`)
    else if (!t) err(`Room type must be lecture, lab or seminar (got "${type}").`)
    else if (capacity === null || capacity < 1) err(`Seats must be a whole number (got "${seats}").`)
    else if (!shared && !d) err(`No department "${owner}" in ${c.college.code} — or write "shared".`)
    else {
      seen.add(norm(name))
      out.rows.push({ line, value: { name, type: t, capacity, owner: d ? d.id : 'shared' } })
    }
  }
  return out
}

/** `section, subject code, teacher name` — the subject must be in that section's programme. */
export function parseAssignments(text: string, c: CollegeData): Parsed<AssignmentRow> {
  const out: Parsed<AssignmentRow> = { rows: [], errors: [] }
  for (const { line, cells } of table(text)) {
    const [sectionName = '', code = '', teacherName = ''] = cells
    const section = c.sections.find((s) => norm(s.name) === norm(sectionName))
    const subject = section && c.subjects.find((s) => s.programmeId === section.programmeId && norm(s.code) === norm(code))
    const assignment = section && subject && c.assignments.find((a) => a.sectionId === section.id && a.subjectId === subject.id)
    const teacher = c.teachers.find((t) => norm(t.name) === norm(teacherName))
    const err = (message: string) => out.errors.push({ line, message })
    if (!section) err(`No section "${sectionName}" in ${c.college.code}.`)
    else if (!subject || !assignment) err(`${section.name} does not take a subject "${code}".`)
    else if (!teacher) err(teacherName ? `No teacher "${teacherName}" in ${c.college.code} — add them first.` : 'No teacher name.')
    else out.rows.push({ line, value: { assignmentId: assignment.id, teacherId: teacher.id, label: `${section.name} · ${subject.code} → ${teacher.name}` } })
  }
  return out
}

/**
 * An HOD pastes for their own department only (root §2): rows for another department — or a shared room,
 * which belongs to the College Admin — move to the errors with the reason.
 */
export function limitToDept<T extends TeacherInput | RoomInput | AssignmentRow>(
  kind: 'teachers' | 'rooms' | 'assignments',
  parsed: Parsed<T>,
  c: CollegeData,
  deptId: Id,
): Parsed<T> {
  const code = (id: Id) => c.departments.find((d) => d.id === id)?.code ?? id
  const mine = code(deptId)
  const out: Parsed<T> = { rows: [], errors: [...parsed.errors] }
  for (const r of parsed.rows) {
    let why: string | null = null
    if (kind === 'teachers') {
      const t = r.value as TeacherInput
      if (t.deptId !== deptId) why = `${t.name} is in ${code(t.deptId)} — you can add teachers of ${mine} only.`
    } else if (kind === 'rooms') {
      const room = r.value as RoomInput
      if (room.owner === 'shared') why = `Shared rooms are set up by the College Admin — give ${room.name} to ${mine} or ask them.`
      else if (room.owner !== deptId) why = `${room.name} would belong to ${code(room.owner)} — you can add rooms of ${mine} only.`
    } else {
      const a = c.assignments.find((x) => x.id === (r.value as AssignmentRow).assignmentId)
      const section = c.sections.find((s) => s.id === a?.sectionId)
      if (section?.deptId !== deptId) why = `${section?.name ?? 'That section'} is in ${code(section?.deptId ?? '')} — you can assign teachers to ${mine} sections only.`
    }
    if (why) out.errors.push({ line: r.line, message: why })
    else out.rows.push(r)
  }
  out.errors.sort((a, b) => a.line - b.line)
  return out
}

export const applyTeachers = (c: CollegeData, rows: TeacherInput[]) => rows.reduce(addTeacher, c)
export const applyRooms = (c: CollegeData, rows: RoomInput[]) => rows.reduce(addRoom, c)
export const applyAssignments = (c: CollegeData, rows: AssignmentRow[]) => rows.reduce((x, r) => setAssignmentTeacher(x, r.assignmentId, r.teacherId), c)
