import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { solve } from '../solver/solve'
import { fromSearch, isActive, matches, toSearch, type Filters } from './filters'
import { buildGrid } from './gridModel'

const [diet] = buildDemoColleges()
const t = solve(diet, { seed: 1 })
const teacherGrid = buildGrid(diet, t, 'teacher', 'diet-t-gill') // classes in three departments
const sectionGrid = buildGrid(diet, t, 'section', diet.sections[0].id)

describe('T35.5 filters', () => {
  it('no filter matches everything', () => {
    expect(isActive({})).toBe(false)
    expect(sectionGrid.cells.every((c) => matches(c, {}))).toBe(true)
  })

  it('theory / lab', () => {
    const labs = sectionGrid.cells.filter((c) => matches(c, { kind: 'lab' }))
    const theory = sectionGrid.cells.filter((c) => matches(c, { kind: 'theory' }))
    expect(labs.length).toBeGreaterThan(0)
    expect(labs.every((c) => c.lab)).toBe(true)
    expect(labs.length + theory.length).toBe(sectionGrid.cells.length)
  })

  it('department, subject, room type and day', () => {
    expect(teacherGrid.cells.filter((c) => matches(c, { deptId: 'diet-ece' })).every((c) => c.section.deptId === 'diet-ece')).toBe(true)
    expect(sectionGrid.cells.filter((c) => matches(c, { subjectCode: 'DS' })).every((c) => c.subject.code === 'DS')).toBe(true)
    expect(sectionGrid.cells.filter((c) => matches(c, { roomType: 'lab' })).every((c) => c.room?.type === 'lab')).toBe(true)
    const monday = sectionGrid.cells.filter((c) => matches(c, { day: 0 }))
    expect(monday.every((c) => c.day === 0)).toBe(true)
    expect(monday.length).toBe(sectionGrid.cells.filter((c) => c.day === 0).length)
  })

  it('filters combine (AND)', () => {
    const f: Filters = { kind: 'theory', day: 1 }
    for (const c of sectionGrid.cells) expect(matches(c, f)).toBe(!c.lab && c.day === 1)
  })

  it('round-trips through the URL and ignores malformed values', () => {
    const f: Filters = { deptId: 'diet-cse', subjectCode: 'DS', kind: 'lab', roomType: 'lab', day: 0 }
    expect(fromSearch(toSearch(f))).toEqual(f)
    expect(fromSearch('?' + toSearch(f))).toEqual(f)
    expect(toSearch({})).toBe('')
    expect(fromSearch('kind=both&room=garden&day=-1&dept=')).toEqual({})
  })
})
