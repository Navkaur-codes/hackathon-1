import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { solve } from '../solver/solve'
import { validate } from '../solver/validate'
import type { CollegeData } from '../types'
import { cloneCollege, codeProblem, newCollege, setArchived, setCollegeAdmins } from './edit'

const colleges = buildDemoColleges()
const [diet, dcas] = colleges

/** Every `id` of every record list in a college. */
const recordIds = (c: CollegeData) =>
  [c.departments, c.programmes, c.sections, c.subjects, c.teachers, c.rooms, c.assignments].flatMap((list) => list.map((r) => r.id))

/** All references point at records of the same college. */
function refsResolve(c: CollegeData) {
  const has = (list: { id: string }[], id: string | null) => id !== null && list.some((r) => r.id === id)
  for (const p of c.programmes) expect(has(c.departments, p.deptId)).toBe(true)
  for (const s of c.sections) expect(has(c.programmes, s.programmeId) && has(c.departments, s.deptId)).toBe(true)
  for (const s of c.subjects) expect(has(c.programmes, s.programmeId)).toBe(true)
  for (const t of c.teachers) expect(has(c.departments, t.deptId)).toBe(true)
  for (const r of c.rooms) expect(r.owner === 'shared' || has(c.departments, r.owner)).toBe(true)
  for (const a of c.assignments) {
    expect(has(c.sections, a.sectionId) && has(c.subjects, a.subjectId)).toBe(true)
    if (a.teacherId) expect(has(c.teachers, a.teacherId)).toBe(true)
  }
  const id = c.college.id
  for (const list of [c.departments, c.programmes, c.sections, c.subjects, c.teachers, c.rooms, c.assignments])
    for (const r of list) expect(r.collegeId).toBe(id)
  expect(c.calendar.collegeId).toBe(id)
  expect(c.semester.collegeId).toBe(id)
}

function solvesClean(c: CollegeData) {
  const t = solve(c, { seed: 1 })
  expect(validate(c, t)).toEqual([])
  expect(t.unplaced).toEqual([])
}

describe('T4.7 clone and new college', () => {
  it('clone of DIET: every id re-prefixed, refs resolve, nothing shared with the source', () => {
    const clone = cloneCollege(diet, 'GNDEC', 'Guru Nanak Dev Engineering College')
    expect(clone.college).toEqual({ id: 'gndec', code: 'GNDEC', name: 'Guru Nanak Dev Engineering College', status: 'active', collegeAdminIds: [] })
    for (const id of recordIds(clone)) expect(id.startsWith('gndec-')).toBe(true)
    const source = new Set(recordIds(diet))
    expect(recordIds(clone).filter((id) => source.has(id))).toEqual([])
    expect(JSON.stringify(clone)).not.toMatch(/"diet(-|")/)
    refsResolve(clone)
  })

  it('clone keeps the shape (counts, names, chosen teachers) and starts unpublished', () => {
    const clone = cloneCollege(diet, 'GNDEC', 'GNDEC')
    expect(clone.sections.map((s) => s.name)).toEqual(diet.sections.map((s) => s.name))
    expect(clone.teachers.map((t) => t.name)).toEqual(diet.teachers.map((t) => t.name))
    expect(clone.assignments.filter((a) => a.teacherId).length).toBe(diet.assignments.filter((a) => a.teacherId).length)
    expect(clone.calendar.days).toEqual(diet.calendar.days)
    expect(clone.draft).toBeUndefined()
    expect(clone.published).toBeUndefined()
  })

  it('both clones solve with 0 conflicts and 0 unplaced', () => {
    solvesClean(cloneCollege(diet, 'GNDEC', 'x'))
    solvesClean(cloneCollege(dcas, 'PAU', 'x'))
  })

  it('blank template is a complete, solvable college', () => {
    const c = newCollege('NEWC', 'New College', '2026-11-02')
    expect(c.college.id).toBe('newc')
    expect(c.sections).toHaveLength(1)
    expect(c.assignments.every((a) => a.teacherId)).toBe(true)
    expect(c.semester.startDate).toBe('2026-11-02')
    expect(c.semester.endDate).toBe('2027-02-21')
    refsResolve(c)
    solvesClean(c)
  })
})

describe('college codes, archive and admins', () => {
  it('rejects empty, taken, too long or overlapping codes', () => {
    expect(codeProblem('', colleges)).toMatch(/short code/)
    expect(codeProblem('  !! ', colleges)).toMatch(/short code/)
    expect(codeProblem('diet', colleges)).toMatch(/already used/)
    expect(codeProblem('DIET CSE', colleges)).toMatch(/too close/) // slug "diet-cse" would mix with DIET's ids
    expect(codeProblem('averyveryverylongcode', colleges)).toMatch(/12 letters/)
    expect(codeProblem('GNDEC', colleges)).toBeNull()
  })

  it('archive / restore and admin names', () => {
    expect(setArchived(diet, true).college.status).toBe('archived')
    expect(setArchived(setArchived(diet, true), false).college.status).toBe('active')
    expect(setCollegeAdmins(diet, [' Navpreet ', '', 'Navpreet', 'Harjot']).college.collegeAdminIds).toEqual(['Navpreet', 'Harjot'])
  })
})
