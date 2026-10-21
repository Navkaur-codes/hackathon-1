import { useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { AlertTriangle, ArrowRight, BadgeCheck, CalendarDays, RotateCcw } from 'lucide-react'
import { runSolver } from '../solver/runSolver'
import type { SolveResult } from '../solver/best'
import type { CollegeData } from '../types'
import { Wheel } from './Wheel'

type State = { kind: 'idle' } | { kind: 'solving' } | { kind: 'done'; result: SolveResult } | { kind: 'error'; message: string }

const ATTEMPTS = 20

/** "Generate timetable" for one college: runs the solver in a worker and shows the verified result. */
type Props = {
  college: CollegeData
  /** A result generated earlier (kept by the parent so it survives navigation). */
  initial?: SolveResult
  onResult?: (r: SolveResult) => void
  onView?: (r: SolveResult) => void
}

export function GeneratePanel({ college, initial, onResult, onView }: Props) {
  const [state, setState] = useState<State>(initial ? { kind: 'done', result: initial } : { kind: 'idle' })
  const [round, setRound] = useState(initial ? 1 : 0)
  const root = useRef<HTMLDivElement>(null)

  const generate = async () => {
    setState({ kind: 'solving' })
    try {
      // each regenerate explores a fresh block of seeds → a different, equally valid timetable
      const result = await runSolver(college, { attempts: ATTEMPTS, baseSeed: 1 + round * ATTEMPTS })
      setRound((r) => r + 1)
      setState({ kind: 'done', result })
      onResult?.(result)
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        if (state.kind === 'solving') {
          gsap.to('[data-solving-wheel] [data-wheel-spokes]', { rotate: 360, transformOrigin: '50% 50%', duration: 1.2, ease: 'none', repeat: -1 })
        }
        if (state.kind === 'done') {
          gsap.from('[data-result]', { autoAlpha: 0, y: 10, duration: 0.5, ease: 'power3.out', stagger: 0.06 })
          const counter = { v: 0 }
          gsap.to(counter, {
            v: state.result.score.total,
            duration: 1,
            ease: 'power2.out',
            onUpdate: () => {
              const el = root.current?.querySelector('[data-score]')
              if (el) el.textContent = String(Math.round(counter.v))
            },
          })
        }
      })
    },
    { scope: root, dependencies: [state.kind, round] },
  )

  const r = state.kind === 'done' ? state.result : null
  const clean = r && r.conflicts.length === 0
  const errors = r ? r.preflight.filter((w) => w.level === 'error') : []

  return (
    <div ref={root} className="mt-5" aria-live="polite">
      {state.kind === 'solving' && (
        <div className="flex items-center gap-3 text-sm text-muted">
          <span data-solving-wheel className="inline-flex">
            <Wheel size={28} spokes={8} />
          </span>
          Solving {ATTEMPTS} candidate timetables…
        </div>
      )}

      {r && (
        <div className="space-y-3 rounded-lg border border-rule bg-paper/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span
              data-result
              className={`inline-flex items-center gap-1.5 rounded-md border-2 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wider uppercase ${
                clean ? 'border-ink text-ink' : 'border-vermilion text-vermilion'
              }`}
            >
              {clean ? <BadgeCheck size={14} aria-hidden /> : <AlertTriangle size={14} aria-hidden />}
              {clean ? '0 clashes — verified' : `${r.conflicts.length} clashes found`}
            </span>
            <span data-result className="font-display text-2xl font-semibold tabular-nums">
              <span data-score>{r.score.total}</span>
              <span className="text-sm font-normal text-muted"> / 100 quality</span>
            </span>
          </div>
          <ul className="space-y-1 text-[13px] text-muted">
            <li data-result>
              <span className="text-ink">{r.placedPeriods}</span> periods a week placed
              {r.unplacedPeriods > 0 ? (
                <>
                  {' '}· <span className="text-vermilion">{r.unplacedPeriods} could not be placed</span>
                </>
              ) : (
                ' · nothing left out'
              )}
            </li>
            <li data-result>
              <span className="text-ink">{r.semesterHours.toLocaleString('en-IN')}</span> contact hours over{' '}
              {r.teachingDays} teaching days this semester
            </li>
            <li data-result className="font-mono text-[11px]">
              best of {r.attempts} tries · seed {r.bestSeed} · {r.ms} ms
            </li>
          </ul>
          {r.timetable.unplaced.slice(0, 2).map((u) => (
            <p key={u.assignmentId} data-result className="text-[13px] text-vermilion">
              {u.reason} <span className="text-muted">{u.suggestion}</span>
            </p>
          ))}
          {errors.length > 0 && (
            <p data-result className="text-[13px] text-vermilion">
              Pre-flight: {errors[0].message}
            </p>
          )}
        </div>
      )}

      {state.kind === 'error' && <p className="text-[13px] text-vermilion">Could not generate: {state.message}</p>}

      {state.kind !== 'solving' && (
        <div className="mt-4 flex flex-wrap gap-2">
          {r && onView && (
            <button
              type="button"
              onClick={() => onView(r)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90"
            >
              View timetable <CalendarDays size={15} aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={generate}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-ink px-4 py-2 text-sm font-medium transition hover:bg-ink hover:text-paper"
          >
            {r ? (
              <>
                Generate another <RotateCcw size={15} aria-hidden />
              </>
            ) : (
              <>
                Generate timetable <ArrowRight size={15} aria-hidden />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
