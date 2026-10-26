import { useState } from 'react'
import { Check, Clock3, X } from 'lucide-react'
import { acceptMeeting, bookableSlots, declineMeeting, inboxOf, meetingRooms, proposeMeeting, type Clock, type MeetOutcome } from '../../lib/meetings'
import { localIso } from '../../lib/myDay'
import { periodTimes } from '../../lib/structure'
import type { CollegeData, Id, MeetingRequest } from '../../types'
import { dayLabel } from '../dayLabel'
import { SlotPicker, StatusChip } from '../meetParts'

type Props = { college: CollegeData; teacherId: Id; act: (fn: (c: CollegeData) => MeetOutcome) => string | null }

const btn = 'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition'
const field = 'rounded-lg border border-rule bg-paper px-2.5 py-1 text-[13px]'
const clockNow = (): Clock => {
  const d = new Date()
  return { today: localIso(d), minutes: d.getHours() * 60 + d.getMinutes() }
}

/** One request waiting for an answer: accept (with a room), propose another time, or decline — with a reply. */
function Answer({ college, teacherId, m, act }: { college: CollegeData; teacherId: Id; m: MeetingRequest; act: Props['act'] }) {
  const [mode, setMode] = useState<'accept' | 'propose' | null>(m.status === 'needsReschedule' ? 'propose' : null)
  const [reply, setReply] = useState('')
  const [roomId, setRoomId] = useState('')
  const [date, setDate] = useState(m.date)
  const [period, setPeriod] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const now = () => new Date().toISOString()
  const rooms = meetingRooms(college, m.date, m.period, m.id)
  const slots = bookableSlots(college, teacherId, m.sectionId, date, clockNow(), m.id)
  const run = (fn: (c: CollegeData) => MeetOutcome) => setMsg(act(fn))

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-paper p-3">
      <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to the student (optional)" aria-label="Reply" className={`${field} w-full`} />
      <div className="flex flex-wrap gap-2">
        {m.status === 'pending' && (
          <button type="button" onClick={() => setMode('accept')} aria-pressed={mode === 'accept'} className={`${btn} border-plum ${mode === 'accept' ? 'bg-plum text-paper' : 'text-plum'}`}>
            <Check size={13} aria-hidden /> Accept
          </button>
        )}
        <button type="button" onClick={() => setMode('propose')} aria-pressed={mode === 'propose'} className={`${btn} border-rule ${mode === 'propose' ? 'bg-ink text-paper' : 'hover:border-ink'}`}>
          <Clock3 size={13} aria-hidden /> Another time
        </button>
        <button type="button" onClick={() => run((c) => declineMeeting(c, teacherId, m.id, reply, now()))} className={`${btn} border-rule hover:border-ink`}>
          <X size={13} aria-hidden /> Decline
        </button>
      </div>
      {mode === 'accept' && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)} aria-label="Room" className={`${field} max-w-full min-w-0`}>
            <option value="">No room (staff room / cabin)</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · free then
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => run((c) => acceptMeeting(c, teacherId, m.id, roomId || undefined, reply, now(), clockNow()))}
            className={`${btn} border-plum bg-plum text-paper`}
          >
            Confirm
          </button>
        </div>
      )}
      {mode === 'propose' && (
        <div className="space-y-2">
          <input type="date" value={date} min={clockNow().today} max={college.semester.endDate} onChange={(e) => setDate(e.target.value)} aria-label="Date" className={field} />
          <SlotPicker slots={slots} value={period} onPick={setPeriod} empty="No common free time that day — try another date." />
          <button
            type="button"
            disabled={period === null}
            onClick={() => run((c) => proposeMeeting(c, teacherId, m.id, date, period!, reply, now(), clockNow()))}
            className={`${btn} border-ink bg-ink text-paper disabled:opacity-40`}
          >
            Offer this time
          </button>
        </div>
      )}
      {msg && (
        <p role="status" className="text-[13px] text-vermilion">
          {msg}
        </p>
      )}
    </div>
  )
}

/** The teacher's meeting requests: only their own (root §3). */
export function MeetingsTab({ college, teacherId, act }: Props) {
  const all = inboxOf(college, teacherId)
  const today = localIso(new Date())
  const times = periodTimes(college.calendar)
  const section = (id: Id) => college.sections.find((s) => s.id === id)?.name ?? id
  const room = (id: Id | undefined) => (id ? college.rooms.find((r) => r.id === id)?.name : undefined)
  const toAnswer = all.filter((m) => m.status === 'pending' || m.status === 'needsReschedule')
  const upcoming = all.filter((m) => (m.status === 'accepted' || m.status === 'proposed') && (m.proposed?.date ?? m.date) >= today)
  const closed = all.filter((m) => !toAnswer.includes(m) && !upcoming.includes(m)).reverse()
  const line = (m: MeetingRequest) => (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={m.status} />
        <span className="font-medium">{m.studentName}</span>
        <span className="text-muted">
          {section(m.sectionId)} · {dayLabel(m.date)} · {times[m.period]?.start}
          {room(m.roomId) && ` · ${room(m.roomId)}`}
          {m.status === 'proposed' && m.proposed && ` → offered ${dayLabel(m.proposed.date)} · ${times[m.proposed.period]?.start}`}
        </span>
      </div>
      <p>
        “{m.topic}”{m.note && <span className="text-muted"> — {m.note}</span>}
      </p>
      {m.status === 'needsReschedule' && <p className="text-vermilion">The new timetable puts a class at that time — offer another time or decline.</p>}
    </>
  )

  return (
    <div className="space-y-6">
      <section aria-labelledby="ask-h" className="rounded-xl border border-rule bg-card p-5">
        <h2 id="ask-h" className="font-display text-lg font-semibold">
          To answer {toAnswer.length > 0 && <span className="ml-1 rounded-full bg-plum px-1.5 font-mono text-[11px] text-paper">{toAnswer.length}</span>}
        </h2>
        {toAnswer.length === 0 ? (
          <p className="mt-1 text-[13px] text-muted">Nothing waiting. Students ask from their desk, only in times when you are both free.</p>
        ) : (
          <ul className="mt-2 divide-y divide-rule">
            {toAnswer.map((m) => (
              <li key={m.id} className="space-y-1 py-3 text-[13px]">
                {line(m)}
                <Answer college={college} teacherId={teacherId} m={m} act={act} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="up-h" className="rounded-xl border border-rule bg-card p-5">
        <h2 id="up-h" className="font-display text-base font-semibold">
          Coming up
        </h2>
        {upcoming.length === 0 ? (
          <p className="mt-1 text-[13px] text-muted">No meetings fixed.</p>
        ) : (
          <ul className="mt-2 divide-y divide-rule">
            {upcoming.map((m) => (
              <li key={m.id} className="space-y-1 py-2.5 text-[13px]">
                {line(m)}
              </li>
            ))}
          </ul>
        )}
        {closed.length > 0 && (
          <details className="mt-3 text-[13px]">
            <summary className="cursor-pointer text-muted">Earlier and closed ({closed.length})</summary>
            <ul className="mt-2 divide-y divide-rule">
              {closed.map((m) => (
                <li key={m.id} className="space-y-1 py-2">
                  {line(m)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  )
}
