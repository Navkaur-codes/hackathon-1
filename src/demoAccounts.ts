// Demo sign-in accounts, built from whatever colleges exist (rule G3: the demo is only a seed through the same
// path as user accounts — `createUser`). Every account gets the same demo password, shown on the login page.

import { createUser, type NewUser } from './lib/auth'
import { slug } from './lib/structure'
import type { CollegeData, User } from './types'

export const DEMO_PASSWORD = 'kaalchakra'

/** Accounts for a set of colleges: the Super Admin, then per college its admin, one HOD per department, every teacher and one account per section. */
export function demoAccountInputs(colleges: CollegeData[]): NewUser[] {
  const out: NewUser[] = [{ username: 'super', displayName: 'Super Admin', password: DEMO_PASSWORD, role: 'superAdmin' }]
  for (const c of colleges) {
    const code = slug(c.college.code).replace(/-/g, '')
    const id = c.college.id
    out.push({ username: `${code}.admin`, displayName: `${c.college.code} College Admin`, password: DEMO_PASSWORD, role: 'collegeAdmin', collegeId: id })
    for (const d of c.departments)
      out.push({ username: `${code}.${slug(d.code)}.hod`, displayName: `HOD ${d.code}`, password: DEMO_PASSWORD, role: 'deptAdmin', collegeId: id, deptId: d.id })
    const taken = new Set<string>()
    for (const t of c.teachers) {
      const parts = t.name.replace(/\b(dr|prof|ms|mr|mrs)\.?\s+/gi, '').split(/\s+/)
      let name = `${code}.${slug(parts.at(-1) ?? t.id)}`
      if (taken.has(name)) name = `${code}.${slug(parts[0] ?? '')}.${slug(parts.at(-1) ?? '')}`
      taken.add(name)
      out.push({ username: name.slice(0, 32), displayName: t.name, password: DEMO_PASSWORD, role: 'teacher', collegeId: id, teacherId: t.id })
    }
    for (const s of c.sections) out.push({ username: `${code}.${slug(s.name)}`.slice(0, 32), displayName: `${s.name} students`, password: DEMO_PASSWORD, role: 'student', collegeId: id, sectionId: s.id })
  }
  return out
}

/** Build the demo accounts (hashing is async). Inputs that clash with an existing username are skipped. */
export async function buildDemoAccounts(colleges: CollegeData[], now: string, existing: User[] = []): Promise<User[]> {
  let users = existing
  for (const input of demoAccountInputs(colleges)) {
    const r = await createUser(users, colleges, input, 'system', now)
    if (r.ok) users = r.users
  }
  return users
}
