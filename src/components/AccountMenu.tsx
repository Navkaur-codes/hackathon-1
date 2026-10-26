import { useEffect, useRef, useState } from 'react'
import { KeyRound, Loader2, LogOut, X } from 'lucide-react'
import { changePassword } from '../lib/auth'
import type { CollegeData, User } from '../types'
import { roleMeta } from './roles'

type DialogProps = {
  user: User
  users: User[]
  onSaved: (users: User[]) => void
  /** Forced after a reset: no way out except a new password (or signing out). */
  forced?: boolean
  onClose: () => void
}

/** Change password: current one required, the new one twice, at least 8 characters. Re-salted on save. */
export function ChangePasswordDialog({ user, users, onSaved, forced = false, onClose }: DialogProps) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const first = useRef<HTMLInputElement>(null)
  useEffect(() => {
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !forced) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [forced, onClose])
  const field = 'mt-1 w-full rounded-xl border border-rule bg-paper px-3 py-2.5 text-[15px] outline-none focus:border-ink focus:ring-2 focus:ring-ink/10'
  const label = 'font-mono text-[11px] tracking-[0.15em] text-muted uppercase'

  return (
    <div className="no-print fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-label="Change password">
      <form
        className="w-full max-w-sm rounded-3xl border border-rule bg-card p-6 shadow-2xl"
        onSubmit={async (e) => {
          e.preventDefault()
          if (next !== again) return setMsg({ ok: false, text: 'The two new passwords differ.' })
          setBusy(true)
          const r = await changePassword(users, user.id, current, next)
          setBusy(false)
          if (!r.ok) return setMsg({ ok: false, text: r.reason })
          onSaved(r.users)
          setMsg({ ok: true, text: 'Password changed.' })
          if (forced) onClose()
          else setTimeout(onClose, 700)
        }}
      >
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-vermilion" aria-hidden />
          <h2 className="font-display text-xl font-semibold">{forced ? 'Choose a new password' : 'Change password'}</h2>
          {!forced && (
            <button type="button" onClick={onClose} aria-label="Close" className="ml-auto rounded-full p-1.5 text-muted hover:bg-ink/5 hover:text-ink">
              <X size={17} aria-hidden />
            </button>
          )}
        </div>
        {forced && <p className="mt-1 text-[13px] text-muted">Your password was reset by an admin. Pick your own before you continue.</p>}
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className={label}>{forced ? 'Temporary password' : 'Current password'}</span>
            <input ref={first} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className={label}>New password</span>
            <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className={label}>New password again</span>
            <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className={field} />
          </label>
        </div>
        <p className="mt-2 text-[12px] text-muted">At least 8 characters.</p>
        {msg && (
          <p role={msg.ok ? 'status' : 'alert'} className={`mt-2 text-[13px] ${msg.ok ? 'text-plum' : 'text-vermilion'}`}>
            {msg.text}
          </p>
        )}
        <button type="submit" disabled={busy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-[14px] font-medium text-paper disabled:opacity-60">
          {busy && <Loader2 size={15} className="animate-spin" aria-hidden />} Save new password
        </button>
      </form>
    </div>
  )
}

type MenuProps = { user: User; college?: CollegeData; onChangePassword: () => void; onSignOut: () => void }

/** Header: who is signed in (role accent), their college, change password, sign out. */
export function AccountMenu({ user, college, onChangePassword, onSignOut }: MenuProps) {
  const m = roleMeta(user.role)
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex min-w-0 items-center gap-2 rounded-full border border-rule bg-card py-1 pr-3 pl-1">
        <span className="grid size-7 shrink-0 place-items-center rounded-full text-paper" style={{ background: m.accent }} aria-hidden>
          <m.icon size={14} />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[13px] font-medium">{user.displayName}</span>
          <span className="block truncate font-mono text-[10px] tracking-wider text-muted uppercase">
            {m.short}
            {college ? ` · ${college.college.code}` : ''}
          </span>
        </span>
      </span>
      <button type="button" onClick={onChangePassword} aria-label="Change password" title="Change password" className="rounded-full p-2 text-muted transition hover:bg-ink/5 hover:text-ink">
        <KeyRound size={16} aria-hidden />
      </button>
      <button type="button" onClick={onSignOut} aria-label="Sign out" title="Sign out" className="rounded-full p-2 text-muted transition hover:bg-ink/5 hover:text-ink">
        <LogOut size={16} aria-hidden />
      </button>
    </div>
  )
}
