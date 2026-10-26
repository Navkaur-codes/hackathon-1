import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { planLeaveCover } from '../solver/substitutes'
import { solve } from '../solver/solve'
import type { CollegeData } from '../types'
import { cancelLeave, dayFor, localIso, nowNext, requestLeave, setAccepting, teachingSlots, toggleOfficeHour, weekLoad, type SelfOutcome } from './myDay'
import { publish, setDraft } from './publish'
import { periodTimes, slotKey } from './structure'

const [diet] = buildDemoColleges()
const NOW = '2026-10-27T10:00:00.000Z'
const TODAY = '2026-10-27'
const ok = (r: SelfOutcome) => {
  if (!r.ok) throw new Error(r.reason)
  return r.college
}
const live = (() => {
  const r = publish(setDraft(diet, solve(diet, { seed: 1 })), NOW)
  if (!r.ok) throw new Error(r.reasons.join())
  return r.college
})()
const tt = live.published!.timetable
const teacherOf = new Map(diet.assignments.map((a) => [a.id, a.teacherId]))
const sectionOf = new Map(diet.assignments.map((a) => [a.id, a.sectionId]))
const kaur = diet.teachers.find((t) => t.name.includes('Kaur'))!
const section = diet.sections[0]
// Mon 2 Nov 2026 is a teaching day (pattern day 0 = Mon); 9 Nov is the Diwali break
const MON = '2026-11-02'
const monDay = diet.calendar.weekdays.indexOf(1)
const times = periodTimes(diet.calendar)
const at = (date: string, hhmm: string) => {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = hhmm.split(':').map(Number)
  return new Date(y, m - 1, d, h, min)
}

describe('T6.1 teachers and students read only the published version', () => {
  it('nothing published → nothing shown, even with a draft', () => {
    const draftOnly = setDraft(diet, solve(diet, { seed: 1 }))
    expect(dayFor(draftOnly, MON, { kind: 'teacher', id: kaur.id })).toBeUndefined()
    expect(nowNext(draftOnly, at(MON, '10:00'), { kind: 'section', id: section.id })).toBeUndefined()
    expect(weekLoad(draftOnly, kaur.id)).toBeUndefined()
    expect(teachingSlots(draftOnly, kaur.id).size).toBe(0)
  })

  it('a newer draft never leaks: the day follows the published pattern', () => {
    const newer = setDraft(live, solve(diet, { seed: 7 }))
    expect(newer.draft!.placements).not.toEqual(tt.placements)
    const shown = dayFor(newer, MON, { kind: 'section', id: section.id })!.classes.map((x) => x.placement)
    const expected = tt.placements.filter((p) => p.day === monDay && sectionOf.get(p.assignmentId) === section.id)
    expect(shown).toEqual([...expected].sort((a, b) => a.period - b.period))
  })
})

describe('T6.2 teacher scope', () => {
  it("a teacher's day = exactly their classes of that weekday, in order, with clock times", () => {
    const d = dayFor(live, MON, { kind: 'teacher', id: kaur.id })!
    expect(d.status).toBe('teaching')
    const mine = tt.placements.filter((p) => p.day === monDay && teacherOf.get(p.assignmentId) === kaur.id)
    expect(d.classes.map((x) => x.placement)).toEqual([...mine].sort((a, b) => a.period - b.period))
    expect(d.classes.every((x) => x.kind === 'own' && x.teacher?.id === kaur.id)).toBe(true)
    const first = d.classes[0]
    expect(first.start).toBe(times[first.placement.period].start)
  })

  it('leave cover: the teacher sees their classes covered, the substitute sees a duty, the section sees the substitute', () => {
    const leave = { id: 'L1', teacherId: kaur.id, date: MON }
    const subs = planLeaveCover(live, tt, leave)
    const covered = subs.find((s) => s.substituteTeacherId)!
    expect(covered).toBeDefined()
    const c: CollegeData = { ...live, substitutions: subs }
    const mine = dayFor(c, MON, { kind: 'teacher', id: kaur.id })!
    expect(mine.classes.find((x) => x.placement.period === covered.period)!.kind).toBe('covered')
    const duty = dayFor(c, MON, { kind: 'teacher', id: covered.substituteTeacherId! })!
    const dutyClass = duty.classes.find((x) => x.kind === 'duty')!
    expect(dutyClass.placement.assignmentId).toBe(covered.assignmentId)
    expect(dutyClass.regular?.id).toBe(kaur.id)
    const sec = sectionOf.get(covered.assignmentId)!
    const seen = dayFor(c, MON, { kind: 'section', id: sec })!.classes.find((x) => x.placement.assignmentId === covered.assignmentId)!
    expect(seen.kind).toBe('covered')
    expect(seen.teacher?.id).toBe(covered.substituteTeacherId)
    // another date is untouched
    expect(dayFor(c, '2026-11-16', { kind: 'teacher', id: kaur.id })!.classes.every((x) => x.kind === 'own')).toBe(true)
  })

  it('holidays, no-class days, weekends and dates outside the semester say so', () => {
    expect(dayFor(live, '2026-11-09', { kind: 'teacher', id: kaur.id })).toMatchObject({ status: 'holiday', label: 'Diwali break', classes: [] })
    expect(dayFor(live, '2026-09-21', { kind: 'teacher', id: kaur.id })).toMatchObject({ status: 'noClass', classes: [] })
    expect(dayFor(live, '2026-11-01', { kind: 'teacher', id: kaur.id })).toMatchObject({ status: 'off', classes: [] })
    expect(dayFor(live, '2026-12-14', { kind: 'teacher', id: kaur.id })).toMatchObject({ status: 'outside', classes: [] })
  })

  it('week load counts periods per day (labs by length) against the limits', () => {
    const load = weekLoad(live, kaur.id)!
    const mine = tt.placements.filter((p) => teacherOf.get(p.assignmentId) === kaur.id)
    expect(load.week).toBe(mine.reduce((s, p) => s + p.length, 0))
    expect(load.perDay).toHaveLength(diet.calendar.days.length)
    expect(load.maxPerWeek).toBe(kaur.maxPerWeek)
    expect(load.perDay.every((n) => n <= kaur.maxPerDay)).toBe(true)
  })
})

describe('T6.3 now / next', () => {
  const who = { kind: 'section', id: section.id } as const
  const d = dayFor(live, MON, who)!

  it('before the first slot → before, with the first class next', () => {
    const r = nowNext(live, at(MON, '07:30'), who)!
    expect(r.now.kind).toBe('before')
    expect(r.next?.placement).toEqual(d.classes[0].placement)
  })

  it('during a class → that class until its end, and the following class next', () => {
    const cls = d.classes[0]
    const r = nowNext(live, at(MON, times[cls.placement.period].start), who)!
    expect(r.now).toMatchObject({ kind: 'class', until: cls.end })
    expect(r.next?.placement).toEqual(d.classes[1]?.placement)
  })

  it("in the section's lunch → break with its label", () => {
    const [period, label] = [...d.breaks][0]
    const r = nowNext(live, at(MON, times[period].start), who)!
    expect(r.now).toMatchObject({ kind: 'break', label })
  })

  it('after the last slot → after; on a holiday → no classes', () => {
    expect(nowNext(live, at(MON, '20:00'), who)!.now.kind).toBe('after')
    expect(nowNext(live, at('2026-11-09', '10:00'), who)!.now.kind).toBe('noClasses')
    expect(localIso(at(MON, '23:59'))).toBe(MON)
  })
})

describe('leave requests and office hours', () => {
  const ownDate = (() => {
    // a teaching date on which Dr. Kaur has a class
    const day = tt.placements.find((p) => teacherOf.get(p.assignmentId) === kaur.id)!.day
    return `2026-11-${String(16 + day).padStart(2, '0')}`
  })()
  const freeDay = diet.calendar.days.findIndex((_, d) => !tt.placements.some((p) => p.day === d && teacherOf.get(p.assignmentId) === kaur.id))

  it('a teacher asks for leave on a teaching date with classes; it is pending for the HOD', () => {
    const c = ok(requestLeave(live, kaur.id, ownDate, 'Conference', NOW, TODAY))
    expect(c.leaves.at(-1)).toMatchObject({ teacherId: kaur.id, date: ownDate, status: 'pending', reason: 'Conference', createdAt: NOW })
    // the weekly pattern never changes
    expect(c.published).toBe(live.published)
    expect(requestLeave(c, kaur.id, ownDate, 'Again', NOW, TODAY).ok).toBe(false)
    const back = ok(cancelLeave(c, kaur.id, c.leaves.at(-1)!.id))
    expect(back.leaves).toEqual(live.leaves)
  })

  it('refuses past dates, holidays, outside the semester, days without classes, empty reasons, nothing published', () => {
    const why = (date: string, reason = 'x', c = live) => {
      const r = requestLeave(c, kaur.id, date, reason, NOW, TODAY)
      return r.ok ? 'ok' : r.reason
    }
    expect(why('2026-10-01')).toMatch(/passed/)
    expect(why('2026-11-09')).toMatch(/Diwali/)
    expect(why('2026-12-14')).toMatch(/outside/)
    expect(why(ownDate, '  ')).toMatch(/why/)
    expect(why(ownDate, 'x', diet)).toMatch(/not published/)
    if (freeDay !== -1) expect(why(`2026-11-${String(16 + freeDay).padStart(2, '0')}`)).toMatch(/no classes/)
  })

  it('only the teacher cancels, and only while pending', () => {
    const c = ok(requestLeave(live, kaur.id, ownDate, 'Conference', NOW, TODAY))
    const id = c.leaves.at(-1)!.id
    expect(cancelLeave(c, diet.teachers[1].id, id).ok).toBe(false)
    const decided = { ...c, leaves: c.leaves.map((l) => (l.id === id ? { ...l, status: 'approved' as const } : l)) }
    expect(cancelLeave(decided, kaur.id, id).ok).toBe(false)
  })

  it('office hours: only free, available slots; toggling twice removes; accepting switch', () => {
    const busy = [...teachingSlots(live, kaur.id).keys()][0]
    expect(toggleOfficeHour(live, kaur.id, busy).ok).toBe(false)
    const free = diet.calendar.days.flatMap((_, d) => times.map((t) => slotKey(d, t.index))).find((k) => !teachingSlots(live, kaur.id).has(k) && !kaur.unavailable.includes(k))!
    const c = ok(toggleOfficeHour(live, kaur.id, free))
    expect(c.officeHours.find((o) => o.teacherId === kaur.id)).toMatchObject({ slots: [free], accepting: true, collegeId: diet.college.id })
    const off = ok(setAccepting(c, kaur.id, false))
    expect(off.officeHours.find((o) => o.teacherId === kaur.id)).toMatchObject({ slots: [free], accepting: false })
    expect(ok(toggleOfficeHour(off, kaur.id, free)).officeHours.find((o) => o.teacherId === kaur.id)!.slots).toEqual([])
  })
})
