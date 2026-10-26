import { useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { busyOnDate, dateInfo, requestBooking, type BookingOutcome } from '../../lib/bookings'
import { periodTimes } from '../../lib/structure'
import type { CollegeData, Id } from '../../types'

type Props = {
  college: CollegeData
  deptId: Id
  act: (fn: (c: CollegeData) => BookingOutcome) => string | null
}

const field = 'rounded-lg border border-rule bg-paper px-2.5 py-1.5 text-[14px]'
const small = 'font-mono text-[11px] tracking-[0.15em] text-muted uppercase'

/** Local calendar date as ISO. */
const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "Book a room for a day": one real date, free periods only, a purpose — the weekly timetable never changes. */
export function DayBooking({ college, deptId, act }: Props) {
  const today = todayIso()
  const first = today > college.semester.startDate ? today : college.semester.startDate
  const [roomId, setRoomId] = useState<Id>(college.rooms[0]?.id ?? '')
  const [date, setDate] = useState(first)
  const [periods, setPeriods] = useState<number[]>([])
  const [purpose, setPurpose] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const room = college.rooms.find((r) => r.id === roomId)
  const times = periodTimes(college.calendar)
  const info = date ? dateInfo(college, date) : undefined
  const busy = room && date ? busyOnDate(college, room.id, date) : new Map<number, string>()
  const code = (id: Id) => (id === 'shared' ? 'shared' : (college.departments.find((d) => d.id === id)?.code ?? id))
  const dayNote = !info
    ? ''
    : info.day === null
      ? 'not a working day'
      : info.status === 'holiday'
        ? `holiday — ${info.label}: no classes, every period is free`
        : info.status === 'noClass'
          ? `${info.label}: no regular classes`
          : `teaching day (${college.calendar.days[info.day]})`

  return (
    <section aria-labelledby="day-h" className="rounded-xl border border-rule bg-card p-5">
      <h3 id="day-h" className="font-display text-base font-semibold">
        Book a room for a day
      </h3>
      <p className="text-[13px] text-muted">
        For one date only — an extra class, a seminar, a test. The weekly timetable does not change. Your own rooms are booked at once; another
        department’s room waits for its HOD, a shared room for the College Admin.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 max-w-full flex-col gap-1">
          <span className={small}>Room</span>
          <select
            value={roomId}
            onChange={(e) => {
              setRoomId(e.target.value)
              setPeriods([])
              setMsg(null)
            }}
            className={`${field} max-w-full`}
          >
            {college.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {r.type} · {r.capacity} seats · {code(r.owner)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={small}>Date</span>
          <input
            type="date"
            value={date}
            min={first}
            max={college.semester.endDate}
            onChange={(e) => {
              setDate(e.target.value)
              setPeriods([])
              setMsg(null)
            }}
            className={field}
          />
        </label>
      </div>
      {dayNote && <p className="mt-2 text-[12px] text-muted">{dayNote}</p>}
      {info?.day !== null && info && (
        <div role="group" aria-label="Periods" className="mt-2 flex flex-wrap gap-1">
          {times.map((t) => {
            const why = busy.get(t.index)
            const on = periods.includes(t.index)
            return (
              <button
                key={t.index}
                type="button"
                disabled={!!why}
                aria-pressed={on}
                title={why ? `Taken: ${why}` : `${t.start}–${t.end}`}
                onClick={() => setPeriods((ps) => (ps.includes(t.index) ? ps.filter((p) => p !== t.index) : [...ps, t.index]))}
                className={`rounded-full border px-2.5 py-1 font-mono text-[12px] transition disabled:cursor-not-allowed disabled:line-through disabled:opacity-40 ${
                  on ? 'border-ink bg-ink text-paper' : 'border-rule hover:border-ink'
                }`}
              >
                P{t.index + 1} {t.start}
              </button>
            )
          })}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="What for? (e.g. Guest lecture)" aria-label="Purpose" className={`${field} min-w-0 flex-1`} />
        <button
          type="button"
          disabled={periods.length === 0 || !room}
          onClick={() => {
            const reason = act((c) => requestBooking(c, deptId, roomId, date, periods, purpose, new Date().toISOString(), today))
            if (reason) return setMsg({ ok: false, text: reason })
            setMsg({ ok: true, text: room!.owner === deptId ? `Booked ${room!.name} on ${date}.` : `Request sent for ${room!.name} on ${date}.` })
            setPeriods([])
            setPurpose('')
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-terracotta bg-terracotta px-3 py-1.5 text-[13px] font-medium text-paper transition hover:opacity-90 disabled:opacity-40"
        >
          <CalendarPlus size={14} aria-hidden /> {room?.owner === deptId ? 'Book' : 'Request'}
        </button>
      </div>
      {msg && (
        <p role="status" className={`mt-2 text-[13px] ${msg.ok ? 'text-plum' : 'text-vermilion'}`}>
          {msg.text}
        </p>
      )}
    </section>
  )
}
