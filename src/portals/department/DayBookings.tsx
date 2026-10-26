import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { bookingsOf, bookingsToDecide, decideBooking, withdrawBooking, type BookingOutcome } from '../../lib/bookings'
import { shortDate } from '../../lib/semester'
import type { CollegeData, Id, RoomBooking } from '../../types'
import { DayBooking } from './DayBooking'

type Props = {
  college: CollegeData
  deptId: Id
  act: (fn: (c: CollegeData) => BookingOutcome) => string | null
}

const btn = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition'
const STATUS: Record<RoomBooking['status'], { text: string; color: string }> = {
  requested: { text: 'asked', color: 'var(--gold)' },
  approved: { text: 'booked', color: 'var(--plum)' },
  declined: { text: 'declined', color: 'var(--muted)' },
  withdrawn: { text: 'withdrawn', color: 'var(--muted)' },
  needsNewRoom: { text: 'needs a new room', color: 'var(--vermilion)' },
}

/** Single-date room bookings on the HOD desk: decide requests for your rooms, book a room, see your bookings. */
export function DayBookings({ college, deptId, act }: Props) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const room = (id: Id) => college.rooms.find((r) => r.id === id)?.name ?? id
  const code = (id: Id) => college.departments.find((d) => d.id === id)?.code ?? id
  const periods = (ps: number[]) => ps.map((p) => `P${p + 1}`).join(', ')
  const toDecide = bookingsToDecide(college, deptId)
  const mine = bookingsOf(college, deptId)
  const run = (fn: (c: CollegeData) => BookingOutcome, done: string) => {
    const reason = act(fn)
    setMsg(reason ? { ok: false, text: reason } : { ok: true, text: done })
  }
  const now = () => new Date().toISOString()

  return (
    <div className="space-y-6">
      {toDecide.length > 0 && (
        <section aria-labelledby="bk-decide-h" className="rounded-xl border border-rule bg-card p-5">
          <h3 id="bk-decide-h" className="font-display text-base font-semibold">
            Day bookings of your rooms <span className="ml-1 rounded-full bg-terracotta px-1.5 font-mono text-[11px] text-paper">{toDecide.length}</span>
          </h3>
          <ul className="mt-2 divide-y divide-rule">
            {toDecide.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 text-[13px]">
                <span className="min-w-0 flex-1">
                  <strong>{code(b.deptId)}</strong> asks for <strong>{room(b.roomId)}</strong> on {shortDate(b.date)} · {periods(b.periods)} — “{b.purpose}”
                </span>
                <button type="button" onClick={() => run((c) => decideBooking(c, b.id, deptId, true, now()), `Booked for ${code(b.deptId)}.`)} className={`${btn} border-ink bg-ink text-paper`}>
                  <Check size={14} aria-hidden /> Approve
                </button>
                <button type="button" onClick={() => run((c) => decideBooking(c, b.id, deptId, false, now()), 'Declined.')} className={`${btn} border-rule hover:border-ink`}>
                  <X size={14} aria-hidden /> Decline
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DayBooking college={college} deptId={deptId} act={act} />

      {msg && (
        <p role="status" className={`text-[13px] ${msg.ok ? 'text-plum' : 'text-vermilion'}`}>
          {msg.text}
        </p>
      )}

      {mine.length > 0 && (
        <section aria-labelledby="bk-mine-h" className="rounded-xl border border-rule bg-card p-5">
          <h3 id="bk-mine-h" className="font-display text-base font-semibold">
            Your day bookings
          </h3>
          <ul className="mt-2 divide-y divide-rule">
            {mine.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 text-[13px]">
                <span
                  className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase"
                  style={{ color: STATUS[b.status].color, borderColor: STATUS[b.status].color }}
                >
                  {STATUS[b.status].text}
                </span>
                <span className="min-w-0 flex-1">
                  {room(b.roomId)} · {shortDate(b.date)} · {periods(b.periods)} — “{b.purpose}”
                  {b.status === 'needsNewRoom' && <span className="text-vermilion"> — a new timetable needs this room then; book another</span>}
                </span>
                {(b.status === 'requested' || b.status === 'approved' || b.status === 'needsNewRoom') && (
                  <button type="button" onClick={() => run((c) => withdrawBooking(c, b.id, deptId, now()), 'Withdrawn.')} className={`${btn} border-rule hover:border-ink`}>
                    Withdraw
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
