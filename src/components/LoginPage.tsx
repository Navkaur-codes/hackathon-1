import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ArrowRight, CircleAlert, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import type { Portal } from '../lib/route'
import { portalOf } from '../lib/route'
import type { CollegeData, Role, User } from '../types'
import { ROLES, roleMeta } from './roles'
import { Wheel } from './Wheel'

type Props = {
  users: User[]
  colleges: CollegeData[]
  /** Highlight one role's demo accounts (from the landing page's "Sign in as …"). */
  hint?: Portal
  /** Shown once on the page — every demo account uses it. */
  demoPassword: string
  /** Returns the refusal, or null when signed in. */
  onSignIn: (username: string, password: string) => Promise<string | null>
}

const ORDER: Role[] = ['collegeAdmin', 'deptAdmin', 'teacher', 'student']
/** How many accounts of a role to show as chips per college (the rest sit behind "all accounts"). */
const PER_ROLE: Record<Role, number> = { superAdmin: 1, collegeAdmin: 1, deptAdmin: 3, teacher: 2, student: 2 }

function DemoChip({ u, onPick, busy }: { u: User; onPick: (u: User) => void; busy: boolean }) {
  const m = roleMeta(u.role)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onPick(u)}
      className="group inline-flex max-w-full min-w-0 items-center gap-2 rounded-full border border-rule bg-card py-1 pr-3 pl-1.5 text-left text-[13px] transition hover:-translate-y-px hover:border-ink hover:shadow-sm focus-visible:outline-2 disabled:opacity-50"
      title={`Sign in as ${u.username}`}
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-full text-paper" style={{ background: m.accent }} aria-hidden>
        <m.icon size={13} />
      </span>
      <span className="min-w-0 truncate">
        {u.displayName} <span className="font-mono text-[11px] text-muted">{u.username}</span>
      </span>
    </button>
  )
}

/** The sign-in page (v0.9): an editorial left panel and a quiet form card, with one-click demo accounts. */
export function LoginPage({ users, colleges, hint, demoPassword, onSignIn }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const wheel = useRef<SVGSVGElement>(null)
  const userInput = useRef<HTMLInputElement>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [caps, setCaps] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // first show: the card rises, the panel's lines follow, the wheel turns slowly — never under reduced motion
  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-rise]', { y: 18, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.07, clearProps: 'transform,opacity' })
        gsap.from(card.current, { y: 24, opacity: 0, duration: 0.7, ease: 'power3.out', delay: 0.1, clearProps: 'transform,opacity' })
        if (wheel.current) gsap.to(wheel.current.querySelector('[data-wheel-spokes]'), { rotation: 360, svgOrigin: '100 100', duration: 90, ease: 'none', repeat: -1 })
      })
      return () => mm.revert()
    },
    { scope: root },
  )

  const shake = () => {
    if (!card.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.fromTo(card.current, { x: 0 }, { keyframes: { x: [-8, 7, -5, 3, 0] }, duration: 0.4, ease: 'power1.out', clearProps: 'transform' })
  }

  const submit = async (u = username, p = password) => {
    if (!u.trim() || !p) {
      setError('Enter your username and password.')
      shake()
      return
    }
    setBusy(true)
    setError(null)
    const why = await onSignIn(u, p)
    if (why) {
      // a short pause after a miss slows guessing a little (and lets the shake read)
      await new Promise((r) => setTimeout(r, 450))
      setBusy(false)
      setError(why)
      setPassword('')
      shake()
    }
  }
  const pick = (u: User) => {
    setUsername(u.username)
    setPassword(demoPassword)
    void submit(u.username, demoPassword)
  }

  const supers = users.filter((u) => u.role === 'superAdmin' && !u.disabled)
  const groups = colleges
    .filter((c) => c.college.status === 'active')
    .map((c) => ({
      college: c,
      roles: ORDER.map((role) => ({ role, list: users.filter((u) => u.collegeId === c.college.id && u.role === role && !u.disabled) })).filter((g) => g.list.length),
    }))
    .filter((g) => g.roles.length)
  const capsKey = (e: React.KeyboardEvent) => setCaps(e.getModifierState?.('CapsLock') ?? false)

  return (
    <section ref={root} className="grid items-start gap-6 py-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10 lg:py-10">
      {/* editorial panel */}
      <div className="relative flex flex-col overflow-hidden rounded-3xl border border-rule bg-card px-6 py-8 sm:px-10 sm:py-10 lg:sticky lg:top-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 35px, var(--rule) 35px 36px)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 45%, black 75%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 45%, black 75%, transparent 100%)',
          }}
        />
        <div className="relative">
          <p data-rise className="font-mono text-[11px] tracking-[0.25em] text-muted uppercase">
            Kaalchakra · college timetables
          </p>
          <h1 data-rise className="mt-4 max-w-[14ch] font-display text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
            Every period, in its place.
          </h1>
          <p data-rise className="mt-4 max-w-[42ch] text-[15px] text-muted">
            One clash-free timetable for every department — and a desk for each person who lives by it. Sign in to yours.
          </p>
        </div>
        <div className="relative my-8 flex justify-center" data-rise>
          <Wheel ref={wheel} size={208} spokes={12} className="drop-shadow-sm" />
        </div>
        <ul className="relative grid gap-2 sm:grid-cols-2" aria-label="Who signs in here">
          {ROLES.map((r) => (
            <li key={r.role} data-rise className="flex items-start gap-2.5 text-[13px]">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-paper" style={{ background: r.accent }} aria-hidden>
                <r.icon size={13} />
              </span>
              <span className="min-w-0">
                <span className="font-medium">{r.name}</span>
                <span className="block text-[12px] leading-snug text-muted">{r.line}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* form card — first on phones (signing in is why you are here), beside the panel on wide screens */}
      <div className="order-first flex flex-col justify-center lg:order-none">
        <div ref={card} className="rounded-3xl border border-rule bg-card p-6 shadow-[0_1px_0_var(--rule),0_24px_48px_-28px_rgba(28,27,25,0.35)] sm:p-8">
          <div className="flex items-center gap-2 text-vermilion">
            <KeyRound size={18} aria-hidden />
            <p className="font-mono text-[11px] tracking-[0.2em] uppercase">Your desk</p>
          </div>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-[14px] text-muted">Use the account your college gave you.</p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
            noValidate
          >
            <label className="block">
              <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Username</span>
              <input
                ref={userInput}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  setError(null)
                }}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                className="mt-1.5 w-full rounded-xl border border-rule bg-paper px-3.5 py-3 text-[15px] transition outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
                aria-invalid={!!error}
              />
            </label>
            <label className="block">
              <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Password</span>
              <span className="relative mt-1.5 block">
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
                  className="w-full rounded-xl border border-rule bg-paper py-3 pr-12 pl-3.5 text-[15px] transition outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
                  aria-invalid={!!error}
                  aria-describedby={caps ? 'caps-note' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  aria-pressed={show}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-2 text-muted transition hover:bg-ink/5 hover:text-ink"
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

          <div className="mt-7 border-t border-rule pt-5">
            <p className="text-[13px] font-medium">Try a demo account</p>
            <p className="text-[12px] text-muted">
              One click signs in. Every demo account uses the password <code className="rounded bg-paper px-1 font-mono text-[12px] text-ink">{demoPassword}</code>.
            </p>
            {users.length === 0 ? (
              <p className="mt-3 flex items-center gap-2 text-[13px] text-muted">
                <Loader2 size={14} className="animate-spin" aria-hidden /> Preparing demo accounts…
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {supers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {supers.map((u) => (
                      <DemoChip key={u.id} u={u} onPick={pick} busy={busy} />
                    ))}
                  </div>
                )}
                {groups.map((g) => (
                  <div key={g.college.college.id}>
                    <p className="font-mono text-[10px] tracking-[0.15em] text-muted uppercase">{g.college.college.name}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {g.roles.flatMap(({ role, list }) =>
                        list
                          .slice(0, hint === portalOf(role) ? list.length : PER_ROLE[role])
                          .map((u) => <DemoChip key={u.id} u={u} onPick={pick} busy={busy} />),
                      )}
                    </div>
                    <details className="mt-1.5 text-[12px]">
                      <summary className="cursor-pointer text-muted hover:text-ink">All {g.roles.reduce((n, r) => n + r.list.length, 0)} accounts of {g.college.college.code}</summary>
                      <ul className="mt-1 columns-1 gap-4 font-mono text-[11px] text-muted sm:columns-2">
                        {g.roles.flatMap(({ list }) =>
                          list.map((u) => (
                            <li key={u.id}>
                              <button type="button" onClick={() => pick(u)} disabled={busy} className="text-left hover:text-ink hover:underline">
                                {u.username}
                              </button>
                            </li>
                          )),
                        )}
                      </ul>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="mt-6 flex items-start gap-2 text-[12px] leading-relaxed text-muted">
            <ShieldCheck size={15} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              A demo-grade sign-in: passwords are stored only as salted hashes, but everything lives in this browser. A real deployment would use an
              authentication service and a database with access rules per college (see the README).
            </span>
          </p>
        </div>
      </div>
    </section>
  )
}
