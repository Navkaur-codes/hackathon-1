// Accounts and sign-in (v0.9). Passwords are never stored: only a per-user random salt and the SHA-256 of
// salt + password (Web Crypto — the browser's own, no library). A login produces exactly the `Session` the screens
// already read through `access.ts`, so no screen changes (root §2). Fully client-side: a demo-grade gate — the
// production path (real auth service + database with row-level security) is in the README.

import type { CollegeData, Id, Role, Session, User } from '../types'

export type AuthOutcome = { ok: true; users: User[]; user: User } | { ok: false; reason: string }
const fail = (reason: string): { ok: false; reason: string } => ({ ok: false, reason })

/** The one message every failed sign-in gets — it never says whether the username exists. */
export const LOGIN_ERROR = 'Username or password is wrong.'

const hex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** 16 random bytes as hex. */
export const newSalt = () => hex(crypto.getRandomValues(new Uint8Array(16)))

/** Hex SHA-256 of salt + password. */
export async function hashPassword(password: string, salt: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`)))
}

/** Constant-time-ish comparison of two hex strings of equal length. */
function sameHex(a: string, b: string) {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

export const normalUsername = (u: string) => u.trim().toLowerCase()

export function usernameProblem(users: User[], username: string, exceptId?: Id): string | null {
  const u = normalUsername(username)
  if (!/^[a-z0-9._-]{3,32}$/.test(u)) return 'Usernames are 3–32 characters: letters, digits, dot, dash or underscore.'
  if (users.some((x) => x.id !== exceptId && x.username === u)) return 'That username is taken.'
  return null
}

export const passwordProblem = (pw: string): string | null => (pw.length < 8 ? 'Passwords need at least 8 characters.' : null)

export type NewUser = {
  username: string
  displayName: string
  password: string
  role: Role
  collegeId?: Id
  deptId?: Id
  teacherId?: Id
  sectionId?: Id
  mustChange?: boolean
}

/** The link the role needs exists in that college (and only those fields are kept). */
function linkProblem(colleges: CollegeData[], u: NewUser): string | null {
  if (u.role === 'superAdmin') return null
  const c = colleges.find((x) => x.college.id === u.collegeId)
  if (!c) return 'Pick a college.'
  if (u.role === 'deptAdmin' && !c.departments.some((d) => d.id === u.deptId)) return 'Pick a department of this college.'
  if (u.role === 'teacher' && !c.teachers.some((t) => t.id === u.teacherId)) return 'Pick a teacher of this college.'
  if (u.role === 'student' && !c.sections.some((s) => s.id === u.sectionId)) return 'Pick a section of this college.'
  return null
}

/**
 * May `by` create (or manage) an account of `role` in `collegeId`? Super Admin: College Admins of any college.
 * College Admin: HOD, teacher and section accounts of their own college. Nobody else. `system` = seeding.
 */
export function mayManage(by: Session | 'system', role: Role, collegeId: Id | undefined): boolean {
  if (by === 'system') return true
  if (by.role === 'superAdmin') return role === 'collegeAdmin'
  if (by.role === 'collegeAdmin') return (role === 'deptAdmin' || role === 'teacher' || role === 'student') && !!collegeId && collegeId === by.collegeId
  return false
}

const keep = (u: NewUser): Partial<User> =>
  u.role === 'superAdmin'
    ? {}
    : u.role === 'collegeAdmin'
      ? { collegeId: u.collegeId }
      : u.role === 'deptAdmin'
        ? { collegeId: u.collegeId, deptId: u.deptId }
        : u.role === 'teacher'
          ? { collegeId: u.collegeId, teacherId: u.teacherId }
          : { collegeId: u.collegeId, sectionId: u.sectionId }

/** Create an account (validated, hashed). The plain password never leaves this function. */
export async function createUser(users: User[], colleges: CollegeData[], input: NewUser, by: Session | 'system', now: string, salt = newSalt()): Promise<AuthOutcome> {
  if (!mayManage(by, input.role, input.collegeId)) return fail('You cannot create that account.')
  const problem = usernameProblem(users, input.username) ?? passwordProblem(input.password) ?? linkProblem(colleges, input)
  if (problem) return fail(problem)
  if (!input.displayName.trim()) return fail('Give the account a name.')
  const username = normalUsername(input.username)
  const user: User = {
    id: `u-${username}`,
    username,
    displayName: input.displayName.trim(),
    role: input.role,
    ...keep(input),
    salt,
    hash: await hashPassword(input.password, salt),
    createdAt: now,
    ...(input.mustChange ? { mustChange: true } : {}),
  }
  return { ok: true, users: [...users, user], user }
}

/**
 * The account for these credentials, or the generic refusal (unknown user, wrong password, disabled, or — when the
 * sign-in page names a role — an account of another role: all the same).
 */
export async function verifyLogin(users: User[], username: string, password: string, role?: Role): Promise<{ ok: true; user: User } | { ok: false; reason: string }> {
  const user = users.find((u) => u.username === normalUsername(username))
  // hash even for an unknown user, so a miss takes as long as a wrong password
  const hash = await hashPassword(password, user?.salt ?? '00')
  if (!user || user.disabled || !sameHex(hash, user.hash) || (role && user.role !== role)) return fail(LOGIN_ERROR)
  return { ok: true, user }
}

/**
 * The session this account signs in to — the same shape the switchers made. Undefined when its link no longer
 * exists or its college is archived (the account then cannot sign in).
 */
export function sessionOf(user: User, colleges: CollegeData[]): Session | undefined {
  if (user.role === 'superAdmin') return { role: 'superAdmin' }
  const c = colleges.find((x) => x.college.id === user.collegeId && x.college.status === 'active')
  if (!c) return undefined
  const collegeId = c.college.id
  if (user.role === 'collegeAdmin') return { role: 'collegeAdmin', collegeId }
  if (user.role === 'deptAdmin') return c.departments.some((d) => d.id === user.deptId) ? { role: 'deptAdmin', collegeId, deptId: user.deptId } : undefined
  if (user.role === 'teacher') {
    const t = c.teachers.find((x) => x.id === user.teacherId)
    return t ? { role: 'teacher', collegeId, teacherId: t.id, deptId: t.deptId } : undefined
  }
  const s = c.sections.find((x) => x.id === user.sectionId)
  return s ? { role: 'student', collegeId, sectionId: s.id, deptId: s.deptId } : undefined
}

/** A signed-in user changes their own password (old one required). */
export async function changePassword(users: User[], userId: Id, oldPassword: string, newPassword: string): Promise<AuthOutcome> {
  const u = users.find((x) => x.id === userId)
  if (!u) return fail('Unknown account.')
  if (!sameHex(await hashPassword(oldPassword, u.salt), u.hash)) return fail('Your current password is wrong.')
  const problem = passwordProblem(newPassword)
  if (problem) return fail(problem)
  if (newPassword === oldPassword) return fail('Pick a password you have not used just now.')
  const salt = newSalt()
  const next: User = { ...u, salt, hash: await hashPassword(newPassword, salt), mustChange: undefined }
  return { ok: true, users: users.map((x) => (x.id === userId ? next : x)), user: next }
}

/** The creator role sets a temporary password; the account must change it at the next sign-in. */
export async function resetPassword(users: User[], by: Session, userId: Id, temporary: string): Promise<AuthOutcome> {
  const u = users.find((x) => x.id === userId)
  if (!u || !mayManage(by, u.role, u.collegeId)) return fail('You cannot reset that account.')
  const problem = passwordProblem(temporary)
  if (problem) return fail(problem)
  const salt = newSalt()
  const next: User = { ...u, salt, hash: await hashPassword(temporary, salt), mustChange: true }
  return { ok: true, users: users.map((x) => (x.id === userId ? next : x)), user: next }
}

export function setDisabled(users: User[], by: Session, userId: Id, disabled: boolean): AuthOutcome {
  const u = users.find((x) => x.id === userId)
  if (!u || !mayManage(by, u.role, u.collegeId)) return fail('You cannot change that account.')
  const next: User = { ...u, disabled: disabled || undefined }
  return { ok: true, users: users.map((x) => (x.id === userId ? next : x)), user: next }
}

/** Accounts of one college (Super Admins have none), by role then name. */
export function usersOf(users: User[], collegeId: Id): User[] {
  const order: Role[] = ['collegeAdmin', 'deptAdmin', 'teacher', 'student']
  return users.filter((u) => u.collegeId === collegeId).sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.displayName.localeCompare(b.displayName))
}

/** What the header shows: never the hash or salt. */
export const publicUser = (u: User) => ({ id: u.id, username: u.username, displayName: u.displayName, role: u.role, collegeId: u.collegeId })

// ── account management helpers (P0.9-c) ──────────────────────────────

const SAFE = 'abcdefghjkmnpqrstuvwxyz23456789'

/** A temporary password that is easy to read aloud (no 0 / o / 1 / l / i). */
export function suggestPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return `kc-${[...bytes].map((b) => SAFE[b % SAFE.length]).join('')}`
}

const slugPart = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(dr|prof|ms|mr|mrs)\.?\s+/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** A free username like `diet.kaur` or `diet.cse-y2-a` (a number is added when taken). */
export function suggestUsername(users: User[], collegeCode: string, part: string): string {
  const base = `${slugPart(collegeCode).replace(/-/g, '')}.${slugPart(part)}`.slice(0, 29)
  if (!users.some((u) => u.username === base)) return base
  for (let i = 2; ; i++) if (!users.some((u) => u.username === `${base}${i}`)) return `${base}${i}`
}

/** Sections of a college that have no student account yet. */
export const sectionsWithoutAccount = (users: User[], college: CollegeData) =>
  college.sections.filter((s) => !users.some((u) => u.role === 'student' && u.sectionId === s.id))

/** One shared account per section that has none, all with the same temporary password (changed at first sign-in). */
export async function createSectionAccounts(users: User[], colleges: CollegeData[], by: Session, collegeId: Id, password: string, now: string): Promise<AuthOutcome | { ok: true; users: User[]; created: number }> {
  const college = colleges.find((c) => c.college.id === collegeId)
  if (!college || !mayManage(by, 'student', collegeId)) return fail('You cannot create those accounts.')
  const problem = passwordProblem(password)
  if (problem) return fail(problem)
  let next = users
  let created = 0
  for (const s of sectionsWithoutAccount(users, college)) {
    const r = await createUser(
      next,
      colleges,
      { username: suggestUsername(next, college.college.code, s.name), displayName: `${s.name} students`, password, role: 'student', collegeId, sectionId: s.id, mustChange: true },
      by,
      now,
    )
    if (!r.ok) return r
    next = r.users
    created++
  }
  return { ok: true, users: next, created }
}
