import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { bookingsToDecide, decideBooking, type BookingOutcome } from '../../lib/bookings'
import { shortDate } from '../../lib/semester'
import type { CollegeData, RoomBooking } from '../../types'

type Props = {
  college: CollegeData
  /** Present only when this session may decide shared-room bookings (lib/access.ts). */
  act?: (fn: (c: CollegeData) => BookingOutcome) => string | null
}

const btn = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition'
const STATUS: Record<RoomBooking['status'], string> = {
  requested: 'asked',
  approved: 'booked',
  declined: 'declined',
  withdrawn: 'withdrawn',
  needsNewRoom: 'needs new room',
}

/** Day bookings: the College Admin decides those of shared rooms and sees every booking in the college. */
export function BookingsPanel({ college, act }: Props) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const room = (id: string) => college.rooms.find((r) => r.id === id)?.name ?? id
  const code = (id: string) => college.departments.find((d) => d.id === id)?.code ?? id
  const periods = (ps: number[]) => ps.map((p) => `P${p + 1}`).join(', ')
  const toDecide = bookingsToDecide(college, 'collegeAdmin')
  const all = [...(college.bookings ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  const run = (fn: (c: CollegeData) => BookingOutcome, done: string) => {
    const reason = act?.(fn) ?? 'Not allowed.'
    setMsg(reason ? { ok: false, text: reason } : { ok: true, text: done })
  }
  const now = () => new Date().toISOString()

  return (
    <section aria-labelledby="bookings-h" className="rounded-xl border border-rule bg-card p-5">
      <h2 id="bookings-h" className="font-display text-base font-semibold">
        Day bookings {toDecide.length > 0 && <span className="ml-1 rounded-full bg-vermilion px-1.5 font-mono text-[11px] text-paper">{toDecide.length} to decide</span>}
      </h2>
      <p className="text-[12px] text-muted">
        Rooms booked for a single date (the weekly timetable never changes). You decide shared rooms; each department’s HOD decides its own rooms.
      </p>
      {act && toDecide.length > 0 && (
        <ul className="mt-2 divide-y divide-rule">
          {toDecide.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 text-[13px]">
              <span className="min-w-0 flex-1">
                <strong>{code(b.deptId)}</strong> asks for <strong>{room(b.roomId)}</strong> on {shortDate(b.date)} · {periods(b.periods)} — “{b.purpose}”
              </span>
              <button type="button" onClick={() => run((c) => decideBooking(c, b.id, 'collegeAdmin', true, now()), `Booked for ${code(b.deptId)}.`)} className={`${btn} border-ink bg-ink text-paper`}>
                <Check size={14} aria-hidden /> Approve
              </button>
              <button type="button" onClick={() => run((c) => decideBooking(c, b.id, 'collegeAdmin', false, now()), 'Declined.')} className={`${btn} border-rule hover:border-ink`}>
                <X size={14} aria-hidden /> Decline
              </button>
            </li>
          ))}
        </ul>
      )}
      {msg && (
        <p role="status" className={`mt-2 text-[13px] ${msg.ok ? 'text-plum' : 'text-vermilion'}`}>
          {msg.text}
        </p>
      )}
      {all.length > 0 ? (
        <ul className="mt-3 divide-y divide-rule border-t border-rule">
          {all.map((b) => (
            <li key={b.id} className="flex flex-wrap gap-x-3 py-1.5 text-[13px]">
              <span className={`w-28 font-mono text-[11px] uppercase ${b.status === 'needsNewRoom' ? 'text-vermilion' : 'text-muted'}`}>{STATUS[b.status]}</span>
              <span className="min-w-0 flex-1">
                {shortDate(b.date)} · {room(b.roomId)} · {periods(b.periods)} · {code(b.deptId)} — {b.purpose}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-muted">No day bookings yet.</p>
      )}
    </section>
  )
}
