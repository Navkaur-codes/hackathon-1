// Clash Court: why one class is allowed where it is. A plain-language checklist of the hard rules,
// computed from the timetable itself (independent of the solver — it must agree with the validator).

import type { HardRule } from '../solver/validate'
import type { CollegeData, Placement, Timetable } from '../types'
import { chosenBreak, periodTimes, sectionBreakSlots, sectionFlexBreaks, slotKey } from './structure'

export type Check = { rule: HardRule; ok: boolean; text: string }

export function explainPlacement(college: CollegeData, timetable: Timetable, p: Placement): Check[] {
  const cal = college.calendar
  const times = periodTimes(cal)
  const a = college.assignments.find((x) => x.id === p.assignmentId)
  if (!a) return [{ rule: 'H12', ok: false, text: 'This class refers to an assignment that no longer exists.' }]
  const section = college.sections.find((s) => s.id === a.sectionId)!
  const subject = college.subjects.find((s) => s.id === a.subjectId)!
  const teacher = college.teachers.find((t) => t.id === a.teacherId)
  const room = college.rooms.find((r) => r.id === p.roomId)
  const block = Array.from({ length: p.length }, (_, i) => p.period + i)
  const when = `${cal.days[p.day]} ${times[p.period]?.start ?? `P${p.period + 1}`}`
  const slotName = (period: number) => `P${period + 1} (${times[period]?.start ?? '?'})`
  const checks: Check[] = []
  const add = (rule: HardRule, ok: boolean, text: string) => checks.push({ rule, ok, text })

  // Everything else happening at the same time on the same day.
  const assignmentOf = new Map(college.assignments.map((x) => [x.id, x]))
  const overlapping = timetable.placements.filter(
    (o) => o !== p && o.day === p.day && o.period < p.period + p.length && p.period < o.period + o.length,
  )
  const nameOf = (o: Placement) => {
    const oa = assignmentOf.get(o.assignmentId)
    const os = college.sections.find((s) => s.id === oa?.sectionId)
    const sub = college.subjects.find((s) => s.id === oa?.subjectId)
    return `${sub?.code ?? '?'} for ${os?.name ?? '?'}`
  }

  // H1 / H2 / H3 — single booking
  if (teacher) {
    const clash = overlapping.filter((o) => assignmentOf.get(o.assignmentId)?.teacherId === teacher.id)
    add('H1', clash.length === 0, clash.length === 0 ? `${teacher.name} has no other class at ${when}.` : `${teacher.name} also teaches ${clash.map(nameOf).join(', ')} at ${when}.`)
  } else {
    add('H12', false, `${subject.name} has no teacher assigned.`)
  }
  const sClash = overlapping.filter((o) => assignmentOf.get(o.assignmentId)?.sectionId === section.id)
  add('H2', sClash.length === 0, sClash.length === 0 ? `${section.name} has no other class at ${when}.` : `${section.name} also has ${sClash.map(nameOf).join(', ')} at ${when}.`)
  if (room) {
    const rClash = overlapping.filter((o) => o.roomId === room.id)
    add('H3', rClash.length === 0, rClash.length === 0 ? `${room.name} is free for this class.` : `${room.name} is also booked for ${rClash.map(nameOf).join(', ')}.`)

    // H4 / H5 — room fits
    add('H4', room.type === subject.roomType, room.type === subject.roomType ? `${room.name} is a ${room.type} room, as ${subject.name} needs.` : `${subject.name} needs a ${subject.roomType} room but ${room.name} is a ${room.type} room.`)
    add('H5', room.capacity >= section.strength, `${room.name} seats ${room.capacity} ${room.capacity >= section.strength ? '≥' : '<'} ${section.strength} students.`)

    // H11 — ownership
    const deptName = (id: string) => college.departments.find((d) => d.id === id)?.code ?? id
    if (room.owner === 'shared') add('H11', true, `${room.name} is shared by all departments.`)
    else if (room.owner === section.deptId) add('H11', true, `${room.name} belongs to ${deptName(room.owner)}, ${section.name}'s own department.`)
    else {
      const granted = block.every((period) =>
        college.grants.some(
          (g) => g.status === 'approved' && g.roomId === room.id && g.toDeptId === section.deptId && (g.slots === 'all' || g.slots.includes(slotKey(p.day, period))),
        ),
      )
      const allocated = college.grants.some((g) => g.kind === 'allocation' && g.status === 'approved' && g.roomId === room.id && g.toDeptId === section.deptId)
      add(
        'H11',
        granted,
        !granted
          ? `${room.name} belongs to ${deptName(room.owner)} and has not been lent to ${deptName(section.deptId)}.`
          : allocated
            ? `${room.name} belongs to ${deptName(room.owner)}; the College Admin allocated it to ${deptName(section.deptId)} for the semester.`
            : `${room.name} is borrowed from ${deptName(room.owner)} through an approved loan.`,
      )
    }
  } else {
    add('H12', false, 'This class is in a room that no longer exists.')
  }

  // H6 — availability
  if (teacher) {
    const off = block.filter((period) => teacher.unavailable.includes(slotKey(p.day, period)))
    add('H6', off.length === 0, off.length === 0 ? `${teacher.name} is available then.` : `${teacher.name} is unavailable at ${off.map(slotName).join(', ')}.`)
  }

  // H7 / H8 — breaks, blocked slots, block shape
  const breaks = sectionBreakSlots(college, section)
  const inBreak = block.filter((period) => breaks.has(slotKey(p.day, period)) || cal.blockedSlots.includes(slotKey(p.day, period)))
  const ownBreaks = [...breaks].filter((k) => k.startsWith(`${p.day}-`)).map((k) => slotName(Number(k.split('-')[1])))
  add(
    'H7',
    inBreak.length === 0,
    inBreak.length === 0
      ? `Not in ${section.name}'s break${ownBreaks.length ? ` (${cal.days[p.day]}: ${ownBreaks.join(', ')})` : ''}.`
      : `${slotName(inBreak[0])} is ${section.name}'s break or a blocked slot.`,
  )
  // flexible break: one option must stay free that day; say where it landed and why
  const flexToday = sectionFlexBreaks(college, section).filter((f) => f.day === p.day)
  if (flexToday.length) {
    const sectionToday = timetable.placements.filter((o) => o.day === p.day && assignmentOf.get(o.assignmentId)?.sectionId === section.id)
    const holder = (period: number) => sectionToday.find((o) => o.period <= period && period < o.period + o.length)
    for (const f of flexToday) {
      const what = f.label ?? 'Break'
      const free = f.options.filter((period) => !holder(period))
      if (free.length === 0) {
        add('H7', false, `${section.name} has no ${what.toLowerCase()} on ${cal.days[p.day]} — ${f.options.map(slotName).join(' and ')} are all taken.`)
        continue
      }
      const chosen = chosenBreak(f, (period) => !!holder(period))
      const moved = holder(f.preferred)
      add(
        'H7',
        true,
        moved
          ? `${what} on ${cal.days[p.day]} is at ${slotName(chosen)} — ${slotName(f.preferred)} is taken by ${nameOf(moved)}.`
          : `${what} on ${cal.days[p.day]} stays at ${slotName(chosen)}.`,
      )
    }
  }
  const blockLength = subject.blockLength ?? cal.labBlockLength
  const fitsDay = p.period + p.length <= cal.periodsPerDay
  if (subject.kind === 'lab')
    add('H8', fitsDay && p.length <= blockLength, `${p.length} consecutive periods, ${fitsDay ? 'within the day' : 'running past the end of the day'}.`)
  else add('H8', p.length === 1 && fitsDay, p.length === 1 ? 'A single period, as theory classes are.' : `A theory class should take one period, not ${p.length}.`)

  // H9 — teacher limits; H14 — lunch
  if (teacher) {
    const mine = timetable.placements.filter((o) => assignmentOf.get(o.assignmentId)?.teacherId === teacher.id)
    const today = new Set(mine.filter((o) => o.day === p.day).flatMap((o) => Array.from({ length: o.length }, (_, i) => o.period + i)))
    const week = mine.reduce((s, o) => s + o.length, 0)
    add('H9', today.size <= teacher.maxPerDay, `${teacher.name} teaches ${today.size} of max ${teacher.maxPerDay} periods on ${cal.days[p.day]}.`)
    add('H9', week <= teacher.maxPerWeek, `${teacher.name} teaches ${week} of max ${teacher.maxPerWeek} periods this week.`)
    const need = Math.min(cal.teacherMinFreeInLunchWindow, cal.lunchWindow.length)
    if (need > 0) {
      const free = cal.lunchWindow.filter((period) => !today.has(period))
      add('H14', free.length >= need, free.length >= need ? `${teacher.name} keeps ${free.map(slotName).join(' / ')} free for lunch on ${cal.days[p.day]}.` : `${teacher.name} has no lunch break on ${cal.days[p.day]}.`)
    }
  }

  return checks
}
