import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { solve } from '../solver/solve'
import type { CollegeData } from '../types'
import { assistantScope, type AssistantScope } from './access'
import { parseQuestion } from './askParse'
import { ask, suggestions } from './assistant'
import { freeRooms, occupancy, weekStrip } from './finder'
import { bookableSlots } from './meetings'
import { publish, setDraft } from './publish'
import { periodTimes } from './structure'

const [dietSeed, dcasSeed] = buildDemoColleges()
const pub = (c: CollegeData) => {
  const r = publish(setDraft(c, solve(c, { seed: 1 })), '2026-10-27T10:00:00.000Z')
  if (!r.ok) throw new Error(r.reasons.join())
  return r.college
}
const diet = pub(dietSeed)
const dcas = pub(dcasSeed)
const tt = diet.published!.timetable
const times = periodTimes(diet.calendar)
// Tue 3 Nov 2026, 07:00 local (before classes) unless a test sets the time
const at = (date: string, hhmm = '07:00') => {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = hhmm.split(':').map(Number)
  return new Date(y, m - 1, d, h, min)
}
const NOW = at('2026-11-03')
const admin: AssistantScope = { role: 'admin', collegeId: 'diet' }
const kaur = diet.teachers.find((t) => t.name.includes('Kaur'))!
const section = diet.sections[0]
const student: AssistantScope = { role: 'student', collegeId: 'diet', sectionId: section.id, deptId: section.deptId }
const teacher: AssistantScope = { role: 'teacher', collegeId: 'diet', teacherId: kaur.id, deptId: kaur.deptId }
const hod: AssistantScope = { role: 'hod', collegeId: 'diet', deptId: 'diet-cse' }
const q = (scope: AssistantScope, text: string, now = NOW, c = diet) => ask(c, scope, text, now).answer
const dayOf = (label: string) => diet.calendar.days.indexOf(label)

describe('T8.7 reading the question', () => {
  it('teachers by surname, full name and one typo; no false names', () => {
    expect(parseQuestion(diet, 'is kaur free', NOW).teacher?.id).toBe(kaur.id)
    expect(parseQuestion(diet, 'Is Dr. Harpreet Kaur busy?', NOW).teacher?.id).toBe(kaur.id)
    expect(parseQuestion(diet, 'is Arroa free', NOW).teacher?.name).toMatch(/Arora/)
    expect(parseQuestion(diet, 'will the lab be free', NOW).teacher).toBeUndefined()
  })

  it('sections, rooms, subjects, room types and seats', () => {
    expect(parseQuestion(diet, 'where is cse y2 a now', NOW).section?.id).toBe(section.id)
    expect(parseQuestion(diet, 'is the seminar hall booked', NOW).room?.name).toBe('Seminar Hall')
    expect(parseQuestion(diet, 'LT-101 on monday', NOW).room?.name).toBe('LT-101')
    expect(parseQuestion(diet, 'who teaches dbms', NOW).subject?.code).toBe('DBMS')
    expect(parseQuestion(diet, 'who teaches data structures', NOW).subject?.code).toBe('DS')
    const p = parseQuestion(diet, 'free labs with 60+ seats', NOW)
    expect(p).toMatchObject({ roomType: 'lab', minSeats: 60 })
  })

  it('days, dates and slots come from the calendar', () => {
    expect(parseQuestion(diet, 'tuesday 3rd period', NOW)).toMatchObject({ day: dayOf('Tue'), periods: [2], date: '2026-11-03' })
    expect(parseQuestion(diet, 'Fri p2', NOW)).toMatchObject({ day: dayOf('Fri'), periods: [1] })
    expect(parseQuestion(diet, 'tomorrow at 11:30', NOW)).toMatchObject({ date: '2026-11-04', periods: [times.findIndex((t) => t.start === '11:30')] })
    expect(parseQuestion(diet, 'on 9 Nov', NOW).date).toBe('2026-11-09')
    expect(parseQuestion(diet, 'third period', NOW).periods).toEqual([2])
    const lunchEnd = Math.max(...diet.calendar.lunchWindow)
    expect(parseQuestion(diet, 'friday after lunch', NOW).periods).toEqual(times.filter((t) => t.index > lunchEnd).map((t) => t.index))
    expect(parseQuestion(diet, 'is it free now', at('2026-11-03', '09:10')).periods).toEqual([0])
    // DCAS: another calendar shape (Mon–Fri, 09:30 start)
    expect(parseQuestion(dcas, 'friday 2nd period', NOW)).toMatchObject({ day: dcas.calendar.days.indexOf('Fri'), periods: [1] })
    expect(parseQuestion(dcas, 'saturday', NOW).day).toBeUndefined()
  })
})

describe('T8.1 is X free', () => {
  const strip = weekStrip(diet, occupancy(diet, tt), 'teacher', kaur.id)
  const tue = dayOf('Tue')
  const freeP = strip[tue].findIndex((s) => s === 'free')
  const busyP = strip[tue].findIndex((s) => s === 'busy')

  it('free → yes; busy → no with what and the next free slot', () => {
    expect(q(admin, `Is Kaur free on Tuesday period ${freeP + 1}?`).text).toMatch(/^Yes/)
    const no = q(admin, `Is Kaur free on Tuesday period ${busyP + 1}?`)
    expect(no.text).toMatch(/^No — Dr\. Harpreet Kaur is busy/)
    expect(no.text).toMatch(/Next free: /)
    expect(no.jumps?.[0]).toMatchObject({ view: 'teacher', entityId: kaur.id })
  })

  it('a dated question respects leave and holidays', () => {
    const onLeave = { ...diet, leaves: [{ id: 'L', collegeId: 'diet', teacherId: kaur.id, date: '2026-11-03', day: tue, reason: 'x', status: 'approved' as const }] }
    expect(ask(onLeave, admin, `Is Kaur free tomorrow 1st period?`, at('2026-11-02')).answer.text).toMatch(/on leave/)
    expect(q(admin, 'Is Kaur free on 9 Nov 2nd period?').text).toMatch(/no classes \(Diwali break\)/)
  })

  it('when is X free lists that day', () => {
    const a = q(admin, 'When is Kaur free on Tuesday?')
    expect(a.lines?.[0]).toBe(times.filter((t) => strip[tue][t.index] === 'free').map((t) => t.start).join(' · '))
  })

  it('follow-up "and on Friday?" keeps the teacher and the question', () => {
    const first = ask(diet, admin, `Is Kaur free on Tuesday period ${freeP + 1}?`, NOW)
    const next = ask(diet, admin, 'and on Friday?', NOW, first.context).answer
    expect(next.jumps?.[0]?.entityId).toBe(kaur.id)
    expect(next.text).toMatch(/Fri/)
  })
})

describe('T8.2 where is / my next class', () => {
  const tue = dayOf('Tue')
  const mine = tt.placements.filter((p) => p.day === tue && diet.assignments.find((a) => a.id === p.assignmentId)?.sectionId === section.id).sort((a, b) => a.period - b.period)
  const first = mine[0]
  const subj = diet.subjects.find((s) => s.id === diet.assignments.find((a) => a.id === first.assignmentId)!.subjectId)!
  const room = diet.rooms.find((r) => r.id === first.roomId)!

  it("during the section's first class → that subject and room; before school → its first class next", () => {
    const a = q(admin, `Where is ${section.name} now?`, at('2026-11-03', times[first.period].start))
    expect(a.text).toContain(subj.name)
    expect(a.text).toContain(room.name)
    expect(q(student, "What's my next class?").text).toMatch(new RegExp(`Next: ${subj.name}`))
  })

  it('holiday and after hours', () => {
    expect(q(student, 'what is my next class', at('2026-11-09', '10:00')).text).toMatch(/Diwali/)
    expect(q(student, 'where am I now', at('2026-11-03', '20:00')).text).toMatch(/Done for today/)
  })

  it("a teacher's day lists their classes", () => {
    const a = q(teacher, 'my classes on tuesday')
    const n = tt.placements.filter((p) => p.day === tue && diet.assignments.find((x) => x.id === p.assignmentId)?.teacherId === kaur.id).length
    expect(a.lines ?? []).toHaveLength(n)
  })
})

describe('T8.3 free rooms', () => {
  it('free labs Friday after lunch = exactly the finder list', () => {
    const fri = dayOf('Fri')
    const lunchEnd = Math.max(...diet.calendar.lunchWindow)
    const periods = times.filter((t) => t.index > lunchEnd).map((t) => t.index)
    const expected = freeRooms(diet, occupancy(diet, tt), fri, periods, { type: 'lab' }).map((f) => f.room.name)
    const a = q(admin, 'Which labs are free Friday after lunch?')
    expect((a.lines ?? []).map((l) => l.split(' · ')[0])).toEqual(expected)
    // with seats and no time → asks when
    expect(q(admin, 'free rooms with 70 seats').text).toMatch(/Tell me when/)
  })
})

describe('T8.4 unknown questions', () => {
  it('helpful fallback with three examples for the role', () => {
    const a = q(student, 'what is the meaning of life')
    expect(a.unknown).toBe(true)
    expect(a.lines).toHaveLength(3)
    expect(q(admin, 'help').lines?.length).toBeGreaterThan(2)
  })
})

describe('T8.5 role scope', () => {
  const other = diet.sections.find((s) => s.deptId !== section.deptId)!
  const otherSubjects = diet.subjects.filter((s) => s.programmeId === other.programmeId).map((s) => s.name)

  it('a student is refused admin data and other sections — and nothing leaks', () => {
    for (const text of ['Which labs are free Friday after lunch?', 'Any clashes?', `Where is ${other.name} now?`, 'How many periods does Kaur have?', 'Why is DS not placed?', 'Is the seminar hall booked on Monday?']) {
      const a = q(student, text, at('2026-11-03', '10:00'))
      expect(a.refused, text).toBe(true)
      for (const name of otherSubjects) expect(a.text).not.toContain(name)
    }
    const outsider = diet.teachers.find((t) => t.deptId !== section.deptId && !diet.assignments.some((a) => a.sectionId === section.id && a.teacherId === t.id))!
    expect(q(student, `Is ${surname(outsider.name)} free on Tuesday 2nd period?`).refused).toBe(true)
  })

  it('teachers and HODs stay in their department; the College Admin sees everything', () => {
    expect(q(teacher, 'Any clashes?').refused).toBe(true)
    expect(q(hod, 'Is the ECE Electronics Lab booked on Monday?').refused).toBe(true)
    expect(q(admin, 'Any clashes?').refused).toBeUndefined()
    expect(q(admin, 'Any clashes?').text).toMatch(/No clashes/)
  })

  it('assistantScope follows the session', () => {
    const colleges = [dietSeed, dcasSeed]
    expect(assistantScope({ role: 'student', collegeId: 'diet', sectionId: section.id }, colleges, 'diet')).toMatchObject({ role: 'student', sectionId: section.id })
    expect(assistantScope({ role: 'teacher', collegeId: 'diet', teacherId: kaur.id }, colleges, 'diet')).toMatchObject({ role: 'teacher', deptId: kaur.deptId })
    expect(assistantScope({ role: 'collegeAdmin', collegeId: 'dcas' }, colleges, 'diet')).toBeUndefined()
    expect(assistantScope({ role: 'superAdmin' }, colleges, 'dcas')).toMatchObject({ role: 'super' })
    // teachers / students read only the published version
    expect(q(student, "What's my next class?", NOW, setDraft({ ...diet, published: undefined }, tt)).text).toMatch(/not published/)
  })
})

describe('T8.6 can I meet', () => {
  it('lists the bookable slots tomorrow with request actions', () => {
    const a = q(student, 'Can I meet Kaur tomorrow?')
    const slots = bookableSlots(diet, kaur.id, section.id, '2026-11-04', { today: '2026-11-03', minutes: 7 * 60 })
    expect(a.lines).toHaveLength(slots.length)
    expect(a.actions?.map((x) => x.period)).toEqual(slots.slice(0, 4).map((b) => b.period))
    expect(a.actions?.[0]).toMatchObject({ teacherId: kaur.id, sectionId: section.id, date: '2026-11-04' })
    expect(q(teacher, 'Can I meet Kaur tomorrow?').refused).toBe(true)
  })
})

describe('T8.8 suggested questions always answer', () => {
  it('every chip of every role, on DIET and DCAS, gets a real answer', () => {
    for (const c of [diet, dcas]) {
      const sec = c.sections[0]
      const t = c.teachers.find((x) => c.assignments.some((a) => a.teacherId === x.id))!
      const scopes: AssistantScope[] = [
        { role: 'admin', collegeId: c.college.id },
        { role: 'hod', collegeId: c.college.id, deptId: c.departments[0].id },
        { role: 'teacher', collegeId: c.college.id, teacherId: t.id, deptId: t.deptId },
        { role: 'student', collegeId: c.college.id, sectionId: sec.id, deptId: sec.deptId },
        { role: 'super', collegeId: c.college.id },
      ]
      for (const s of scopes)
        for (const chip of suggestions(c, s)) {
          const a = ask(c, s, chip, at('2026-11-03', '10:00')).answer
          expect(a.unknown, `${c.college.code} ${s.role}: ${chip}`).toBeUndefined()
          expect(a.refused, `${c.college.code} ${s.role}: ${chip} → ${a.text}`).toBeUndefined()
        }
    }
  })
})

function surname(name: string) {
  return name.split(/\s+/).at(-1)!
}
