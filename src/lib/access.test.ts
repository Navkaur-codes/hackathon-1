import { describe, expect, it } from 'vitest'
import { buildDemoColleges } from '../demoData'
import type { CollegeData, Role, Session } from '../types'
import { can, collegeFor, sessionFor, switchableColleges, visibleColleges, type Action } from './access'

const colleges = buildDemoColleges()
const [diet, dcas] = colleges
const ACTIONS: Action[] = ['editStructure', 'editSetup', 'generate', 'publish', 'export', 'viewDraft', 'viewPublished']
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
    for (const a of ['editSetup', 'generate', 'publish', 'export', 'viewDraft', 'viewPublished'] as Action[])
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

  it('HOD, teacher and student read only the published version (until v0.5 / v0.6)', () => {
    for (const role of ['deptAdmin', 'teacher', 'student'] as Role[]) {
      const s: Session = { role, collegeId: diet.college.id }
      expect(ACTIONS.filter((a) => can(s, a, diet.college.id, colleges))).toEqual(['viewPublished'])
    }
  })

  it('no session, unknown college → nothing', () => {
    expect(visibleColleges(null, colleges)).toEqual([])
    expect(can(null, 'viewPublished', diet.college.id, colleges)).toBe(false)
    expect(can({ role: 'collegeAdmin', collegeId: 'nope' }, 'viewPublished', 'nope', colleges)).toBe(false)
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
