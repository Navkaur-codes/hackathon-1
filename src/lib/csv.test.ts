import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import { solve } from '../solver/solve'
import { validate } from '../solver/validate'
import { applyAssignments, applyRooms, applyTeachers, limitToDept, parseAssignments, parseRooms, parseTeachers } from './csv'
import { addDepartment, addProgramme, addSubject, newCollege } from './edit'

const [diet, dcas] = buildDemoColleges()

describe('T4.1 paste from Excel', () => {
  it('teachers: tab-separated with a header, defaults for empty limits, department by code or name', () => {
    const text = 'Name\tDept\tMax/day\tMax/week\nDr. Asha Rani\tCSE\t3\t12\nProf. Vik Sood\tMechanical Engineering\t\t\n'
    const r = parseTeachers(text, diet)
    expect(r.errors).toEqual([])
    expect(r.rows.map((x) => x.value)).toEqual([
      { name: 'Dr. Asha Rani', deptId: 'diet-cse', maxPerDay: 3, maxPerWeek: 12 },
      { name: 'Prof. Vik Sood', deptId: 'diet-me', maxPerDay: 4, maxPerWeek: 16 },
    ])
    expect(r.rows.map((x) => x.line)).toEqual([2, 3])
  })

  it('teachers: bad rows are reported with their line, good rows still parse', () => {
    const existing = diet.teachers[0].name
    const text = ['New One, CSE, 4, 16', `${existing}, CSE`, 'Somebody, COM, 4, 16', ', CSE', 'Too Busy, ECE, 99', 'New One, ECE'].join('\n')
    const r = parseTeachers(text, diet)
    expect(r.rows.map((x) => x.value.name)).toEqual(['New One'])
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 4, 5, 6])
    expect(r.errors[0].message).toMatch(/already a teacher/)
    // COM is a department of DCAS, not DIET — names never resolve across colleges
    expect(r.errors[1].message).toMatch(/No department "COM" in DIET/)
    expect(r.errors[3].message).toMatch(/1 to 7/)
    expect(r.errors[4].message).toMatch(/already a teacher/) // duplicate inside the same paste
  })

  it('rooms: type words, seats, owner by department or shared', () => {
    const text = 'Room\tType\tSeats\tOwner\nLT-401\tLecture room\t70\tCSE\nCL-9\tlaboratory\t40\t\nHall B\tAuditorium\t200\tshared\nX\tgarden\t10\t\nY\tlab\tmany\t\nZ\tlab\t30\tCOM'
    const r = parseRooms(text, diet)
    expect(r.rows.map((x) => x.value)).toEqual([
      { name: 'LT-401', type: 'lecture', capacity: 70, owner: 'diet-cse' },
      { name: 'CL-9', type: 'lab', capacity: 40, owner: 'shared' },
      { name: 'Hall B', type: 'seminar', capacity: 200, owner: 'shared' },
    ])
    expect(r.errors.map((e) => e.line)).toEqual([5, 6, 7])
  })

  it('assignments: section + subject code of its programme + teacher of this college', () => {
    const section = diet.sections[0]
    const subject = diet.subjects.find((s) => s.programmeId === section.programmeId)!
    const teacher = diet.teachers[3]
    const dcasTeacher = dcas.teachers[0].name
    const text = [`${section.name}\t${subject.code}\t${teacher.name}`, `${section.name}\tNOPE\t${teacher.name}`, `ZZ-Y9-A\t${subject.code}\tX`, `${section.name}\t${subject.code}\t${dcasTeacher}`].join('\n')
    const r = parseAssignments(text, diet)
    expect(r.rows).toHaveLength(1)
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 4])
    const applied = applyAssignments(diet, r.rows.map((x) => x.value))
    expect(applied.assignments.find((a) => a.sectionId === section.id && a.subjectId === subject.id)!.teacherId).toBe(teacher.id)
  })

  it('an HOD paste keeps only rows of their own department', () => {
    const t = limitToDept('teachers', parseTeachers('A One\tCSE\nB Two\tECE\nC Three\tCSE', diet), diet, 'diet-cse')
    expect(t.rows.map((r) => r.value.name)).toEqual(['A One', 'C Three'])
    expect(t.errors).toEqual([{ line: 2, message: 'B Two is in ECE — you can add teachers of CSE only.' }])
    const r = limitToDept('rooms', parseRooms('R1\tlecture\t60\tCSE\nR2\tlecture\t60\t\nR3\tlab\t30\tME', diet), diet, 'diet-cse')
    expect(r.rows.map((x) => x.value.name)).toEqual(['R1'])
    expect(r.errors.map((e) => e.line)).toEqual([2, 3])
    expect(r.errors[0].message).toMatch(/Shared rooms are set up by the College Admin/)
    const cse = diet.sections.find((s) => s.deptId === 'diet-cse')!
    const ece = diet.sections.find((s) => s.deptId === 'diet-ece')!
    const sub = (s: typeof cse) => diet.subjects.find((x) => x.programmeId === s.programmeId)!.code
    const who = parseAssignments(`${cse.name}\t${sub(cse)}\t${diet.teachers[0].name}\n${ece.name}\t${sub(ece)}\t${diet.teachers[0].name}`, diet)
    const a = limitToDept('assignments', who, diet, 'diet-cse')
    expect(a.rows).toHaveLength(1)
    expect(a.errors[0]).toMatchObject({ line: 2, message: expect.stringMatching(/is in ECE/) })
  })

  it('end to end: a blank college shaped and filled only by pasting generates with 0 clashes', () => {
    let c = newCollege('PEC', 'Punjab Engineering College', '2026-11-02')
    c = addDepartment(c, 'CSE', 'Computer Science & Engineering')
    c = addProgramme(c, 'pec-cse', { name: 'B.Tech CSE — Year 2', shortName: 'Y2', sectionsCount: 2, defaultStrength: 60 })
    c = addSubject(c, 'pec-cse-y2', { code: 'DS', name: 'Data Structures', kind: 'theory', periodsPerWeek: 4, roomType: 'lecture' })
    c = addSubject(c, 'pec-cse-y2', { code: 'DSL', name: 'Data Structures Lab', kind: 'lab', periodsPerWeek: 2, roomType: 'lab' })
    const rooms = parseRooms('LT-1\tlecture\t60\tCSE\nLT-2\tlecture\t60\tCSE\nCSE Lab\tlab\t60\tCSE', c)
    c = applyRooms(c, rooms.rows.map((r) => r.value))
    const teachers = parseTeachers('Dr. Kaur\tCSE\t4\t16\nProf. Gill\tCSE\t4\t16', c)
    c = applyTeachers(c, teachers.rows.map((r) => r.value))
    const who = parseAssignments('CSE-Y2-A\tDS\tDr. Kaur\nCSE-Y2-A\tDSL\tDr. Kaur\nCSE-Y2-B\tDS\tProf. Gill\nCSE-Y2-B\tDSL\tProf. Gill', c)
    expect([...rooms.errors, ...teachers.errors, ...who.errors]).toEqual([])
    c = applyAssignments(c, who.rows.map((r) => r.value))
    expect(c.assignments.every((a) => a.teacherId)).toBe(true)
    const t = solve(c, { seed: 1 })
    expect(validate(c, t)).toEqual([])
    expect(t.unplaced).toEqual([])
  })
})
