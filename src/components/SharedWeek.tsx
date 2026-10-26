import { useState } from 'react'
import { Printer } from 'lucide-react'
import { snapshotGrid, type ShareSnapshot } from '../lib/share'
import { TimetableGrid } from './TimetableGrid'

type Props = { snap: ShareSnapshot | null; onLeave: () => void }

const stamp = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

/** A shared section week (`?s=…`): read-only, needs no college data and no login. */
export function SharedWeek({ snap, onLeave }: Props) {
  const [grid] = useState(() => (snap ? snapshotGrid(snap) : null))
  if (!snap || !grid)
    return (
      <section className="max-w-xl py-16">
        <h1 className="font-display text-2xl font-semibold">This link is broken.</h1>
        <p className="mt-2 text-[14px] text-muted">It may have been cut short when it was copied. Ask for the link again.</p>
        <button type="button" onClick={onLeave} className="mt-4 rounded-full border border-ink px-3 py-1.5 text-[13px] font-medium">
          Open Kaalchakra
        </button>
      </section>
    )
  return (
    <section className="py-6 sm:py-8">
      <header className="border-b border-rule pb-4">
        <p className="font-mono text-[11px] tracking-[0.2em] text-muted uppercase">Shared timetable · read-only</p>
        <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">{snap.section}</h1>
        <p className="text-[14px] text-muted">
          {snap.subtitle} · {snap.college}
        </p>
        <p className="mt-1 font-mono text-[12px] text-muted">
          {snap.semester} · version {snap.version} published {stamp(snap.at)} · same every week
        </p>
      </header>
      <div className="no-print mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink px-3 py-1.5 text-[13px] font-medium transition hover:bg-ink hover:text-paper"
        >
          <Printer size={14} aria-hidden /> Print
        </button>
        <button type="button" onClick={onLeave} className="rounded-full border border-rule px-3 py-1.5 text-[13px] font-medium transition hover:border-ink">
          Open Kaalchakra
        </button>
      </div>
      <div className="mt-4">
        <TimetableGrid grid={grid} />
      </div>
      <p className="mt-3 text-[12px] text-muted">
        A snapshot taken when the link was shared — if the college publishes a new version, ask for a fresh link.
      </p>
    </section>
  )
}
