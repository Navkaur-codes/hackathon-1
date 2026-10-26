import { useState } from 'react'
import { RotateCcw, Sparkles } from 'lucide-react'
import { VerifiedStamp } from '../../components/VerifiedStamp'
import { Wheel } from '../../components/Wheel'
import { coverage, deptEntities } from '../../lib/deptPlan'
import { validate } from '../../solver/validate'
import type { CollegeData, Id } from '../../types'

type Props = {
  college: CollegeData
  deptId: Id
  /** Solve this department against the rest of the college and merge it into the draft; `round` varies the seeds. */
  onGenerate: (round: number) => Promise<void>
}

/** "Generate my department": only this department moves; every other department's classes stay booked. */
export function DeptGenerate({ college, deptId, onGenerate }: Props) {
  const [busy, setBusy] = useState(false)
  const [round, setRound] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const d = deptEntities(college, deptId)
  const draft = college.draft
  const placed = (draft?.placements ?? []).filter((p) => d.assignmentIds.has(p.assignmentId)).reduce((s, p) => s + p.length, 0)
  const unplaced = (draft?.unplaced ?? []).filter((u) => d.assignmentIds.has(u.assignmentId)).reduce((s, u) => s + u.periods, 0)
  const missing = draft ? coverage(college, draft).filter((g) => g.deptId === deptId).reduce((s, g) => s + g.missing, 0) : 0
  const clashes = draft ? validate(college, draft).filter((x) => x.assignmentIds.some((id) => d.assignmentIds.has(id))).length : 0
  const others = (draft?.placements ?? []).filter((p) => !d.assignmentIds.has(p.assignmentId)).reduce((s, p) => s + p.length, 0)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await onGenerate(round)
      setRound((r) => r + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="gen-h" className="rounded-xl border border-rule bg-card p-5">
      <h2 id="gen-h" className="font-display text-lg font-semibold">
        Generate my department
      </h2>
      <p className="mt-1 text-[13px] text-muted">
        Places only your department’s classes, around the {others} periods other departments already have in the college draft — they never move, so
        nothing can clash across departments.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-terracotta px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? (
            <>
              <Wheel size={16} spokes={8} /> Solving…
            </>
          ) : placed ? (
            <>
              Generate again <RotateCcw size={15} aria-hidden />
            </>
          ) : (
            <>
              Generate <Sparkles size={15} aria-hidden />
            </>
          )}
        </button>
        {draft && placed > 0 && <VerifiedStamp conflicts={clashes} />}
      </div>
      {draft && placed > 0 && (
        <p className="mt-3 text-[13px]" aria-live="polite">
          <span className="font-medium">{placed}</span> periods of the department in the draft
          {unplaced ? <span className="text-vermilion"> · {unplaced} could not be placed</span> : ' · nothing left out'}
          {missing ? <span className="text-vermilion"> · {missing} changed since — generate again</span> : ''}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-vermilion">
          {error}
        </p>
      )}
    </section>
  )
}
