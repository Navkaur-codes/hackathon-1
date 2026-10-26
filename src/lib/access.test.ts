import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import type { CollegeData, Role, Session } from '../types'
import { can, canDept, collegeFor, deptScope, sessionFor, switchableColleges, studentScope, teacherScope, visibleColleges, type Action, type DeptAction } from './access'

const colleges = buildDemoColleges()
const [diet, dcas] = colleges
const ACTIONS: Action[] = ['editStructure', 'editSetup', 'generate', 'publish', 'export', 'viewDraft', 'viewPublished', 'roomBookings', 'leave']
const ids = (cs: CollegeData[]) => cs.map((c) => c.college.id)
const archive = (c: CollegeData): CollegeData => ({ ...c, college: { ...c.college, status: 'archived' } })

describe('T4.4 college admin scope', () => {
  const admin: Session = { role: 'collegeAdmin', collegeId: dcas.college.id }

  it('sees only its own college', () => {
    expect(ids(visibleColleges(admin, colleges))).toEqual([dcas.college.id])
    expect(collegeFor(admin, colleges, diet.college.id)).toBeUndefined()
    expect(collegeFor(admin, colleges, dcas.college.id)?.college.id).toBe(dcas.college.id)
  })

  it('may set up, generate, publish and export its own college — not structure, not another college', () => {
    for (const a of ['editSetup', 'generate', 'publish', 'export', 'viewDraft', 'viewPublished', 'roomBookings', 'leave'] as Action[])
      expect(can(admin, a, dcas.college.id, colleges)).toBe(true)
    expect(can(admin, 'editStructure', dcas.college.id, colleges)).toBe(false)
    for (const a of ACTIONS) expect(can(admin, a, diet.college.id, colleges)).toBe(false)
  })

  it('loses access when its college is archived', () => {
    const withArchived = [diet, archive(dcas)]
    expect(visibleColleges(admin, withArchived)).toEqual([])
    for (const a of ACTIONS) expect(can(admin, a, dcas.college.id, withArchived)).toBe(false)
  })
})

describe('T4.6 super admin scope and college isolation', () => {
  const sup: Session = { role: 'superAdmin' }

  it('super admin sees every college, archived ones too', () => {
    const withArchived = [diet, archive(dcas)]
    expect(ids(visibleColleges(sup, withArchived))).toEqual([diet.college.id, dcas.college.id])
  })

  it('super admin shapes structure and reads timetables, but never sets up, generates or publishes', () => {
    for (const c of colleges) {
      expect(can(sup, 'editStructure', c.college.id, colleges)).toBe(true)
      expect(can(sup, 'viewDraft', c.college.id, colleges)).toBe(true)
      for (const a of ['editSetup', 'generate', 'publish', 'export'] as Action[]) expect(can(sup, a, c.college.id, colleges)).toBe(false)
    }
  })

  it('no role of college A sees anything of college B', () => {
    for (const role of ['collegeAdmin', 'deptAdmin', 'teacher', 'student'] as Role[]) {
      const s: Session = { role, collegeId: diet.college.id }
      expect(ids(visibleColleges(s, colleges))).toEqual([diet.college.id])
      for (const a of ACTIONS) expect(can(s, a, dcas.college.id, colleges)).toBe(false)
    }
  })

  it('teacher and student read only the published version; an HOD also reads the draft, never publishes', () => {
    for (const role of ['teacher', 'student'] as Role[]) {
      const s: Session = { role, collegeId: diet.college.id }
      expect(ACTIONS.filter((a) => can(s, a, diet.college.id, colleges))).toEqual(['viewPublished'])
    }
    const hod: Session = { role: 'deptAdmin', collegeId: diet.college.id, deptId: 'diet-cse' }
    expect(ACTIONS.filter((a) => can(hod, a, diet.college.id, colleges))).toEqual(['viewDraft', 'viewPublished'])
  })

  it('no session, unknown college → nothing', () => {
    expect(visibleColleges(null, colleges)).toEqual([])
    expect(can(null, 'viewPublished', diet.college.id, colleges)).toBe(false)
    expect(can({ role: 'collegeAdmin', collegeId: 'nope' }, 'viewPublished', 'nope', colleges)).toBe(false)
  })
})

describe('T5.1 HOD scope', () => {
  const DEPT_ACTIONS: DeptAction[] = ['editDept', 'generateDept', 'markReady', 'exchange', 'leave']
  const hod: Session = { role: 'deptAdmin', collegeId: diet.college.id, deptId: 'diet-cse' }

  it('an HOD acts only on their own department', () => {
    expect(deptScope(hod, colleges)).toBe('diet-cse')
    for (const a of DEPT_ACTIONS) {
      expect(canDept(hod, a, 'diet-cse', colleges)).toBe(true)
      expect(canDept(hod, a, 'diet-ece', colleges)).toBe(false)
      expect(canDept(hod, a, dcas.departments[0].id, colleges)).toBe(false) // another college
    }
    // never the college-wide actions
    for (const a of ['editSetup', 'generate', 'publish', 'export', 'editStructure', 'leave'] as Action[]) expect(can(hod, a, diet.college.id, colleges)).toBe(false)
  })

  it('the College Admin may edit and generate any department of their college; Ready and loans stay with HODs', () => {
    const admin: Session = { role: 'collegeAdmin', collegeId: diet.college.id }
    expect(deptScope(admin, colleges)).toBeUndefined()
    for (const d of diet.departments) {
      expect(canDept(admin, 'editDept', d.id, colleges)).toBe(true)
      expect(canDept(admin, 'generateDept', d.id, colleges)).toBe(true)
      expect(canDept(admin, 'markReady', d.id, colleges)).toBe(false)
      expect(canDept(admin, 'exchange', d.id, colleges)).toBe(false)
      // the College Admin decides leave through can(…, 'leave') for the whole college
      expect(canDept(admin, 'leave', d.id, colleges)).toBe(false)
    }
    expect(canDept(admin, 'editDept', dcas.departments[0].id, colleges)).toBe(false)
  })

  it('teachers, students, super admin, no session or a stale department → nothing', () => {
    for (const s of [
      { role: 'teacher', collegeId: diet.college.id, deptId: 'diet-cse' },
      { role: 'student', collegeId: diet.college.id },
      { role: 'superAdmin' },
      null,
    ] as (Session | null)[])
      for (const a of DEPT_ACTIONS) expect(canDept(s, a, 'diet-cse', colleges)).toBe(false)
    const stale: Session = { role: 'deptAdmin', collegeId: diet.college.id, deptId: 'diet-gone' }
    expect(deptScope(stale, colleges)).toBeUndefined()
    expect(canDept(stale, 'editDept', 'diet-gone', colleges)).toBe(false)
  })

  it('entering as HOD picks a department of the college; switching college picks one of the new college', () => {
    expect(sessionFor('deptAdmin', colleges, null)).toEqual({ role: 'deptAdmin', collegeId: diet.college.id, deptId: diet.departments[0].id })
    expect(sessionFor('deptAdmin', colleges, { role: 'collegeAdmin', collegeId: diet.college.id, deptId: 'diet-me' }).deptId).toBe('diet-me')
    expect(sessionFor('deptAdmin', colleges, { role: 'deptAdmin', collegeId: dcas.college.id, deptId: 'diet-me' }).deptId).toBe(dcas.departments[0].id)
    // HOD (ME) → College Admin → HOD comes back to ME
    const admin = sessionFor('collegeAdmin', colleges, { role: 'deptAdmin', collegeId: diet.college.id, deptId: 'diet-me' })
    expect(can(admin, 'publish', diet.college.id, colleges)).toBe(true)
    expect(sessionFor('deptAdmin', colleges, admin).deptId).toBe('diet-me')
  })
})

describe('T6.2 teacher identity', () => {
  it('entering as Teacher picks a teacher of the college and keeps them across role switches', () => {
    const t = sessionFor('teacher', colleges, null)
    expect(t.teacherId).toBe(diet.teachers[0].id)
    expect(teacherScope(t, colleges)).toBe(diet.teachers[0].id)
    const chosen = { ...t, teacherId: diet.teachers[3].id }
    const admin = sessionFor('collegeAdmin', colleges, chosen)
    expect(teacherScope(admin, colleges)).toBeUndefined()
    expect(sessionFor('teacher', colleges, admin).teacherId).toBe(diet.teachers[3].id)
    // switching college picks a teacher of the new college
    expect(sessionFor('teacher', colleges, { ...chosen, collegeId: dcas.college.id }).teacherId).toBe(dcas.teachers[0].id)
  })

  it('a teacher of another college, or a stale teacher, is nobody', () => {
    expect(teacherScope({ role: 'teacher', collegeId: diet.college.id, teacherId: dcas.teachers[0].id }, colleges)).toBeUndefined()
    expect(teacherScope({ role: 'teacher', collegeId: diet.college.id, teacherId: 'diet-t-gone' }, colleges)).toBeUndefined()
    expect(teacherScope({ role: 'deptAdmin', collegeId: diet.college.id, teacherId: diet.teachers[0].id }, colleges)).toBeUndefined()
  })
})

describe('T6.2 student scope', () => {
  it('entering as Student picks a section of the college and keeps it (and the name) across switches', () => {
    const s = sessionFor('student', colleges, null)
    expect(studentScope(s, colleges)).toBe(diet.sections[0].id)
    const chosen = { ...s, sectionId: diet.sections[2].id, studentName: 'Simran' }
    const back = sessionFor('student', colleges, sessionFor('teacher', colleges, chosen))
    expect(back).toMatchObject({ sectionId: diet.sections[2].id, studentName: 'Simran' })
    expect(sessionFor('student', colleges, { ...chosen, collegeId: dcas.college.id }).sectionId).toBe(dcas.sections[0].id)
  })

  it("a student reads only the published version; another college's or a stale section is nobody", () => {
    const s: Session = { role: 'student', collegeId: diet.college.id, sectionId: diet.sections[0].id }
    expect(ACTIONS.filter((a) => can(s, a, diet.college.id, colleges))).toEqual(['viewPublished'])
    expect(studentScope({ ...s, sectionId: dcas.sections[0].id }, colleges)).toBeUndefined()
    expect(studentScope({ ...s, sectionId: 'gone' }, colleges)).toBeUndefined()
    expect(studentScope({ ...s, role: 'teacher' }, colleges)).toBeUndefined()
  })
})

describe('switching role and college', () => {
  it('keeps the current college when still active, else the first active one; super has none', () => {
    expect(sessionFor('superAdmin', colleges, null)).toEqual({ role: 'superAdmin' })
    // super remembers the last college (access ignores it), so College Admin → Super → Teacher stays in DCAS
    const sup = sessionFor('superAdmin', colleges, { role: 'collegeAdmin', collegeId: dcas.college.id })
    expect(ids(visibleColleges(sup, colleges))).toEqual([diet.college.id, dcas.college.id])
    expect(sessionFor('teacher', colleges, sup).collegeId).toBe(dcas.college.id)
    expect(sessionFor('teacher', colleges, { role: 'collegeAdmin', collegeId: dcas.college.id }).collegeId).toBe(dcas.college.id)
    expect(sessionFor('student', colleges, null).collegeId).toBe(diet.college.id)
    const withArchived = [archive(diet), dcas]
    expect(ids(switchableColleges(withArchived))).toEqual([dcas.college.id])
    expect(sessionFor('collegeAdmin', withArchived, { role: 'collegeAdmin', collegeId: diet.college.id }).collegeId).toBe(dcas.college.id)
  })
})
