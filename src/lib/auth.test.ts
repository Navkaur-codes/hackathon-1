import { describe, expect, it } from 'vitest'
import type { StateStorage } from 'zustand/middleware'
import { buildDemoColleges } from '../demoData'
import { buildDemoAccounts, demoAccountInputs, DEMO_PASSWORD } from '../demoAccounts'
import { createKaalStore, STORE_KEY } from '../store'
import type { Session, User } from '../types'
import { can, deptScope, studentScope, teacherScope, visibleColleges } from './access'
import { changePassword, createUser, hashPassword, LOGIN_ERROR, mayManage, resetPassword, sessionOf, setDisabled, usersOf, verifyLogin } from './auth'
import { setArchived } from './edit'

const colleges = buildDemoColleges()
const [diet, dcas] = colleges
const NOW = '2026-10-27T10:00:00.000Z'
const users = await buildDemoAccounts(colleges, NOW)
const byName = (u: string) => users.find((x) => x.username === u)!

describe('T9.2 passwords are stored only as salted hashes', () => {
  it('no hash equals or contains the password; every account has its own salt', () => {
    for (const u of users) {
      expect(u.hash).not.toContain(DEMO_PASSWORD)
      expect(u.hash).toMatch(/^[0-9a-f]{64}$/)
      expect(JSON.stringify(u)).not.toContain(DEMO_PASSWORD)
    }
    expect(new Set(users.map((u) => u.salt)).size).toBe(users.length)
    // same password, different salt → different hash
    expect(new Set(users.map((u) => u.hash)).size).toBe(users.length)
  })

  it('hashing is deterministic for a salt and differs for another salt or password', async () => {
    expect(await hashPassword('secret-one', 'aa')).toBe(await hashPassword('secret-one', 'aa'))
    expect(await hashPassword('secret-one', 'aa')).not.toBe(await hashPassword('secret-one', 'ab'))
    expect(await hashPassword('secret-one', 'aa')).not.toBe(await hashPassword('secret-two', 'aa'))
  })
})

describe('T9.1 sign-in', () => {
  it('right password → the account; wrong password, unknown user, disabled → the same generic refusal', async () => {
    const ok = await verifyLogin(users, 'DIET.Admin ', DEMO_PASSWORD)
    expect(ok.ok && ok.user.role).toBe('collegeAdmin')
    for (const [u, p] of [
      ['diet.admin', 'wrong-password'],
      ['nobody', DEMO_PASSWORD],
      ['diet.admin', ''],
    ])
      expect(await verifyLogin(users, u, p)).toEqual({ ok: false, reason: LOGIN_ERROR })
    const admin: Session = { role: 'collegeAdmin', collegeId: diet.college.id }
    const off = setDisabled(users, admin, byName('diet.kaur').id, true)
    if (!off.ok) throw new Error(off.reason)
    expect(await verifyLogin(off.users, 'diet.kaur', DEMO_PASSWORD)).toEqual({ ok: false, reason: LOGIN_ERROR })
  })
})

describe('T9.3 each demo account opens exactly its own desk', () => {
  it('sessions match the role and links, inside the right college', () => {
    expect(sessionOf(byName('super'), colleges)).toEqual({ role: 'superAdmin' })
    expect(sessionOf(byName('diet.admin'), colleges)).toEqual({ role: 'collegeAdmin', collegeId: diet.college.id })
    const hod = sessionOf(byName('diet.cse.hod'), colleges)!
    expect(deptScope(hod, colleges)).toBe('diet-cse')
    const kaur = sessionOf(byName('diet.kaur'), colleges)!
    expect(teacherScope(kaur, colleges)).toBe(diet.teachers.find((t) => t.name.includes('Kaur'))!.id)
    const stu = sessionOf(byName(`diet.${diet.sections[0].name.toLowerCase()}`), colleges)!
    expect(studentScope(stu, colleges)).toBe(diet.sections[0].id)
    // a DIET account never reaches DCAS
    for (const u of users.filter((x) => x.collegeId === diet.college.id)) {
      const s = sessionOf(u, colleges)!
      expect(visibleColleges(s, colleges).map((c) => c.college.id)).toEqual([diet.college.id])
      expect(can(s, 'viewPublished', dcas.college.id, colleges)).toBe(false)
    }
  })
  it('a role picked on the sign-in page must match the account — refused like a wrong password', async () => {
    expect((await verifyLogin(users, 'super', DEMO_PASSWORD, 'superAdmin')).ok).toBe(true)
    expect((await verifyLogin(users, 'diet.admin', DEMO_PASSWORD, 'collegeAdmin')).ok).toBe(true)
    expect(await verifyLogin(users, 'diet.admin', DEMO_PASSWORD, 'superAdmin')).toEqual({ ok: false, reason: LOGIN_ERROR })
    expect(await verifyLogin(users, 'super', DEMO_PASSWORD, 'collegeAdmin')).toEqual({ ok: false, reason: LOGIN_ERROR })
  })


  it('every demo account signs in; accounts of an archived college or a removed link cannot', () => {
    expect(users).toHaveLength(demoAccountInputs(colleges).length)
    for (const u of users) expect(sessionOf(u, colleges), u.username).toBeDefined()
    const archived = [setArchived(diet, true), dcas]
    expect(sessionOf(byName('diet.admin'), archived)).toBeUndefined()
    const noKaur = [{ ...diet, teachers: diet.teachers.filter((t) => !t.name.includes('Kaur')) }, dcas]
    expect(sessionOf(byName('diet.kaur'), noKaur)).toBeUndefined()
  })
})

describe('T9.5 who may create whom', () => {
  const sup: Session = { role: 'superAdmin' }
  const admin: Session = { role: 'collegeAdmin', collegeId: diet.college.id }
  const base = { displayName: 'New', password: 'long-enough-1' }

  it('Super Admin → College Admins; College Admin → HOD / teacher / section accounts of their own college only', () => {
    expect(mayManage(sup, 'collegeAdmin', dcas.college.id)).toBe(true)
    expect(mayManage(sup, 'teacher', dcas.college.id)).toBe(false)
    expect(mayManage(admin, 'teacher', diet.college.id)).toBe(true)
    expect(mayManage(admin, 'teacher', dcas.college.id)).toBe(false)
    expect(mayManage(admin, 'collegeAdmin', diet.college.id)).toBe(false)
    for (const role of ['deptAdmin', 'teacher', 'student'] as const) expect(mayManage({ role, collegeId: diet.college.id }, 'teacher', diet.college.id)).toBe(false)
  })

  it('links must exist in that college; usernames unique and well-formed; passwords long enough', async () => {
    const t = diet.teachers[2]
    const ok = await createUser(users, colleges, { ...base, username: 'new.teacher', role: 'teacher', collegeId: diet.college.id, teacherId: t.id }, admin, NOW)
    if (!ok.ok) throw new Error(ok.reason)
    expect(ok.user).toMatchObject({ role: 'teacher', collegeId: diet.college.id, teacherId: t.id })
    expect(ok.user).not.toHaveProperty('sectionId')
    const why = async (input: Parameters<typeof createUser>[2], by: Session = admin) => {
      const r = await createUser(ok.users, colleges, input, by, NOW)
      return r.ok ? 'ok' : r.reason
    }
    expect(await why({ ...base, username: 'new.teacher', role: 'teacher', collegeId: diet.college.id, teacherId: t.id })).toMatch(/taken/)
    expect(await why({ ...base, username: 'x', role: 'teacher', collegeId: diet.college.id, teacherId: t.id })).toMatch(/3–32/)
    expect(await why({ ...base, username: 'has space', role: 'teacher', collegeId: diet.college.id, teacherId: t.id })).toMatch(/3–32/)
    expect(await why({ ...base, password: 'short', username: 'ok.name', role: 'teacher', collegeId: diet.college.id, teacherId: t.id })).toMatch(/8 characters/)
    expect(await why({ ...base, username: 'ok.name', role: 'teacher', collegeId: diet.college.id, teacherId: dcas.teachers[0].id })).toMatch(/teacher of this college/)
    expect(await why({ ...base, username: 'ok.name', role: 'teacher', collegeId: dcas.college.id, teacherId: dcas.teachers[0].id })).toMatch(/cannot/)
    expect(await why({ ...base, username: 'ok.name', role: 'deptAdmin', collegeId: diet.college.id, deptId: 'diet-nope' })).toMatch(/department/)
    expect(await why({ ...base, username: 'ok.name', role: 'collegeAdmin', collegeId: dcas.college.id }, sup)).toBe('ok')
    expect(usersOf(ok.users, diet.college.id)[0].role).toBe('collegeAdmin')
  })

  it('change password needs the old one; a reset sets a temporary one that must be changed', async () => {
    const kaur = byName('diet.kaur')
    expect((await changePassword(users, kaur.id, 'wrong', 'new-password-1')).ok).toBe(false)
    const c = await changePassword(users, kaur.id, DEMO_PASSWORD, 'new-password-1')
    if (!c.ok) throw new Error(c.reason)
    expect(c.user.salt).not.toBe(kaur.salt)
    expect((await verifyLogin(c.users, 'diet.kaur', 'new-password-1')).ok).toBe(true)
    expect((await verifyLogin(c.users, 'diet.kaur', DEMO_PASSWORD)).ok).toBe(false)
    const admin2: Session = { role: 'collegeAdmin', collegeId: diet.college.id }
    const r = await resetPassword(c.users, admin2, kaur.id, 'temporary-1')
    if (!r.ok) throw new Error(r.reason)
    expect(r.user.mustChange).toBe(true)
    expect((await resetPassword(c.users, { role: 'collegeAdmin', collegeId: dcas.college.id }, kaur.id, 'temporary-1')).ok).toBe(false)
  })
})

describe('T9.6 store accounts', () => {
  const memory = (): StateStorage & { data: Map<string, string> } => {
    const data = new Map<string, string>()
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) }
  }

  it('first load seeds accounts; sign in opens the session; sign out clears it; accounts persist hashed', async () => {
    const storage = memory()
    const store = createKaalStore(storage)
    await store.getState().ensureAccounts()
    expect(store.getState().users.length).toBe(demoAccountInputs(colleges).length)
    expect(await store.getState().signIn('diet.admin', 'nope-nope')).toBe(LOGIN_ERROR)
    expect(store.getState().session).toBeNull()
    expect(await store.getState().signIn('diet.cse.hod', DEMO_PASSWORD)).toBeNull()
    expect(store.getState().session).toMatchObject({ role: 'deptAdmin', deptId: 'diet-cse' })
    expect(storage.data.get(STORE_KEY)).not.toContain(DEMO_PASSWORD)
    store.getState().signOut()
    expect(store.getState()).toMatchObject({ session: null, userId: null })
    // a reload keeps the accounts (no re-seed)
    const again = createKaalStore(storage)
    expect(again.getState().users.map((u: User) => u.hash)).toEqual(store.getState().users.map((u: User) => u.hash))
  })

  it('a version-1 save keeps its colleges and session and gains the accounts', async () => {
    const storage = memory()
    const edited = [{ ...diet, college: { ...diet.college, name: 'Edited name' } }, dcas]
    storage.setItem(STORE_KEY, JSON.stringify({ state: { colleges: edited, session: { role: 'collegeAdmin', collegeId: 'diet' } }, version: 1 }))
    const store = createKaalStore(storage)
    expect(store.getState().colleges[0].college.name).toBe('Edited name')
    expect(store.getState().session).toMatchObject({ role: 'collegeAdmin' })
    expect(store.getState().users).toEqual([])
    await store.getState().ensureAccounts()
    expect(store.getState().users.length).toBeGreaterThan(0)
    expect(await store.getState().signIn('dcas.admin', DEMO_PASSWORD)).toBeNull()
  })
})

describe('T9.5 account management helpers', () => {
  const admin: Session = { role: 'collegeAdmin', collegeId: diet.college.id }
  it('suggested passwords are long enough and readable; usernames are free and well-formed', async () => {
    const { suggestPassword, suggestUsername, usernameProblem } = await import('./auth')
    const p = suggestPassword()
    expect(p).toMatch(/^kc-[a-hj-km-np-z2-9]{10}$/)
    expect(suggestPassword()).not.toBe(p)
    expect(suggestUsername(users, 'DIET', 'Dr. Harpreet Kaur')).toBe('diet.harpreet-kaur')
    expect(suggestUsername(users, 'DIET', 'admin')).toBe('diet.admin2')
    expect(usernameProblem(users, suggestUsername(users, 'DIET', 'CSE-Y2-A'))).toBeNull()
  })

  it('creates exactly the missing section accounts, with a temporary password to change', async () => {
    const { createSectionAccounts, sectionsWithoutAccount } = await import('./auth')
    const without = users.filter((u) => !(u.role === 'student' && u.sectionId === diet.sections[0].id))
    expect(sectionsWithoutAccount(without, diet).map((s) => s.id)).toEqual([diet.sections[0].id])
    const r = await createSectionAccounts(without, colleges, admin, diet.college.id, 'temporary-1', NOW)
    if (!r.ok) throw new Error((r as { reason: string }).reason)
    expect('created' in r && r.created).toBe(1)
    const made = r.users.at(-1)!
    expect(made).toMatchObject({ role: 'student', sectionId: diet.sections[0].id, mustChange: true })
    expect(sectionsWithoutAccount(r.users, diet)).toEqual([])
    expect((await createSectionAccounts(without, colleges, { role: 'collegeAdmin', collegeId: dcas.college.id }, diet.college.id, 'temporary-1', NOW)).ok).toBe(false)
    expect((await createSectionAccounts(without, colleges, admin, diet.college.id, 'short', NOW)).ok).toBe(false)
  })
})
