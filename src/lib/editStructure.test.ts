import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { preflight } from '../solver/preflight'
import { solve } from '../solver/solve'
import { validate } from '../solver/validate'
import type { CollegeData, Timetable } from '../types'
import {
  addDepartment,
  addProgramme,
  addSubject,
  newCollege,
  removeDepartment,
  removeDepartmentProblem,
  removeProgramme,
  removeSubject,
  setBreaks,
  setCalendar,
  setSlotsPerDay,
  setWorkingDays,
  updateProgramme,
  updateSubject,
} from './edit'
import { sectionBreakSlots, sectionFlexBreaks } from './structure'

const [diet, dcas] = buildDemoColleges()
const teacherOf = (c: CollegeData) => new Map(c.assignments.map((a) => [a.id, a.teacherId]))
const solvesClean = (c: CollegeData) => {
  const t = solve(c, { seed: 1 })
  expect(validate(c, t)).toEqual([])
  expect(t.unplaced).toEqual([])
}
const cseY2 = diet.programmes.find((p) => p.id === 'diet-cse-y2')!

describe('T4.5 structure changes regenerate sections and assignments', () => {
  it('more and fewer sections: names follow the pattern, survivors keep their edits, assignments follow', () => {
    const edited: CollegeData = { ...diet, sections: diet.sections.map((s) => (s.id === 'diet-cse-y2-a' ? { ...s, name: 'CSE-Alpha', strength: 61 } : s)) }
    const grown = updateProgramme(edited, cseY2.id, { sectionsCount: 4 })
    const mine = grown.sections.filter((s) => s.programmeId === cseY2.id)
    expect(mine.map((s) => s.name)).toEqual(['CSE-Alpha', 'CSE-Y2-B', 'CSE-Y2-C', 'CSE-Y2-D'])
    expect(mine[0].strength).toBe(61)
    const subjects = grown.subjects.filter((s) => s.programmeId === cseY2.id).length
    expect(grown.assignments.filter((a) => mine.some((s) => s.id === a.sectionId))).toHaveLength(4 * subjects)
    // the new sections' assignments start without a teacher; the old ones keep theirs
    const before = teacherOf(diet)
    for (const a of grown.assignments) if (before.has(a.id)) expect(a.teacherId).toBe(before.get(a.id))
    const shrunk = updateProgramme(grown, cseY2.id, { sectionsCount: 1 })
    expect(shrunk.sections.filter((s) => s.programmeId === cseY2.id).map((s) => s.name)).toEqual(['CSE-Alpha'])
    expect(shrunk.assignments.some((a) => a.sectionId === 'diet-cse-y2-b')).toBe(false)
  })

  it('students per section: every section still at the old default follows, edited ones keep theirs', () => {
    const edited: CollegeData = { ...diet, sections: diet.sections.map((s) => (s.id === 'diet-cse-y2-a' ? { ...s, strength: 61 } : s)) }
    const next = updateProgramme(edited, cseY2.id, { defaultStrength: 40 })
    expect(next.sections.filter((s) => s.programmeId === cseY2.id).map((s) => s.strength)).toEqual([61, 40])
  })

  it('fewer slots a day: breaks, lunch window, blocked and unavailable slots past the end disappear', () => {
    const c = setSlotsPerDay({ ...diet, calendar: { ...diet.calendar, blockedSlots: ['0-6', '1-2'] } }, 5)
    expect(c.calendar.periodsPerDay).toBe(5)
    expect(c.calendar.blockedSlots).toEqual(['1-2'])
    expect(c.teachers.every((t) => t.unavailable.every((k) => Number(k.split('-')[1]) < 5))).toBe(true)
    // ME Year 3's flexible lunch [P4, P5] keeps both options; a 4-slot day would turn it into a fixed P4 lunch
    expect(sectionFlexBreaks(c, c.sections.find((s) => s.name === 'ME-Y3-A')!)[0].options).toEqual([3, 4])
    const four = setSlotsPerDay(diet, 4)
    const me = four.sections.find((s) => s.name === 'ME-Y3-A')!
    expect(sectionFlexBreaks(four, me)).toEqual([])
    expect(sectionBreakSlots(four, me).has('0-3')).toBe(true)
    // ECE's own lunch at P5 is gone in a 4-slot day
    expect(four.departments.find((d) => d.code === 'ECE')!.breaks).toEqual([])
  })

  it('working days follow their weekday: dropping Saturday drops its unavailability; a new day starts empty', () => {
    const noSat = setWorkingDays(diet, [1, 2, 3, 4, 5])
    expect(noSat.calendar.days).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
    expect(noSat.calendar.weekdays).toEqual([1, 2, 3, 4, 5])
    const sharma = noSat.teachers.find((t) => t.name.includes('Sharma'))!
    expect(sharma.unavailable).toEqual([]) // only Saturdays before
    // Wednesday off: Thursday's slots move from index 3 to index 2
    const wedOff = setWorkingDays({ ...dcas, calendar: { ...dcas.calendar, blockedSlots: ['3-1'] } }, [1, 2, 4, 5])
    expect(wedOff.calendar.days).toEqual(['Mon', 'Tue', 'Thu', 'Fri'])
    expect(wedOff.calendar.blockedSlots).toEqual(['2-1'])
    // DCAS's Friday assembly (day 4) is now on day 3
    expect(wedOff.calendar.breaks.find((b) => b.label === 'Friday assembly')!.days).toEqual([3])
    expect(setWorkingDays(dcas, [])).toBe(dcas) // at least one day
  })

  it('a 5-day × 5-slot calendar still solves with 0 conflicts', () => {
    const small = setSlotsPerDay(setWorkingDays(newCollege('TINY', 'Tiny College', '2026-11-02'), [1, 2, 3, 4, 5]), 5)
    expect(small.calendar.periodsPerDay).toBe(5)
    expect(small.calendar.days).toHaveLength(5)
    solvesClean(small)
    solvesClean(setWorkingDays(dcas, [1, 2, 3, 4, 6])) // Saturday instead of Friday
  })

  it('calendar values are clamped', () => {
    const c = setCalendar(diet, { periodMinutes: 1, labBlockLength: 99, lunchWindow: [9, 3, 3, -1] })
    expect(c.calendar.periodMinutes).toBe(5)
    expect(c.calendar.labBlockLength).toBe(7)
    expect(c.calendar.lunchWindow).toEqual([3])
  })
})

describe('T4.9 adding / removing keeps everything else', () => {
  it('add and remove a subject: other assignments and chosen teachers untouched', () => {
    const before = teacherOf(diet)
    const added = addSubject(diet, cseY2.id, { code: 'ai', name: 'Artificial Intelligence', kind: 'theory', periodsPerWeek: 3, roomType: 'lecture' })
    const newOnes = added.assignments.filter((a) => a.subjectId === 'diet-cse-y2-ai')
    expect(newOnes).toHaveLength(diet.sections.filter((s) => s.programmeId === cseY2.id).length)
    expect(newOnes.every((a) => a.teacherId === null)).toBe(true)
    for (const a of added.assignments) if (before.has(a.id)) expect(a.teacherId).toBe(before.get(a.id))
    expect(preflight(added).some((w) => w.code === 'no-teacher')).toBe(true) // the new subject needs a teacher
    const removed = removeSubject(added, 'diet-cse-y2-ai')
    expect(removed.assignments).toEqual(diet.assignments)
  })

  it('subject edits: a theory subject drops its lab block; periods clamped', () => {
    const lab = diet.subjects.find((s) => s.kind === 'lab')!
    const asTheory = updateSubject({ ...diet, subjects: diet.subjects.map((s) => (s.id === lab.id ? { ...s, blockLength: 2 } : s)) }, lab.id, {
      kind: 'theory',
      roomType: 'lecture',
      periodsPerWeek: 99,
    })
    const s = asTheory.subjects.find((x) => x.id === lab.id)!
    expect(s.blockLength).toBeUndefined()
    expect(s.periodsPerWeek).toBe(40)
  })

  it('add a department + programme + subject; remove it again leaves the rest exactly as it was', () => {
    let c = addDepartment(diet, 'civ', 'Civil Engineering')
    expect(c.departments.at(-1)).toMatchObject({ id: 'diet-civ', code: 'CIV', name: 'Civil Engineering' })
    c = addProgramme(c, 'diet-civ', { name: 'B.Tech Civil — Year 2', shortName: 'y2', sectionsCount: 2, defaultStrength: 50 })
    expect(c.sections.filter((s) => s.deptId === 'diet-civ').map((s) => s.name)).toEqual(['CIV-Y2-A', 'CIV-Y2-B'])
    c = addSubject(c, 'diet-civ-y2', { code: 'SM', name: 'Surveying', kind: 'theory', periodsPerWeek: 4, roomType: 'lecture' })
    expect(c.assignments.filter((a) => a.sectionId.startsWith('diet-civ'))).toHaveLength(2)
    const back = removeDepartment(c, 'diet-civ')
    expect(back.departments).toEqual(diet.departments)
    expect(back.sections).toEqual(diet.sections)
    expect(back.subjects).toEqual(diet.subjects)
    expect(back.assignments).toEqual(diet.assignments)
    expect(removeProgramme(addProgramme(diet, 'diet-cse', { name: 'Y4', shortName: 'Y4', sectionsCount: 1, defaultStrength: 30 }), 'diet-cse-y4').sections).toEqual(diet.sections)
  })

  it('a department that still owns teachers or rooms is not removed', () => {
    expect(removeDepartmentProblem(diet, 'diet-cse')).toMatch(/teachers and \d+ rooms/)
    expect(removeDepartment(diet, 'diet-cse')).toBe(diet)
  })

  it('breaks at any level; undefined inherits again', () => {
    const c = setBreaks(diet, 'programme', cseY2.id, [{ period: 2, label: 'Lunch' }])
    const sec = c.sections.find((s) => s.programmeId === cseY2.id)!
    expect([...sectionBreakSlots(c, sec)]).toContain('0-2')
    const back = setBreaks(c, 'programme', cseY2.id, undefined)
    expect(sectionBreakSlots(back, sec)).toEqual(sectionBreakSlots(diet, sec))
  })

  it('every structure edit marks a stored draft stale', () => {
    const draft: Timetable = solve(diet, { seed: 1 })
    const withDraft: CollegeData = { ...diet, draft }
    const edits = [
      (c: CollegeData) => updateProgramme(c, cseY2.id, { sectionsCount: 3 }),
      (c: CollegeData) => setSlotsPerDay(c, 6),
      (c: CollegeData) => setWorkingDays(c, [1, 2, 3, 4, 5]),
      (c: CollegeData) => setCalendar(c, { startTime: '08:30' }),
      (c: CollegeData) => addDepartment(c, 'CIV', 'Civil'),
      (c: CollegeData) => removeSubject(c, c.subjects[0].id),
      (c: CollegeData) => setBreaks(c, 'department', 'diet-ece', undefined),
    ]
    for (const edit of edits) expect(edit(withDraft).draftStale).toBe(true)
    expect(updateProgramme(diet, cseY2.id, { sectionsCount: 3 }).draftStale).toBeUndefined() // nothing to make stale
  })
})
