import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { preflight } from '../solver/preflight'
import { solve } from '../solver/solve'
import type { CollegeData } from '../types'
import {
  addRoom,
  addTeacher,
  assignedLoad,
  removeRoom,
  removeTeacher,
  roomProblem,
  setAssignmentTeacher,
  teacherProblem,
  toggleBlocked,
  toggleUnavailable,
  updateRoom,
  updateSection,
  updateTeacher,
} from './edit'

const [diet] = buildDemoColleges()

describe('college setup edits', () => {
  it('rooms: add with a unique id, owner falls back to shared, edit, remove drops its grants', () => {
    const c = addRoom(diet, { name: 'LT-999', type: 'lecture', capacity: 80, owner: 'nope' })
    const r = c.rooms.at(-1)!
    expect(r).toMatchObject({ id: 'diet-rm-lt-999', name: 'LT-999', owner: 'shared', collegeId: 'diet' })
    const twin = addRoom(c, { name: 'LT 999', type: 'lab', capacity: 30, owner: 'diet-cse' }).rooms.at(-1)!
    expect(twin.id).toBe('diet-rm-lt-999-2') // same slug → next free id
    expect(roomProblem(c, 'lt-999')).toMatch(/already exists/)
    expect(roomProblem(c, 'LT-999', r.id)).toBeNull() // renaming to itself is fine
    expect(updateRoom(c, r.id, { capacity: 0, owner: 'diet-cse' }).rooms.at(-1)).toMatchObject({ capacity: 1, owner: 'diet-cse' })
    const granted: CollegeData = { ...c, grants: [{ id: 'g1', collegeId: 'diet', roomId: r.id, fromDeptId: 'diet-cse', toDeptId: 'diet-me', slots: 'all', status: 'approved' }] }
    expect(removeRoom(granted, r.id).grants).toEqual([])
  })

  it('teachers: add, limits clamped to the day, unavailable slots toggle, remove frees their classes', () => {
    const c = addTeacher(diet, { name: 'Dr. New', deptId: 'diet-ece', maxPerDay: 20, maxPerWeek: 99 })
    const t = c.teachers.at(-1)!
    expect(t).toMatchObject({ id: 'diet-t-dr-new', deptId: 'diet-ece', maxPerDay: 7, unavailable: [] })
    expect(teacherProblem(c, 'dr. new')).toMatch(/already a teacher/)
    const off = toggleUnavailable(toggleUnavailable(c, t.id, '0-1'), t.id, '2-3')
    expect(off.teachers.at(-1)!.unavailable).toEqual(['0-1', '2-3'])
    expect(toggleUnavailable(off, t.id, '0-1').teachers.at(-1)!.unavailable).toEqual(['2-3'])
    expect(updateTeacher(c, t.id, { maxPerDay: 3, name: '  ' }).teachers.at(-1)).toMatchObject({ maxPerDay: 3, name: 'Dr. New' })
    const victim = diet.teachers[0]
    const gone = removeTeacher(diet, victim.id)
    expect(gone.teachers.some((x) => x.id === victim.id)).toBe(false)
    expect(gone.assignments.some((a) => a.teacherId === victim.id)).toBe(false)
    expect(preflight(gone).some((w) => w.code === 'no-teacher')).toBe(true)
  })

  it('who teaches what: set and clear a teacher; unknown teacher ignored; load follows', () => {
    const a = diet.assignments[0]
    const other = diet.teachers.find((t) => t.id !== a.teacherId)!
    const before = assignedLoad(diet).get(other.id) ?? 0
    const c = setAssignmentTeacher(diet, a.id, other.id)
    expect(c.assignments[0].teacherId).toBe(other.id)
    const periods = diet.subjects.find((s) => s.id === a.subjectId)!.periodsPerWeek
    expect(assignedLoad(c).get(other.id)).toBe(before + periods)
    expect(setAssignmentTeacher(diet, a.id, null).assignments[0].teacherId).toBeNull()
    expect(setAssignmentTeacher(diet, a.id, 'dcas-t-x').assignments[0].teacherId).toBe(a.teacherId)
  })

  it('sections: rename and strength; blocked slots toggle and the solver respects them', () => {
    const s = diet.sections[0]
    expect(updateSection(diet, s.id, { name: 'CSE Alpha', strength: 0 }).sections[0]).toMatchObject({ name: 'CSE Alpha', strength: 1 })
    const blocked = toggleBlocked(toggleBlocked(diet, '4-0'), '4-1')
    expect(blocked.calendar.blockedSlots).toEqual(['4-0', '4-1'])
    const t = solve(blocked, { seed: 1 })
    expect(t.placements.some((p) => p.day === 4 && p.period < 2)).toBe(false)
    expect(toggleBlocked(blocked, '4-0').calendar.blockedSlots).toEqual(['4-1'])
  })

  it('setup edits mark a stored draft stale', () => {
    const withDraft: CollegeData = { ...diet, draft: solve(diet, { seed: 1 }) }
    expect(toggleBlocked(withDraft, '0-0').draftStale).toBe(true)
    expect(setAssignmentTeacher(withDraft, diet.assignments[0].id, null).draftStale).toBe(true)
    expect(addRoom(withDraft, { name: 'R', type: 'lab', capacity: 10, owner: 'shared' }).draftStale).toBe(true)
  })
})
