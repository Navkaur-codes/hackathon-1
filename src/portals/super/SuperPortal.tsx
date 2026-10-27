import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, KeyRound, Plus, UserPlus, X } from 'lucide-react'
import { passwordProblem, usernameProblem } from '../../lib/auth'
import { codeProblem } from '../../lib/edit'
import type { CollegeData, Id, User } from '../../types'
import { PortalTitle } from '../PortalTitle'

/** A College Admin login the Super Admin hands over. */
export type AdminLogin = { displayName: string; username: string; password: string }

type Props = {
  colleges: CollegeData[]
  users: User[]
  /** Create a blank college and its College Admin account; returns the refusal or null. */
  onCreate: (college: { name: string; code: string }, admin: AdminLogin) => Promise<string | null>
  /** Another College Admin account for an existing college. */
  onAddAdmin: (collegeId: Id, admin: AdminLogin) => Promise<string | null>
  /** Give a College Admin a new password (ready to use, no forced change). */
  onSetPassword: (userId: Id, password: string) => Promise<string | null>
}

const btn = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition'
const inputCls = 'mt-1 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-[14px]'
const labelCls = 'font-mono text-[11px] tracking-[0.15em] text-muted uppercase'

function PasswordInput({ value, onChange, label = 'Password' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [show, setShow] = useState(false)
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <span className="relative block">
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" className={`${inputCls} pr-10`} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          className="absolute top-1/2 right-1.5 mt-0.5 -translate-y-1/2 rounded-md p-1.5 text-muted hover:text-ink"
        >
          {show ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
        </button>
      </span>
    </label>
  )
}

/** Name, username, password of one College Admin (with the checks `lib/auth.ts` applies). */
function AdminFields({ value, onChange }: { value: AdminLogin; onChange: (v: AdminLogin) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="block">
        <span className={labelCls}>College Admin's name</span>
        <input value={value.displayName} onChange={(e) => onChange({ ...value, displayName: e.target.value })} className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>Username</span>
        <input
          value={value.username}
          onChange={(e) => onChange({ ...value, username: e.target.value.toLowerCase() })}
          autoCapitalize="none"
          spellCheck={false}
          autoComplete="off"
          className={`${inputCls} font-mono`}
        />
      </label>
      <PasswordInput value={value.password} onChange={(password) => onChange({ ...value, password })} />
    </div>
  )
}

const adminProblem = (users: User[], a: AdminLogin) =>
  !a.displayName.trim() ? "Give the College Admin's name." : (usernameProblem(users, a.username) ?? passwordProblem(a.password))

const EMPTY: AdminLogin = { displayName: '', username: '', password: '' }

function NewCollege({ colleges, users, onCreate, onClose }: { colleges: CollegeData[]; users: User[]; onCreate: Props['onCreate']; onClose: (name?: string) => void }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [admin, setAdmin] = useState<AdminLogin>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const first = useRef<HTMLInputElement>(null)
  useEffect(() => first.current?.focus(), [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const problem = (!name.trim() ? 'Give the college a name.' : codeProblem(code, colleges)) ?? adminProblem(users, admin)
    if (problem) return setError(problem)
    setBusy(true)
    const why = await onCreate({ name: name.trim(), code: code.trim() }, admin)
    setBusy(false)
    if (why) return setError(why)
    onClose(name.trim())
  }

  return (
    <form onSubmit={submit} onKeyDown={(e) => e.key === 'Escape' && onClose()} aria-labelledby="new-college-h" className="rounded-xl border border-ink bg-card p-5" noValidate>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="new-college-h" className="font-display text-lg font-semibold">
            New college
          </h2>
          <p className="text-[13px] text-muted">Its College Admin signs in with this username and password and sets up everything else.</p>
        </div>
        <button type="button" onClick={() => onClose()} aria-label="Cancel" className="rounded-full p-1.5 text-muted hover:bg-ink/5 hover:text-ink">
          <X size={16} aria-hidden />
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr]">
        <label className="block">
          <span className={labelCls}>College name</span>
          <input ref={first} value={name} onChange={(e) => setName(e.target.value)} placeholder="Guru Nanak Dev Engineering College" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Short code</span>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="GNDEC" maxLength={16} className={`${inputCls} font-mono`} />
        </label>
      </div>
      <div className="mt-3">
        <AdminFields value={admin} onChange={setAdmin} />
      </div>
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-vermilion">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={`${btn} border-ink bg-ink text-paper hover:opacity-90 disabled:opacity-60`}>
          Create college
        </button>
        <button type="button" onClick={() => onClose()} className={`${btn} border-rule hover:border-ink`}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/** One College Admin row: username + "Set new password". */
function AdminRow({ user, onSetPassword }: { user: User; onSetPassword: Props['onSetPassword'] }) {
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const problem = passwordProblem(pw)
    if (problem) return setMsg({ ok: false, text: problem })
    const why = await onSetPassword(user.id, pw)
    if (why) return setMsg({ ok: false, text: why })
    setMsg({ ok: true, text: `New password set for ${user.username}.` })
    setPw('')
    setOpen(false)
  }
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-2 text-[14px]">
        <span className="mr-auto min-w-0">
          {user.displayName} <span className="font-mono text-[12px] text-muted">{user.username}</span>
          {user.disabled && <span className="ml-1 text-[12px] text-muted">(disabled)</span>}
        </span>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`${btn} border-rule py-1 text-[12px] hover:border-ink`}>
          <KeyRound size={13} aria-hidden /> Set new password
        </button>
      </div>
      {open && (
        <form onSubmit={save} className="mt-2 flex flex-wrap items-end gap-2" noValidate>
          <div className="w-56">
            <PasswordInput value={pw} onChange={setPw} label="New password" />
          </div>
          <button type="submit" className={`${btn} border-ink bg-ink text-paper hover:opacity-90`}>
            Save
          </button>
        </form>
      )}
      {msg && (
        <p role="status" className={`mt-1 text-[12px] ${msg.ok ? 'text-plum' : 'text-vermilion'}`}>
          {msg.text}
        </p>
      )}
    </li>
  )
}

function AddAdmin({ collegeId, users, onAddAdmin }: { collegeId: Id; users: User[]; onAddAdmin: Props['onAddAdmin'] }) {
  const [open, setOpen] = useState(false)
  const [admin, setAdmin] = useState<AdminLogin>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-[12px] text-muted underline-offset-2 hover:text-ink hover:underline">
        <UserPlus size={13} aria-hidden /> Add a College Admin
      </button>
    )
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const problem = adminProblem(users, admin)
    if (problem) return setError(problem)
    const why = await onAddAdmin(collegeId, admin)
    if (why) return setError(why)
    setAdmin(EMPTY)
    setError(null)
    setOpen(false)
  }
  return (
    <form onSubmit={submit} className="mt-2 rounded-lg border border-rule p-3" noValidate>
      <AdminFields value={admin} onChange={setAdmin} />
      {error && (
        <p role="alert" className="mt-2 text-[12px] text-vermilion">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button type="submit" className={`${btn} border-ink bg-ink text-paper hover:opacity-90`}>
          Add
        </button>
        <button type="button" onClick={() => setOpen(false)} className={`${btn} border-rule hover:border-ink`}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/** Super Admin (v0.9-i, user request): create colleges and give each College Admin a username and password — nothing else. */
export function SuperPortal({ colleges, users, onCreate, onAddAdmin, onSetPassword }: Props) {
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<string | null>(null)

  return (
    <section className="py-8">
      <PortalTitle role="superAdmin" title="Colleges">
        Create a college and give its College Admin a username and password. The College Admin shapes the structure, sets up the college and publishes
        its timetable.
      </PortalTitle>

      <div className="mt-6">
        {creating ? (
          <NewCollege
            colleges={colleges}
            users={users}
            onCreate={onCreate}
            onClose={(name) => {
              setCreating(false)
              if (name) setCreated(name)
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setCreated(null)
              setCreating(true)
            }}
            className={`${btn} border-ink bg-ink text-paper hover:opacity-90`}
          >
            <Plus size={15} aria-hidden /> New college
          </button>
        )}
        {created && !creating && (
          <p role="status" className="mt-4 rounded-lg border border-plum/40 bg-plum/5 px-4 py-3 text-[13px]">
            <strong>{created}</strong> is created. Hand its College Admin the username and password.
          </p>
        )}
      </div>

      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {colleges.map((c) => {
          const admins = users.filter((u) => u.role === 'collegeAdmin' && u.collegeId === c.college.id)
          return (
            <li key={c.college.id} className="flex flex-col rounded-xl border border-rule bg-card p-5">
              <span className="font-mono text-[11px] tracking-[0.2em] text-muted uppercase">{c.college.code}</span>
              <h2 className="font-display text-lg leading-snug font-semibold">{c.college.name}</h2>
              <p className="mt-3 font-mono text-[11px] tracking-[0.15em] text-muted uppercase">College Admins</p>
              {admins.length ? (
                <ul className="divide-y divide-rule">
                  {admins.map((u) => (
                    <AdminRow key={u.id} user={u} onSetPassword={onSetPassword} />
                  ))}
                </ul>
              ) : (
                <p className="py-2 text-[13px] text-muted">No College Admin yet.</p>
              )}
              <div className="mt-1">
                <AddAdmin collegeId={c.college.id} users={users} onAddAdmin={onAddAdmin} />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
