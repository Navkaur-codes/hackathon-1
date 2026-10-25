// Pre-flight check: capacity maths before solving, so an admin learns about impossible input in plain
// language instead of discovering unplaced classes afterwards. Pure — no solving involved.

import { semesterSummary } from '../lib/semester'
import { sectionBreakSlots, sectionFlexBreaks, slotKey } from '../lib/structure'
import type { CollegeData, Id } from '../types'

export type Warning = {
  level: 'error' | 'warning'
  code:
    | 'semester-dates'
    | 'no-teaching-days'
    | 'no-teacher'
    | 'no-room'
    | 'teacher-week'
    | 'teacher-days'
    | 'section-full'
    | 'lab-block'
    | 'lab-capacity'
  message: string
  suggestion: string
  ids: Id[]
}

export function preflight(college: CollegeData): Warning[] {
  const out: Warning[] = []
  const cal = college.calendar
  const D = cal.days.length
  const P = cal.periodsPerDay
  const subjects = new Map(college.subjects.map((s) => [s.id, s]))
  const sections = new Map(college.sections.map((s) => [s.id, s]))
  const blocked = new Set(cal.blockedSlots)
  const add = (w: Warning) => out.push(w)

  // ── Semester ──────────────────────────────────────────────────────────
  const sem = college.semester
  if (sem.endDate < sem.startDate) {
    add({
      level: 'error',
      code: 'semester-dates',
      message: `The semester ends (${sem.endDate}) before it starts (${sem.startDate}).`,
      suggestion: 'Fix the semester dates.',
      ids: [],
    })
  } else if (semesterSummary(college).teachingDays === 0) {
    add({
      level: 'error',
      code: 'no-teaching-days',
      message: 'The semester has no teaching days (check working days and holidays).',
      suggestion: 'Add working days or remove holidays.',
      ids: [],
    })
  }

  // ── Teachers assigned? (grouped per subject so the list stays short) ──
  const unassigned = new Map<Id, Id[]>()
  for (const a of college.assignments) if (!a.teacherId) unassigned.set(a.subjectId, [...(unassigned.get(a.subjectId) ?? []), a.id])
  for (const [subjectId, ids] of unassigned) {
    const subject = subjects.get(subjectId)!
    add({
      level: 'warning',
      code: 'no-teacher',
      message: `${subject.name} has no teacher for ${ids.length} ${ids.length === 1 ? 'section' : 'sections'}.`,
      suggestion: `Assign a teacher to ${subject.code}.`,
      ids,
    })
  }

  // ── Rooms: right type, big enough, usable by the department ─────────
  for (const a of college.assignments) {
    const subject = subjects.get(a.subjectId)!
    const section = sections.get(a.sectionId)!
    const usable = college.rooms.some(
      (r) =>
        r.type === subject.roomType &&
        r.capacity >= section.strength &&
        (r.owner === 'shared' ||
          r.owner === section.deptId ||
          college.grants.some((g) => g.status === 'approved' && g.roomId === r.id && g.toDeptId === section.deptId)),
    )
    if (!usable)
      add({
        level: 'error',
        code: 'no-room',
        message: `${subject.name} (${section.name}) needs a ${subject.roomType} room for ${section.strength} students that ${section.name}'s department may use.`,
        suggestion: `Add or share a ${subject.roomType} room with at least ${section.strength} seats, or request one through Room Exchange.`,
        ids: [a.id],
      })
  }

  // ── Teacher loads ────────────────────────────────────────────────────
  for (const t of college.teachers) {
    const load = college.assignments
      .filter((a) => a.teacherId === t.id)
      .reduce((sum, a) => sum + (subjects.get(a.subjectId)?.periodsPerWeek ?? 0), 0)
    if (load === 0) continue
    if (load > t.maxPerWeek)
      add({
        level: 'error',
        code: 'teacher-week',
        message: `${t.name} is assigned ${load} periods a week but the limit is ${t.maxPerWeek}.`,
        suggestion: `Raise ${t.name}'s weekly limit or move ${load - t.maxPerWeek} periods to another teacher.`,
        ids: [t.id],
      })
    const workableDays = Array.from({ length: D }, (_, d) => d).filter((d) =>
      Array.from({ length: P }, (_, p) => p).some((p) => !t.unavailable.includes(slotKey(d, p))),
    ).length
    if (load > t.maxPerDay * workableDays)
      add({
        level: 'error',
        code: 'teacher-days',
        message: `${t.name} needs ${load} periods but can teach at most ${t.maxPerDay} × ${workableDays} days = ${t.maxPerDay * workableDays}.`,
        suggestion: `Raise ${t.name}'s daily limit, reduce unavailability, or share the load.`,
        ids: [t.id],
      })
  }

  // ── Sections: enough free slots, and room for each lab block ─────────
  for (const section of college.sections) {
    const closed = new Set([...sectionBreakSlots(college, section), ...blocked])
    // a flexible break still costs one slot each day it applies — whichever option it lands on
    const flex = sectionFlexBreaks(college, section)
    const free = D * P - [...closed].filter((k) => Number(k.split('-')[0]) < D).length - flex.length
    const mine = college.subjects.filter((s) => s.programmeId === section.programmeId)
    const demand = mine.reduce((sum, s) => sum + s.periodsPerWeek, 0)
    if (demand > free)
      add({
        level: 'error',
        code: 'section-full',
        message: `${section.name} needs ${demand} periods a week but has only ${free} free slots.`,
        suggestion: `Add a period or a working day, or reduce ${section.name}'s curriculum.`,
        ids: [section.id],
      })
    // longest run of consecutive non-break slots on any day (a flexible break may land on any of its options)
    let longest = 0
    for (let d = 0; d < D; d++) {
      const today = flex.filter((f) => f.day === d)
      const choices = today.length ? today[0].options : [-1]
      for (const pick of choices) {
        const shut = (p: number) => closed.has(slotKey(d, p)) || p === pick || today.slice(1).some((f) => p === f.preferred)
        let run = 0
        for (let p = 0; p < P; p++) {
          run = shut(p) ? 0 : run + 1
          longest = Math.max(longest, run)
        }
      }
    }
    for (const s of mine.filter((x) => x.kind === 'lab')) {
      const bl = Math.min(s.periodsPerWeek, s.blockLength ?? cal.labBlockLength)
      if (bl > longest)
        add({
          level: 'error',
          code: 'lab-block',
          message: `${s.name} needs ${bl} consecutive periods but ${section.name} never has more than ${longest} in a row.`,
          suggestion: `Shorten the lab block or move ${section.name}'s break.`,
          ids: [section.id, s.id],
        })
    }
  }

  // ── Lab rooms: total lab periods vs lab-room slots in the college ────
  const labDemand = college.assignments.reduce((sum, a) => {
    const s = subjects.get(a.subjectId)!
    return s.roomType === 'lab' ? sum + s.periodsPerWeek : sum
  }, 0)
  const labRooms = college.rooms.filter((r) => r.type === 'lab')
  const labSupply = labRooms.length * (D * P - blocked.size)
  if (labDemand > labSupply)
    add({
      level: 'error',
      code: 'lab-capacity',
      message: `Labs need ${labDemand} room-periods a week but the ${labRooms.length} lab ${labRooms.length === 1 ? 'room offers' : 'rooms offer'} only ${labSupply}.`,
      suggestion: `Add a lab room or reduce lab periods by ${labDemand - labSupply}.`,
      ids: labRooms.map((r) => r.id),
    })
  else if (labRooms.length && labDemand > labSupply * 0.85)
    add({
      level: 'warning',
      code: 'lab-capacity',
      message: `Lab rooms are ${Math.round((labDemand / labSupply) * 100)}% booked — timetabling will be tight.`,
      suggestion: 'Consider another lab room or sharing a department lab.',
      ids: labRooms.map((r) => r.id),
    })

  return out
}
