import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ArrowRight, ChevronDown, CircleAlert, Eye, EyeOff, Loader2 } from 'lucide-react'
import type { Portal } from '../lib/route'
import type { Role } from '../types'
import { roleMeta } from './roles'
import { Wheel } from './Wheel'

type Props = {
  /** Pre-pick a role (from `#/login/<portal>`). */
  hint?: Portal
  /** Returns the refusal, or null when signed in. */
  onSignIn: (username: string, password: string, role: Role) => Promise<string | null>
}

/** The roles that sign in here: the Super Admin and each college's College Admin. */
const SIGN_IN_ROLES: Role[] = ['superAdmin', 'collegeAdmin']

const field = 'mt-1 w-full rounded-xl border border-rule bg-paper px-3.5 py-2.5 text-[15px] transition outline-none focus:border-ink focus:ring-2 focus:ring-ink/10'
const label = 'font-mono text-[11px] tracking-[0.15em] text-muted uppercase'

/** The sign-in page: one card that fits the screen — role, username, password. */
export function LoginPage({ hint, onSignIn }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const [role, setRole] = useState<Role>(hint === 'super' ? 'superAdmin' : 'collegeAdmin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [caps, setCaps] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // the card rises once — never under reduced motion, never delaying input
  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from(card.current, { y: 20, opacity: 0, duration: 0.6, ease: 'power3.out', clearProps: 'transform,opacity' })
      })
      return () => mm.revert()
    },
    { scope: root },
  )

  const shake = () => {
    if (!card.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.fromTo(card.current, { x: 0 }, { keyframes: { x: [-8, 7, -5, 3, 0] }, duration: 0.4, ease: 'power1.out', clearProps: 'transform' })
  }

  const submit = async () => {
    if (!username.trim() || !password) {
      setError('Enter your username and password.')
      shake()
      return
    }
    setBusy(true)
    setError(null)
    const why = await onSignIn(username, password, role)
    if (why) {
      // a short pause after a miss slows guessing a little (and lets the shake read)
      await new Promise((r) => setTimeout(r, 450))
      setBusy(false)
      setError(why)
      setPassword('')
      shake()
    }
  }
  const capsKey = (e: React.KeyboardEvent) => setCaps(e.getModifierState?.('CapsLock') ?? false)
  const accent = roleMeta(role).accent

  return (
    <section ref={root} className="grid min-h-[calc(100dvh-4rem)] place-items-center py-4">
      <div ref={card} className="w-full max-w-sm rounded-3xl border border-rule bg-card p-6 shadow-[0_1px_0_var(--rule),0_24px_48px_-28px_rgba(28,27,25,0.35)] sm:p-7">
        <div className="flex items-center gap-3">
          <Wheel size={36} spokes={8} />
          <div>
            <h1 className="font-display text-2xl leading-tight font-semibold tracking-tight">Sign in</h1>
            <p className="text-[13px] text-muted">Every period, in its place.</p>
          </div>
        </div>

        <form
          className="mt-5 space-y-3.5"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          noValidate
        >
          <label className="block">
            <span className={label}>Sign in as</span>
            <span className="relative block">
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as Role)
                  setError(null)
                }}
                className={`${field} appearance-none pr-10`}
                style={{ borderLeft: `4px solid ${accent}` }}
              >
                {SIGN_IN_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleMeta(r).name}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute top-1/2 right-3.5 mt-0.5 -translate-y-1/2 text-muted" aria-hidden />
            </span>
          </label>

          <label className="block">
            <span className={label}>Username</span>
            <input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setError(null)
              }}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              className={field}
              aria-invalid={!!error}
            />
          </label>

          <label className="block">
            <span className={label}>Password</span>
            <span className="relative block">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(null)
                }}
                onKeyUp={capsKey}
                onKeyDown={capsKey}
                autoComplete="current-password"
                className={`${field} pr-12`}
                aria-invalid={!!error}
                aria-describedby={caps ? 'caps-note' : undefined}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide password' : 'Show password'}
                aria-pressed={show}
                className="absolute top-1/2 right-2 mt-0.5 -translate-y-1/2 rounded-lg p-2 text-muted transition hover:bg-ink/5 hover:text-ink"
              >
                {show ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
              </button>
            </span>
            {caps && (
              <span id="caps-note" className="mt-1 block text-[12px] text-terracotta">
                Caps Lock is on.
              </span>
            )}
          </label>

          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-xl bg-vermilion/8 px-3 py-2 text-[13px] text-vermilion">
              <CircleAlert size={15} aria-hidden /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-[15px] font-medium text-paper transition hover:opacity-90 disabled:opacity-70"
          >
            {busy ? (
              <>
                <Loader2 size={17} className="animate-spin" aria-hidden /> Signing in…
              </>
            ) : (
              <>
                Sign in <ArrowRight size={17} aria-hidden />
              </>
            )}
          </button>
        </form>
      </div>
    </section>
  )
}
