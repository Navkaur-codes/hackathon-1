// Quality score 0–100 of a weekly pattern, from soft rules S1–S7 (root CLAUDE.md §4).
// Hard rules are not scored — a timetable that breaks one is invalid, not "low quality".

import type { CollegeData, Id, Timetable } from '../types'

export type ScoreParts = {
  /** S1 — a subject's periods spread over different days */
  spread: number
  /** S2 — no theory subject twice in one day for a section */
  sameDay: number
  /** S3 — few idle periods between a teacher's classes */
  teacherGaps: number
  /** S4 — few idle periods in a section's day */
  sectionGaps: number
  /** S5 — teachers' daily loads are even */
  balance: number
  /** S6 — own-department rooms used where one would do */
  ownRooms: number
  /** S7 — labs not pushed to the end of the day */
  lateLabs: number
}

export type Score = { total: number; parts: ScoreParts }

const WEIGHTS: ScoreParts = { spread: 3, sameDay: 3, teacherGaps: 2, sectionGaps: 2, balance: 2, ownRooms: 1, lateLabs: 1 }

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export function score(college: CollegeData, timetable: Timetable): Score {
  const D = college.calendar.days.length
  const P = college.calendar.periodsPerDay
  const assignments = new Map(college.assignments.map((a) => [a.id, a]))
  const subjects = new Map(college.subjects.map((s) => [s.id, s]))
  const sections = new Map(college.sections.map((s) => [s.id, s]))
  const rooms = new Map(college.rooms.map((r) => [r.id, r]))

  const sessionDays = new Map<Id, number[]>() // assignment → day of each session
  const teacherDay = new Map<string, number[]>() // teacher|day → periods
  const sectionDay = new Map<string, number[]>()
  const theoryDay = new Map<string, number>() // assignment|day → theory sessions
  let theorySessions = 0
  let labs = 0
  let lateLabs = 0
  let ownPossible = 0
  let ownUsed = 0

  const push = (m: Map<string, number[]>, k: string, v: number) => m.set(k, [...(m.get(k) ?? []), v])

  for (const p of timetable.placements) {
    const a = assignments.get(p.assignmentId)
    const subject = a && subjects.get(a.subjectId)
    const section = a && sections.get(a.sectionId)
    if (!a || !subject || !section) continue
    sessionDays.set(a.id, [...(sessionDays.get(a.id) ?? []), p.day])
    for (let i = 0; i < p.length; i++) {
      if (a.teacherId) push(teacherDay, `${a.teacherId}|${p.day}`, p.period + i)
      push(sectionDay, `${section.id}|${p.day}`, p.period + i)
    }
    if (subject.kind === 'theory') {
      theorySessions++
      const k = `${a.id}|${p.day}`
      theoryDay.set(k, (theoryDay.get(k) ?? 0) + 1)
    } else {
      labs++
      if (p.period + p.length >= P) lateLabs++
    }
    const ownExists = college.rooms.some(
      (r) => r.owner === section.deptId && r.type === subject.roomType && r.capacity >= section.strength,
    )
    if (ownExists) {
      ownPossible++
      if (rooms.get(p.roomId)?.owner === section.deptId) ownUsed++
    }
  }

  // S1 — distinct days used ÷ days it could have used
  const spreads = [...sessionDays.values()]
    .filter((days) => days.length > 1)
    .map((days) => new Set(days).size / Math.min(days.length, D))
  const spread = spreads.length ? spreads.reduce((s, x) => s + x, 0) / spreads.length : 1

  // S2 — share of theory sessions that are a repeat on the same day
  let repeats = 0
  for (const n of theoryDay.values()) if (n > 1) repeats += n - 1
  const sameDay = theorySessions ? 1 - repeats / theorySessions : 1

  // S3 / S4 — idle periods per taught period
  const gapShare = (m: Map<string, number[]>) => {
    let gaps = 0
    let taught = 0
    for (const ps of m.values()) {
      taught += ps.length
      if (ps.length > 1) gaps += Math.max(...ps) - Math.min(...ps) + 1 - new Set(ps).size
    }
    return taught ? clamp01(1 - gaps / taught) : 1
  }
  const teacherGaps = gapShare(teacherDay)
  const sectionGaps = gapShare(sectionDay)

  // S5 — per teacher, spread between busiest and lightest teaching day, relative to their daily limit
  const perTeacher = new Map<Id, number[]>()
  for (const [k, ps] of teacherDay) {
    const [tid] = k.split('|')
    perTeacher.set(tid, [...(perTeacher.get(tid) ?? []), ps.length])
  }
  const imbalance = [...perTeacher].map(([tid, loads]) => {
    const t = college.teachers.find((x) => x.id === tid)
    return loads.length > 1 && t ? (Math.max(...loads) - Math.min(...loads)) / Math.max(1, t.maxPerDay) : 0
  })
  const balance = imbalance.length ? clamp01(1 - imbalance.reduce((s, x) => s + x, 0) / imbalance.length) : 1

  const parts: ScoreParts = {
    spread: clamp01(spread),
    sameDay: clamp01(sameDay),
    teacherGaps,
    sectionGaps,
    balance,
    ownRooms: ownPossible ? ownUsed / ownPossible : 1,
    lateLabs: labs ? 1 - lateLabs / labs : 1,
  }
  const weightSum = Object.values(WEIGHTS).reduce((s, w) => s + w, 0)
  const weighted = (Object.keys(WEIGHTS) as (keyof ScoreParts)[]).reduce((s, k) => s + WEIGHTS[k] * parts[k], 0)
  return { total: Math.round((100 * weighted) / weightSum), parts }
}
