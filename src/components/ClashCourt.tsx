import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { CELL_INK, subjectColor } from '../lib/colors'
import { explainPlacement } from '../lib/explain'
import type { GridCell } from '../lib/gridModel'
import { periodTimes } from '../lib/structure'
import { roomOptions } from '../lib/allocation'
import type { CollegeData, Id, Placement, Timetable } from '../types'

type Props = {
  college: CollegeData
  timetable: Timetable
  cell: GridCell
  anchor: HTMLElement
  onClose: () => void
  /** College Admin: move this class to another room (returns the refusal reason, or null when done). */
  onMoveRoom?: (placement: Placement, roomId: Id) => string | null
}

const WIDTH = 352 // px, ~22rem

/** "Why here?" — the hard-rule checklist for one class, as a popover (bottom sheet on phones). */
export function ClashCourt({ college, timetable, cell, anchor, onClose, onMoveRoom }: Props) {
  const [moveTo, setMoveTo] = useState('')
  const [moveError, setMoveError] = useState<string | null>(null)
  const options = onMoveRoom ? roomOptions(college, cell.placement).filter((o) => !o.current) : []
  const panel = useRef<HTMLDivElement>(null)
  // latest onClose without re-running the focus effect on every render
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  const closeBtn = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [sheet, setSheet] = useState(false)
  const checks = explainPlacement(college, timetable, cell.placement)
  const allOk = checks.every((c) => c.ok)
  const times = periodTimes(college.calendar)
  const when = `${college.calendar.days[cell.day]} · ${times[cell.start].start}–${times[cell.start + cell.span - 1].end}`

  // Position next to the class; fall back to the other side, then a bottom sheet on narrow screens.
  useLayoutEffect(() => {
    const place = () => {
      const narrow = window.innerWidth < 640
      setSheet(narrow)
      if (narrow) return setPos(null)
      const r = anchor.getBoundingClientRect()
      const h = panel.current?.offsetHeight ?? 360
      let left = r.right + 10
      if (left + WIDTH > window.innerWidth - 12) left = r.left - WIDTH - 10
      if (left < 12) left = Math.min(window.innerWidth - WIDTH - 12, Math.max(12, r.left))
      const top = Math.min(Math.max(12, r.top), window.innerHeight - h - 12)
      setPos({ left, top })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor])

  // Esc / click outside closes; focus moves in, and back to the class on close.
  useEffect(() => {
    closeBtn.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current()
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !anchor.contains(t)) onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      anchor.focus()
    }
  }, [anchor])

  return (
    <div
      ref={panel}
      role="dialog"
      aria-labelledby="clash-court-title"
      className={`no-print fixed z-50 border border-rule bg-card shadow-2xl ${
        sheet ? 'inset-x-0 bottom-0 max-h-[75dvh] overflow-y-auto rounded-t-2xl' : 'max-h-[85dvh] overflow-y-auto rounded-xl'
      }`}
      style={sheet ? undefined : { width: WIDTH, left: pos?.left ?? -9999, top: pos?.top ?? 0 }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-rule p-4" style={{ background: subjectColor(cell.subject.code), color: CELL_INK }}>
        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-70">Why here?</p>
          <h3 id="clash-court-title" className="font-display text-lg leading-snug font-semibold">
            {cell.subject.name}
          </h3>
          <p className="text-[12px] opacity-80">
            {cell.section.name} · {when}
          </p>
        </div>
        <button
          ref={closeBtn}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1 transition hover:bg-black/10"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      <ul className="space-y-2 p-4">
        {checks.map((c, i) => (
          <li key={`${c.rule}-${i}`} className="flex items-start gap-2 text-[13px] leading-snug">
            <span
              className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full ${c.ok ? 'bg-ink text-paper' : 'bg-vermilion text-paper'}`}
              aria-hidden
            >
              {c.ok ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
            </span>
            <span className={c.ok ? '' : 'text-vermilion'}>
              <span className="sr-only">{c.ok ? 'Satisfied: ' : 'Broken: '}</span>
              {c.text}
              <span className="ml-1.5 font-mono text-[10px] text-muted">{c.rule}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-rule px-4 py-3 text-[12px] text-muted">
        {allOk ? 'Every hard rule holds for this class.' : 'This class breaks a hard rule — regenerate to fix it.'}
      </p>
      {onMoveRoom && (
        <div className="border-t border-rule px-4 py-3">
          <p className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Move to another room</p>
          {options.length === 0 ? (
            <p className="mt-1 text-[12px] text-muted">No other room of this type and size is free for the whole class.</p>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Room to move to</span>
                <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="w-full rounded-lg border border-rule bg-paper px-2 py-1.5 text-[13px]">
                  <option value="">Choose a free room…</option>
                  {options.map((o) => (
                    <option key={o.room.id} value={o.room.id}>
                      {o.room.name} · {o.room.capacity} seats ·{' '}
                      {o.usable === 'own' ? 'own department' : o.usable === 'shared' ? 'shared' : o.usable === 'loan' ? 'on loan' : `${college.departments.find((d) => d.id === o.room.owner)?.code} — will be allocated`}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!moveTo}
                onClick={() => {
                  const reason = onMoveRoom(cell.placement, moveTo)
                  if (reason) setMoveError(reason)
                  else onClose()
                }}
                className="rounded-full bg-ink px-3 py-1.5 text-[13px] font-medium text-paper disabled:opacity-40"
              >
                Move
              </button>
            </div>
          )}
          {moveError && (
            <p role="alert" className="mt-1 text-[12px] text-vermilion">
              {moveError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
