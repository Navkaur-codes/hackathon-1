// Leave cover (user decision, v0.2): when the HOD approves a leave for a date, every class the teacher
// had that date gets the best FREE teacher in the same slot — auto-allotted as 'suggested', the HOD may
// swap it. The weekly pattern never changes. Only that date is affected.

import { classesOn, dayIndexOf } from '../lib/semester'
import { slotKey } from '../lib/structure'
import type { CollegeData, Id, LeaveRequest, Placement, Substitution, Timetable } from '../types'
import { validate, type Conflict } from './validate'

export type Candidate = { teacherId: Id; score: number; note: string }

type DayState = {
  day: number
  /** teacherId → periods busy that date */
  busy: Map<Id, Set<number>>
  absent: Set<Id>
}

/** Who is busy on a date (pattern + that date's substitutions) and who is away. */
function dayState(college: CollegeData, timetable: Timetable, date: string, subs: Substitution[], extraAbsent: Id[]): DayState | null {
  const day = dayIndexOf(college.calendar, date)
  const classes = classesOn(college, timetable, date, subs)
  if (day === null || classes.length === 0) return null
  const busy = new Map<Id, Set<number>>()
  for (const c of classes) {
    if (!c.teacherId) continue
    const s = busy.get(c.teacherId) ?? new Set<number>()
    for (let i = 0; i < c.placement.length; i++) s.add(c.placement.period + i)
    busy.set(c.teacherId, s)
  }
  const absent = new Set<Id>([
    ...college.leaves.filter((l) => l.status === 'approved' && l.date === date).map((l) => l.teacherId),
    ...extraAbsent,
  ])
  return { day, busy, absent }
}

/** Free teachers for one class on one date, best first. Never breaks availability, daily limit or lunch. */
export function substituteCandidates(college: CollegeData, placement: Placement, state: DayState): Candidate[] {
  const cal = college.calendar
  const a = college.assignments.find((x) => x.id === placement.assignmentId)!
  const section = college.sections.find((s) => s.id === a.sectionId)!
  const subject = college.subjects.find((s) => s.id === a.subjectId)!
  const block = Array.from({ length: placement.length }, (_, i) => placement.period + i)
  const lunchNeed = Math.min(cal.teacherMinFreeInLunchWindow, cal.lunchWindow.length)

  const teachesSubject = new Set(
    college.assignments
      .filter((x) => college.subjects.find((s) => s.id === x.subjectId)?.code === subject.code && x.teacherId)
      .map((x) => x.teacherId!),
  )
  const teachesSection = new Set(college.assignments.filter((x) => x.sectionId === section.id && x.teacherId).map((x) => x.teacherId!))

  const out: Candidate[] = []
  for (const t of college.teachers) {
    if (state.absent.has(t.id)) continue
    const busy = state.busy.get(t.id) ?? new Set<number>()
    if (block.some((p) => busy.has(p) || t.unavailable.includes(slotKey(state.day, p)))) continue
    if (busy.size + block.length > t.maxPerDay) continue
    if (lunchNeed > 0 && busy.size > 0) {
      const free = cal.lunchWindow.filter((p) => !busy.has(p) && !block.includes(p)).length
      if (free < lunchNeed) continue
    }
    const sameDept = t.deptId === section.deptId
    const sameSubject = teachesSubject.has(t.id)
    const knowsSection = teachesSection.has(t.id)
    const score = (sameDept ? 1000 : 0) + (sameSubject ? 100 : 0) + (knowsSection ? 10 : 0) - busy.size
    const note = [
      sameDept ? 'Same department' : 'Other department',
      sameSubject ? `teaches ${subject.code}` : null,
      knowsSection ? `already teaches ${section.name}` : null,
      `${busy.size} ${busy.size === 1 ? 'period' : 'periods'} that day`,
    ]
      .filter(Boolean)
      .join(' · ')
    out.push({ teacherId: t.id, score, note })
  }
  return out.sort((x, y) => y.score - x.score || x.teacherId.localeCompare(y.teacherId))
}

/**
 * Ranked free teachers for one class on one date, given that date's other substitutions (the class's own
 * substitution must be left out of `subs`, so its current substitute counts as free).
 */
export function coverCandidates(college: CollegeData, timetable: Timetable, date: string, placement: Placement, subs: Substitution[]): Candidate[] {
  const state = dayState(college, timetable, date, subs, [])
  return state ? substituteCandidates(college, placement, state) : []
}

/**
 * Auto-allot cover for an approved leave: one Substitution per class the teacher had that date.
 * Returns [] when the date has no classes (holiday, weekend, outside the semester).
 */
export function planLeaveCover(
  college: CollegeData,
  timetable: Timetable,
  leave: Pick<LeaveRequest, 'id' | 'teacherId' | 'date'>,
  existing: Substitution[] = [],
): Substitution[] {
  const state = dayState(college, timetable, leave.date, existing, [leave.teacherId])
  if (!state) return []
  const teacherOf = new Map(college.assignments.map((x) => [x.id, x.teacherId]))
  const mine = classesOn(college, timetable, leave.date, existing).filter(
    (c) => teacherOf.get(c.placement.assignmentId) === leave.teacherId && !c.substitution,
  )
  const name = (id: Id) => college.teachers.find((t) => t.id === id)?.name ?? id
  const at = (p: Placement) => `${college.calendar.days[p.day]} P${p.period + 1}`

  return mine.map(({ placement }, i) => {
    const [best] = substituteCandidates(college, placement, state)
    if (best) {
      const s = state.busy.get(best.teacherId) ?? new Set<number>()
      for (let k = 0; k < placement.length; k++) s.add(placement.period + k)
      state.busy.set(best.teacherId, s)
    }
    return {
      id: `${leave.id}-${i + 1}`,
      collegeId: college.college.id,
      date: leave.date,
      leaveId: leave.id,
      assignmentId: placement.assignmentId,
      day: placement.day,
      period: placement.period,
      originalTeacherId: leave.teacherId,
      substituteTeacherId: best?.teacherId ?? null,
      status: best ? 'suggested' : 'uncovered',
      note: best
        ? `${name(best.teacherId)} — ${best.note}`
        : `No free teacher at ${at(placement)}. Consider moving the class to a free slot this week.`,
    } satisfies Substitution
  })
}

/**
 * Check one date's adjusted timetable with the independent validator: covered classes are re-assigned to
 * their substitute, uncovered ones are left out (they need HOD action), absent teachers count as on leave.
 */
export function validateDate(college: CollegeData, timetable: Timetable, date: string, subs: Substitution[]): Conflict[] {
  const day = dayIndexOf(college.calendar, date)
  if (day === null) return []
  const classes = classesOn(college, timetable, date, subs)
  const uncovered = new Set(
    subs.filter((s) => s.date === date && s.status === 'uncovered').map((s) => `${s.assignmentId}|${s.period}`),
  )
  const assignments = [...college.assignments]
  const placements: Placement[] = []
  for (const c of classes) {
    if (uncovered.has(`${c.placement.assignmentId}|${c.placement.period}`)) continue
    if (c.substitution) {
      const original = college.assignments.find((x) => x.id === c.placement.assignmentId)!
      const id = `${original.id}@${date}@${c.placement.period}`
      assignments.push({ ...original, id, teacherId: c.teacherId })
      placements.push({ ...c.placement, assignmentId: id })
    } else {
      placements.push(c.placement)
    }
  }
  const leave = college.leaves
    .filter((l) => l.status === 'approved' && l.date === date)
    .map((l) => ({ teacherId: l.teacherId, day }))
  return validate({ ...college, assignments }, { ...timetable, placements }, { leave })
}
