import { useState } from 'react'
import { KeyRound, Loader2, Plus, Shuffle, UserCheck, UserX } from 'lucide-react'
import { suggestPassword, suggestUsername } from '../lib/auth'
import type { CollegeData, Id, Role, User } from '../types'
import { roleMeta } from './roles'

export type AccountInput = { username: string; displayName: string; password: string; role: Role; collegeId: Id; deptId?: Id; teacherId?: Id; sectionId?: Id }

/** What a desk may do with accounts; each returns the refusal, or null when done. */
export type AccountActions = {
  create: (input: AccountInput) => Promise<string | null>
  reset: (userId: Id, temporary: string) => Promise<string | null>
  setDisabled: (userId: Id, disabled: boolean) => Promise<string | null>
  /** College Admin only: one account for every section that has none. */
  createSections?: (temporary: string) => Promise<string | null>
}

type Props = {
  college: CollegeData
  /** All accounts of the platform (usernames must be unique everywhere); the panel shows this college's of `roles`. */
  users: User[]
  /** The roles this desk may create and manage. */
  roles: Role[]
  actions: AccountActions
  compact?: boolean
}

const field = 'w-full min-w-0 rounded-lg border border-rule bg-paper px-2.5 py-1.5 text-[14px]'
const small = 'font-mono text-[11px] tracking-[0.15em] text-muted uppercase'
const btn = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition disabled:opacity-50'

/** Who an account is linked to, in words. */
function linkOf(c: CollegeData, u: Pick<User, 'role' | 'deptId' | 'teacherId' | 'sectionId'>) {
  if (u.role === 'deptAdmin') return c.departments.find((d) => d.id === u.deptId)?.name ?? '—'
  if (u.role === 'teacher') return c.teachers.find((t) => t.id === u.teacherId)?.name ?? '—'
  if (u.role === 'student') return c.sections.find((s) => s.id === u.sectionId)?.name ?? '—'
  return c.college.name
}

/** Accounts of one college for the roles this desk manages: list, add (temporary password), reset, disable. */
export function AccountsPanel({ college, users, roles, actions, compact = false }: Props) {
  const mine = users.filter((u) => u.collegeId === college.college.id && roles.includes(u.role))
  const [role, setRole] = useState<Role>(roles[0])
  const [link, setLink] = useState<Id>('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState(suggestPassword)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [resetting, setResetting] = useState<{ id: Id; temp: string } | null>(null)
  const [adding, setAdding] = useState(!compact && mine.length === 0)

  const options =
    role === 'deptAdmin'
      ? college.departments.map((d) => ({ id: d.id, label: `${d.code} · ${d.name}`, name: `HOD ${d.code}`, part: `${d.code}-hod` }))
      : role === 'teacher'
        ? college.teachers.map((t) => ({ id: t.id, label: t.name, name: t.name, part: t.name.split(/\s+/).at(-1) ?? t.name }))
        : role === 'student'
          ? college.sections.map((s) => ({ id: s.id, label: s.name, name: `${s.name} students`, part: s.name }))
          : []
  const taken = new Set(mine.filter((u) => u.role === role).map((u) => u.deptId ?? u.teacherId ?? u.sectionId))
  const pickLink = (id: Id) => {
    setLink(id)
    const o = options.find((x) => x.id === id)
    if (o) {
      setDisplayName(o.name)
      setUsername(suggestUsername(users, college.college.code, o.part))
    }
  }
  const run = async (fn: () => Promise<string | null>, done: string) => {
    setBusy(true)
    const why = await fn()
    setBusy(false)
    setMsg(why ? { ok: false, text: why } : { ok: true, text: done })
    return !why
  }
  const missing = college.sections.filter((s) => !users.some((u) => u.role === 'student' && u.sectionId === s.id)).length

  return (
    <div className="space-y-3">
      {mine.length === 0 ? (
        <p className="text-[13px] text-muted">No accounts yet.</p>
      ) : (
        <ul className="divide-y divide-rule rounded-xl border border-rule bg-card">
          {mine.map((u) => {
            const m = roleMeta(u.role)
            return (
              <li key={u.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 text-[13px] ${u.disabled ? 'opacity-60' : ''}`}>
                <span className="grid size-6 shrink-0 place-items-center rounded-full text-paper" style={{ background: m.accent }} aria-hidden>
                  <m.icon size={12} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{u.displayName}</span> <span className="font-mono text-[11px] text-muted">{u.username}</span>
                  <span className="block text-[12px] text-muted">
                    {m.name}
                    {u.role !== 'collegeAdmin' && ` · ${linkOf(college, u)}`}
                    {u.disabled ? ' · disabled' : u.mustChange ? ' · must set a new password' : ''}
                  </span>
                </span>
                {resetting?.id === u.id ? (
                  <span className="flex flex-wrap items-center gap-1.5">
                    <input value={resetting.temp} onChange={(e) => setResetting({ id: u.id, temp: e.target.value })} aria-label="Temporary password" className={`${field} w-40 font-mono text-[12px]`} />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        if (await run(() => actions.reset(u.id, resetting.temp), `Temporary password for ${u.username}: ${resetting.temp} — hand it over; they choose their own at the next sign-in.`)) setResetting(null)
                      }}
                      className={`${btn} border-ink bg-ink text-paper`}
                    >
                      Set
                    </button>
                    <button type="button" onClick={() => setResetting(null)} className={`${btn} border-rule`}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <button type="button" onClick={() => setResetting({ id: u.id, temp: suggestPassword() })} className={`${btn} border-rule hover:border-ink`} title="Reset password">
                      <KeyRound size={13} aria-hidden /> Reset
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => actions.setDisabled(u.id, !u.disabled), u.disabled ? `${u.username} can sign in again.` : `${u.username} can no longer sign in.`)}
                      className={`${btn} border-rule hover:border-ink`}
                    >
                      {u.disabled ? <UserCheck size={13} aria-hidden /> : <UserX size={13} aria-hidden />} {u.disabled ? 'Enable' : 'Disable'}
                    </button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {msg && (
        <p role="status" className={`text-[13px] ${msg.ok ? 'text-plum' : 'text-vermilion'}`}>
          {msg.text}
        </p>
      )}

      {!adding ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setAdding(true)} className={`${btn} border-ink hover:bg-ink hover:text-paper`}>
            <Plus size={14} aria-hidden /> Add an account
          </button>
          {actions.createSections && missing > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const temp = suggestPassword()
                void run(() => actions.createSections!(temp), `${missing} section ${missing === 1 ? 'account' : 'accounts'} created with the temporary password ${temp} — each changes it at the first sign-in.`)
              }}
              className={`${btn} border-rule hover:border-ink`}
            >
              {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Plus size={14} aria-hidden />} Create the {missing} missing section {missing === 1 ? 'account' : 'accounts'}
            </button>
          )}
        </div>
      ) : (
        <form
          className="space-y-3 rounded-xl border border-rule bg-paper p-4"
          onSubmit={async (e) => {
            e.preventDefault()
            const input: AccountInput = {
              username,
              displayName,
              password,
              role,
              collegeId: college.college.id,
              ...(role === 'deptAdmin' ? { deptId: link } : role === 'teacher' ? { teacherId: link } : role === 'student' ? { sectionId: link } : {}),
            }
            if (await run(() => actions.create(input), `Account ${username.trim().toLowerCase()} created. Temporary password: ${password} — they choose their own at the first sign-in.`)) {
              setLink('')
              setUsername('')
              setDisplayName('')
              setPassword(suggestPassword())
              setAdding(false)
            }
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.length > 1 && (
              <label className="flex flex-col gap-1">
                <span className={small}>Role</span>
                <select
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value as Role)
                    setLink('')
                    setUsername('')
                    setDisplayName('')
                  }}
                  className={field}
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r === 'student' ? 'Section (students)' : roleMeta(r).name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {role !== 'collegeAdmin' && (
              <label className="flex flex-col gap-1">
                <span className={small}>{role === 'deptAdmin' ? 'Department' : role === 'teacher' ? 'Teacher' : 'Section'}</span>
                <select value={link} onChange={(e) => pickLink(e.target.value)} className={field} required>
                  <option value="">Choose…</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                      {taken.has(o.id) ? ' (has an account)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className={small}>Name shown</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onBlur={() => !username && role === 'collegeAdmin' && displayName && setUsername(suggestUsername(users, college.college.code, displayName))}
                className={field}
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={small}>Username</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" spellCheck={false} className={`${field} font-mono text-[13px]`} required />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className={small}>Temporary password</span>
              <span className="flex gap-2">
                <input value={password} onChange={(e) => setPassword(e.target.value)} className={`${field} font-mono text-[13px]`} required />
                <button type="button" onClick={() => setPassword(suggestPassword())} className={`${btn} shrink-0 border-rule hover:border-ink`} aria-label="Suggest another password">
                  <Shuffle size={13} aria-hidden />
                </button>
              </span>
              <span className="text-[12px] text-muted">Hand it over in person; they choose their own at the first sign-in.</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className={`${btn} border-ink bg-ink text-paper`}>
              {busy && <Loader2 size={14} className="animate-spin" aria-hidden />} Create account
            </button>
            <button type="button" onClick={() => setAdding(false)} className={`${btn} border-rule`}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
