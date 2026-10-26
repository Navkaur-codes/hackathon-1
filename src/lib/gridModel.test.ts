import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { solve } from '../solver/solve'
import { CELL_INK, contrast, SUBJECT_PALETTE, subjectColor } from './colors'
import { buildGrid, listEntities } from './gridModel'

const [diet, dcas] = buildDemoColleges()
const tDiet = solve(diet, { seed: 1 })
const tDcas = solve(dcas, { seed: 1 })

describe('T3.1 grid model', () => {
  it('rows and columns follow each college calendar', () => {
    const g1 = buildGrid(diet, tDiet, 'section', diet.sections[0].id)
    expect(g1.days).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
    expect(g1.rows).toHaveLength(7)
    expect(g1.rows[0]).toMatchObject({ start: '09:00', end: '09:50' })
    const g2 = buildGrid(dcas, tDcas, 'section', dcas.sections[0].id)
    expect(g2.days).toHaveLength(5)
    expect(g2.rows.map((r) => `${r.start}-${r.end}`)[2]).toBe('11:20-11:50') // 30-minute lunch slot
  })

  it('a section grid has exactly that section’s classes, labs spanning their periods', () => {
    for (const s of diet.sections) {
      const g = buildGrid(diet, tDiet, 'section', s.id)
      const mine = tDiet.placements.filter((p) => diet.assignments.find((a) => a.id === p.assignmentId)!.sectionId === s.id)
      expect(g.cells).toHaveLength(mine.length)
      for (const c of g.cells) expect(c.span).toBe(c.lab ? 2 : 1)
      expect(g.periods).toBe(mine.reduce((sum, p) => sum + p.length, 0))
    }
  })

  it('section break rows come from its own staggered breaks', () => {
    const cse = diet.sections.find((s) => s.name.startsWith('CSE'))!
    const ece = diet.sections.find((s) => s.name.startsWith('ECE'))!
    const lunch = (id: string) => [...new Set(buildGrid(diet, tDiet, 'section', id).breaks.map((b) => `${b.period}:${b.label}`))]
    expect(lunch(cse.id)).toEqual(['3:Lunch'])
    expect(lunch(ece.id)).toEqual(['4:Lunch'])
    // no class ever sits in a hatched break slot
    for (const s of diet.sections) {
      const g = buildGrid(diet, tDiet, 'section', s.id)
      for (const b of g.breaks) expect(g.cells.some((c) => c.day === b.day && b.period >= c.start && b.period < c.start + c.span)).toBe(false)
    }
  })

  it('DCAS Friday has the extra assembly break only on Friday', () => {
    const g = buildGrid(dcas, tDcas, 'section', dcas.sections[0].id)
    expect(g.breaks.filter((b) => b.label === 'Friday assembly')).toEqual([{ day: 4, period: 3, label: 'Friday assembly' }])
  })

  it('a teacher grid includes classes in other departments (cross-department Maths)', () => {
    const g = buildGrid(diet, tDiet, 'teacher', 'diet-t-gill')
    expect(new Set(g.cells.map((c) => c.section.deptId))).toEqual(new Set(['diet-cse', 'diet-ece', 'diet-me']))
    expect(g.cells[0].detail).toMatch(/·/) // section · room
    expect(g.subtitle).toMatch(/up to 4\/day, 18\/week/)
  })

  it('a room grid shows who uses it; shared rooms list several departments', () => {
    const hall = buildGrid(diet, tDiet, 'room', 'diet-rm-seminar-hall')
    // Professional Communication: 2 single periods a week for each Year-3 section of CSE, ECE and ME
    expect(hall.cells).toHaveLength(6)
    expect(new Set(hall.cells.map((c) => c.section.deptId))).toEqual(new Set(['diet-cse', 'diet-ece', 'diet-me']))
    expect(hall.cells[0].detail).toMatch(/Y3.* · Ms\. Simran Walia/)
    expect(hall.subtitle).toBe('seminar · 150 seats · shared by all departments')
  })

  it('every placement appears in exactly one section grid, its teacher grid and its room grid', () => {
    for (const view of ['section', 'teacher', 'room'] as const) {
      const ids = listEntities(diet, view).flatMap((g) => g.items.map((i) => i.id))
      const total = ids.reduce((sum, id) => sum + buildGrid(diet, tDiet, view, id).cells.length, 0)
      expect(total, view).toBe(tDiet.placements.length)
    }
  })

  it('lists entities grouped by department, shared rooms separately', () => {
    const rooms = listEntities(diet, 'room')
    expect(rooms.map((g) => g.group)).toContain('Shared rooms')
    expect(listEntities(diet, 'section').map((g) => g.group)).toEqual([
      'Computer Science & Engineering',
      'Electronics & Communication Engineering',
      'Mechanical Engineering',
    ])
  })
})

describe('T3.2 subject colours', () => {
  it('are deterministic and from the palette', () => {
    expect(subjectColor('DS')).toBe(subjectColor('DS'))
    expect(SUBJECT_PALETTE).toContain(subjectColor('DBMS'))
  })

  it('keep ink text readable (contrast ≥ 4.5:1) on every palette colour', () => {
    for (const c of SUBJECT_PALETTE) expect(contrast(c, CELL_INK), c).toBeGreaterThanOrEqual(4.5)
  })

  it('spread a real curriculum over several colours', () => {
    const codes = [...new Set(diet.subjects.map((s) => s.code))]
    expect(new Set(codes.map(subjectColor)).size).toBeGreaterThanOrEqual(6)
  })
})

describe('listEntities for an HOD', () => {
  it('only the department: its sections, its teachers and anyone teaching its sections, its own + shared rooms', () => {
    const [d] = buildDemoColleges()
    const ids = (v: 'section' | 'teacher' | 'room') => listEntities(d, v, 'diet-ece').flatMap((g) => g.items.map((i) => i.id))
    expect(ids('section').every((id) => d.sections.find((s) => s.id === id)!.deptId === 'diet-ece')).toBe(true)
    const teachers = ids('teacher')
    expect(teachers.some((id) => d.teachers.find((t) => t.id === id)!.deptId !== 'diet-ece')).toBe(true) // shared Maths teacher
    const outsider = d.teachers.find((t) => t.deptId === 'diet-me' && !d.assignments.some((a) => a.teacherId === t.id && a.sectionId.startsWith('diet-ece')))!
    expect(teachers).not.toContain(outsider.id)
    expect(ids('room').every((id) => ['shared', 'diet-ece'].includes(d.rooms.find((r) => r.id === id)!.owner))).toBe(true)
    expect(listEntities(d, 'section').flatMap((g) => g.items)).toHaveLength(d.sections.length) // no scope → all
  })
})
