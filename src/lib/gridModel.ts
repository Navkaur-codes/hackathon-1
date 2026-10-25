// Pure model of one timetable grid (rule G4: shape comes only from the college calendar).

import type { CollegeData, Id, Placement, Room, Section, Subject, Teacher, Timetable } from '../types'
import { periodTimes, resolvedBreakSlots, slotKey } from './structure'

export type GridView = 'section' | 'teacher' | 'room'

export type GridRow = { index: number; start: string; end: string; inLunchWindow: boolean }

export type GridCell = {
  key: string
  day: number
  start: number
  span: number
  placement: Placement
  subject: Subject
  section: Section
  teacher: Teacher | null
  room: Room | null
  lab: boolean
  /** Second line under the subject, depends on the view. */
  detail: string
}

export type GridBreak = { day: number; period: number; label: string }

export type Grid = {
  view: GridView
  entityId: Id
  title: string
  subtitle: string
  days: string[]
  rows: GridRow[]
  cells: GridCell[]
  /** Break / blocked slots to draw as hatched (section view: its own breaks; all views: college blocked slots). */
  breaks: GridBreak[]
  /** Periods taught per week by this entity. */
  periods: number
}

export type EntityGroup = { group: string; items: { id: Id; label: string }[] }

/** Everything that can be viewed, grouped by department (rooms: owning dept or "Shared"). */
export function listEntities(college: CollegeData, view: GridView): EntityGroup[] {
  const deptName = new Map(college.departments.map((d) => [d.id, d.name]))
  const groups = new Map<string, { id: Id; label: string }[]>()
  const add = (group: string, id: Id, label: string) => groups.set(group, [...(groups.get(group) ?? []), { id, label }])
  if (view === 'section') for (const s of college.sections) add(deptName.get(s.deptId) ?? s.deptId, s.id, s.name)
  if (view === 'teacher') for (const t of college.teachers) add(deptName.get(t.deptId) ?? t.deptId, t.id, t.name)
  if (view === 'room')
    for (const r of college.rooms) add(r.owner === 'shared' ? 'Shared rooms' : (deptName.get(r.owner) ?? r.owner), r.id, `${r.name} · ${r.capacity}`)
  return [...groups].map(([group, items]) => ({ group, items }))
}

export function buildGrid(college: CollegeData, timetable: Timetable, view: GridView, entityId: Id): Grid {
  const cal = college.calendar
  const times = periodTimes(cal)
  const assignments = new Map(college.assignments.map((a) => [a.id, a]))
  const subjects = new Map(college.subjects.map((s) => [s.id, s]))
  const sections = new Map(college.sections.map((s) => [s.id, s]))
  const teachers = new Map(college.teachers.map((t) => [t.id, t]))
  const rooms = new Map(college.rooms.map((r) => [r.id, r]))

  const rows: GridRow[] = times.map((t) => ({ ...t, inLunchWindow: cal.lunchWindow.includes(t.index) }))

  const cells: GridCell[] = []
  for (const p of timetable.placements) {
    const a = assignments.get(p.assignmentId)
    if (!a) continue
    const mine =
      (view === 'section' && a.sectionId === entityId) ||
      (view === 'teacher' && a.teacherId === entityId) ||
      (view === 'room' && p.roomId === entityId)
    if (!mine) continue
    const subject = subjects.get(a.subjectId)!
    const section = sections.get(a.sectionId)!
    const teacher = a.teacherId ? (teachers.get(a.teacherId) ?? null) : null
    const room = rooms.get(p.roomId) ?? null
    const detail =
      view === 'section'
        ? [teacher?.name, room?.name].filter(Boolean).join(' · ')
        : view === 'teacher'
          ? [section.name, room?.name].filter(Boolean).join(' · ')
          : [section.name, teacher?.name].filter(Boolean).join(' · ')
    cells.push({
      key: `${p.assignmentId}@${p.day}-${p.period}`,
      day: p.day,
      start: p.period,
      span: p.length,
      placement: p,
      subject,
      section,
      teacher,
      room,
      lab: subject.kind === 'lab',
      detail,
    })
  }
  cells.sort((x, y) => x.day - y.day || x.start - y.start)

  const breaks: GridBreak[] = cal.blockedSlots.map((k) => {
    const [day, period] = k.split('-').map(Number)
    return { day, period, label: 'Blocked' }
  })
  let title = entityId
  let subtitle = ''
  if (view === 'section') {
    const s = sections.get(entityId)
    if (s) {
      const prog = college.programmes.find((p) => p.id === s.programmeId)
      title = s.name
      subtitle = `${prog?.name ?? ''} · ${s.strength} students`
      // fixed breaks, plus each day's flexible break where it actually landed in this timetable
      const busy = new Set(cells.flatMap((c) => Array.from({ length: c.span }, (_, i) => slotKey(c.day, c.start + i))))
      for (const [k, label] of resolvedBreakSlots(college, s, busy)) {
        const [day, period] = k.split('-').map(Number)
        breaks.push({ day, period, label: label ?? 'Break' })
      }
    }
  } else if (view === 'teacher') {
    const t = teachers.get(entityId)
    if (t) {
      title = t.name
      subtitle = `${college.departments.find((d) => d.id === t.deptId)?.name ?? ''} · up to ${t.maxPerDay}/day, ${t.maxPerWeek}/week`
    }
  } else {
    const r = rooms.get(entityId)
    if (r) {
      title = r.name
      subtitle = `${r.type} · ${r.capacity} seats · ${r.owner === 'shared' ? 'shared by all departments' : (college.departments.find((d) => d.id === r.owner)?.name ?? '')}`
    }
  }

  // de-duplicate (a blocked slot may also be a break)
  const seen = new Set<string>()
  const uniqueBreaks = breaks.filter((b) => {
    const k = slotKey(b.day, b.period)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  return {
    view,
    entityId,
    title,
    subtitle,
    days: cal.days,
    rows,
    cells,
    breaks: uniqueBreaks,
    periods: cells.reduce((s, c) => s + c.span, 0),
  }
}
