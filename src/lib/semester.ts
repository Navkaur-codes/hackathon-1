// The semester view of a timetable (rule G6): one weekly pattern, rolled out over every real date of the
// semester. Holidays and no-class dates are skipped; leave only changes the dates it covers.

import type { Calendar, CollegeData, Id, Placement, Substitution, Timetable } from '../types'

const DAY_MS = 86_400_000
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`)
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** Weekday (0 = Sunday … 6 = Saturday) of an ISO date. */
export const weekdayOf = (iso: string) => new Date(toMs(iso)).getUTCDay()

/** Index of the date's weekday in the college pattern, or null if the college does not work that weekday. */
export function dayIndexOf(calendar: Pick<Calendar, 'weekdays'>, iso: string): number | null {
  const i = calendar.weekdays.indexOf(weekdayOf(iso))
  return i === -1 ? null : i
}

export type SemesterDate = {
  date: string
  weekday: number
  /** Pattern day index, null on non-working weekdays. */
  day: number | null
  status: 'teaching' | 'holiday' | 'noClass' | 'off'
  label?: string
}

/** Every calendar date of the semester with what kind of day it is. */
export function semesterDates(college: Pick<CollegeData, 'calendar' | 'semester'>): SemesterDate[] {
  const { semester, calendar } = college
  const holidays = new Map(semester.holidays.map((h) => [h.date, h.label]))
  const noClass = new Map(semester.noClassDates.map((h) => [h.date, h.label]))
  const out: SemesterDate[] = []
  for (let t = toMs(semester.startDate); t <= toMs(semester.endDate); t += DAY_MS) {
    const date = toIso(t)
    const weekday = new Date(t).getUTCDay()
    const day = dayIndexOf(calendar, date)
    if (day === null) out.push({ date, weekday, day, status: 'off' })
    else if (holidays.has(date)) out.push({ date, weekday, day, status: 'holiday', label: holidays.get(date) })
    else if (noClass.has(date)) out.push({ date, weekday, day, status: 'noClass', label: noClass.get(date) })
    else out.push({ date, weekday, day, status: 'teaching' })
  }
  return out
}

export function semesterSummary(college: Pick<CollegeData, 'calendar' | 'semester'>) {
  const dates = semesterDates(college)
  return {
    name: college.semester.name,
    startDate: college.semester.startDate,
    endDate: college.semester.endDate,
    weeks: Math.ceil(dates.length / 7),
    teachingDays: dates.filter((d) => d.status === 'teaching').length,
    /** Holidays that fall on working days (weekend holidays cost nothing). */
    holidaysOnWorkingDays: dates.filter((d) => d.status === 'holiday').length,
    noClassDays: dates.filter((d) => d.status === 'noClass').length,
  }
}

/** How many times each pattern day actually happens as a teaching date this semester. */
export function teachingDayCounts(college: Pick<CollegeData, 'calendar' | 'semester'>): number[] {
  const counts = college.calendar.days.map(() => 0)
  for (const d of semesterDates(college)) if (d.status === 'teaching' && d.day !== null) counts[d.day]++
  return counts
}

export type SubjectDelivery = {
  assignmentId: Id
  periodsPerWeek: number
  /** Periods actually taught over the semester's teaching dates. */
  periods: number
  minutes: number
}

/** Periods and contact hours each assignment gets over the whole semester (holidays reduce them). */
export function semesterDelivery(college: CollegeData, timetable: Timetable): SubjectDelivery[] {
  const counts = teachingDayCounts(college)
  const cal = college.calendar
  const slotMinutes = (p: number) => cal.periodLengths?.[p] ?? cal.periodMinutes
  const byId = new Map<Id, SubjectDelivery>()
  for (const p of timetable.placements) {
    const row = byId.get(p.assignmentId) ?? { assignmentId: p.assignmentId, periodsPerWeek: 0, periods: 0, minutes: 0 }
    const n = counts[p.day] ?? 0
    row.periodsPerWeek += p.length
    row.periods += p.length * n
    for (let i = 0; i < p.length; i++) row.minutes += slotMinutes(p.period + i) * n
    byId.set(p.assignmentId, row)
  }
  return [...byId.values()]
}

export type DatedClass = {
  date: string
  placement: Placement
  /** Teacher actually taking the class on that date. */
  teacherId: Id | null
  substitution?: Substitution
}

/** The classes held on one real date: the pattern for its weekday, with that date's substitutions applied. */
export function classesOn(
  college: Pick<CollegeData, 'calendar' | 'semester' | 'assignments'>,
  timetable: Timetable,
  date: string,
  substitutions: Substitution[] = [],
): DatedClass[] {
  const info = semesterDates({ ...college, semester: { ...college.semester, startDate: date, endDate: date } })[0]
  const inRange = date >= college.semester.startDate && date <= college.semester.endDate
  if (!inRange || !info || info.status !== 'teaching' || info.day === null) return []
  const teacherOf = new Map(college.assignments.map((a) => [a.id, a.teacherId]))
  const subs = substitutions.filter((s) => s.date === date && s.status !== 'uncovered')
  return timetable.placements
    .filter((p) => p.day === info.day)
    .sort((a, b) => a.period - b.period)
    .map((placement) => {
      const substitution = subs.find((s) => s.assignmentId === placement.assignmentId && s.period === placement.period)
      return {
        date,
        placement,
        teacherId: substitution?.substituteTeacherId ?? teacherOf.get(placement.assignmentId) ?? null,
        substitution,
      }
    })
}

/** '2026-07-20' → '20 Jul' (UTC, so the date never shifts with the viewer's time zone). */
export const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
