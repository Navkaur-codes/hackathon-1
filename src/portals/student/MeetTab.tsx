import { useState } from 'react'
import { Send } from 'lucide-react'
import { bookableSlots, meetingsOf, requestMeeting, takeProposal, teachersFor, withdrawMeeting, type Clock, type MeetOutcome } from '../../lib/meetings'
import { localIso } from '../../lib/myDay'
import { periodTimes } from '../../lib/structure'
import type { CollegeData, Id } from '../../types'
import { dayLabel } from '../dayLabel'
import { SlotPicker, StatusChip } from '../meetParts'

type Props = { college: CollegeData; sectionId: Id; studentName: string; act: (fn: (c: CollegeData) => MeetOutcome) => string | null }

const field = 'rounded-lg border border-rule bg-paper px-2.5 py-1.5 text-[14px]'
const small = 'font-mono text-[11px] tracking-[0.15em] text-muted uppercase'
const clockNow = (): Clock => {
  const d = new Date()
  return { today: localIso(d), minutes: d.getHours() * 60 + d.getMinutes() }
}

/** Meet a teacher: pick a teacher of your section, a date and a slot when you are both free; track your requests. */
export function MeetTab({ college, sectionId, studentName, act }: Props) {
  const clock = clockNow()
  const teachers = teachersFor(college, sectionId)
  const [teacherId, setTeacherId] = useState<Id>(teachers[0]?.teacher.id ?? '')
  const first = clock.today > college.semester.startDate ? clock.today : college.semester.startDate
  const [date, setDate] = useState(first)
  const [period, setPeriod] = useState<number | null>(null)
  const [topic, setTopic] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const slots = teacherId ? bookableSlots(college, teacherId, sectionId, date, clock) : []
  const mine = studentName.trim() ? meetingsOf(college, studentName, sectionId) : []
  const times = periodTimes(college.calendar)
  const name = (id: Id) => college.teachers.find((t) => t.id === id)?.name ?? id
  const room = (id: Id | undefined) => (id ? college.rooms.find((r) => r.id === id)?.name : undefined)
  const chosen = teachers.find((t) => t.teacher.id === teacherId)
  const run = (fn: (c: CollegeData) => MeetOutcome, done: string) => {
    const why = act(fn)
    setMsg(why ? { ok: false, text: why } : { ok: true, text: done })
    return !why
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="meet-h" className="rounded-xl border border-rule bg-card p-5">
        <h2 id="meet-h" className="font-display text-lg font-semibold">
          Meet a teacher
        </h2>
        <p className="text-[13px] text-muted">Times shown are when you are both free in the timetable. ★ marks the teacher’s office hours.</p>
        {!studentName.trim() && <p className="mt-2 rounded-lg bg-marigold/15 px-3 py-2 text-[13px]">Type your name at the top first — the teacher needs to know who is asking.</p>}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1">
            <span className={small}>Teacher</span>
            <select
              value={teacherId}
              onChange={(e) => {
                setTeacherId(e.target.value)
                setPeriod(null)
                setMsg(null)
              }}
              className={`${field} max-w-full min-w-0`}
            >
              {teachers.map((t) => (
                <option key={t.teacher.id} value={t.teacher.id}>
                  {t.teacher.name} · {t.teaches.length ? `teaches ${t.teaches.join(', ')}` : 'your department'}
                  {t.accepting ? '' : ' · not taking requests'}
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
                setPeriod(null)
                setMsg(null)
              }}
              className={field}
            />
          </label>
        </div>
        <div className="mt-3">
          <p className={`${small} mb-1`}>Free for both · {date && dayLabel(date)}</p>
          {chosen && !chosen.accepting ? (
            <p className="text-[13px] text-muted">{chosen.teacher.name} is not taking meeting requests right now.</p>
          ) : (
            <SlotPicker slots={slots} value={period} onPick={setPeriod} empty="No common free time that day (a holiday, a full day or already past) — try another date." />
          )}
        </div>
        <div className="mt-3 grid gap-2">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What about? (e.g. Doubts in trees)" aria-label="Topic" className={field} />
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note for the teacher (optional)" aria-label="Note" rows={2} className={field} />
          <div>
            <button
              type="button"
              disabled={period === null || !studentName.trim()}
              onClick={() => {
                if (
                  run(
                    (c) => requestMeeting(c, { studentName, sectionId, teacherId, date, period: period!, topic, note }, new Date().toISOString(), clockNow()),
                    `Asked ${name(teacherId)} for ${dayLabel(date)} at ${times[period!]?.start}.`,
                  )
                ) {
                  setPeriod(null)
                  setTopic('')
                  setNote('')
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink bg-ink px-3 py-1.5 text-[13px] font-medium text-paper transition hover:opacity-90 disabled:opacity-40"
            >
              <Send size={14} aria-hidden /> Ask for this time
            </button>
          </div>
        </div>
        {msg && (
          <p role="status" className={`mt-2 text-[13px] ${msg.ok ? 'text-plum' : 'text-vermilion'}`}>
            {msg.text}
          </p>
        )}
      </section>

      <section aria-labelledby="mine-h" className="rounded-xl border border-rule bg-card p-5">
        <h2 id="mine-h" className="font-display text-base font-semibold">
          My requests <span className="font-mono text-[11px] font-normal text-muted">at most {college.calendar.maxMeetingRequestsPerStudent} open at a time</span>
        </h2>
        {mine.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">{studentName.trim() ? 'None yet.' : 'Type your name to see your requests.'}</p>
        ) : (
          <ul className="mt-2 divide-y divide-rule">
            {mine.map((m) => (
              <li key={m.id} className="space-y-1 py-3 text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip status={m.status} />
                  <span className="font-medium">{name(m.teacherId)}</span>
                  <span className="text-muted">
                    {dayLabel(m.date)} · {times[m.period]?.start}
                    {room(m.roomId) && ` · ${room(m.roomId)}`}
                  </span>
                </div>
                <p>“{m.topic}”</p>
                {m.reply && <p className="text-muted">Teacher: “{m.reply}”</p>}
                {m.status === 'needsReschedule' && <p className="text-vermilion">A new timetable puts a class at that time — ask again for another time.</p>}
                <div className="flex flex-wrap gap-2">
                  {m.status === 'proposed' && m.proposed && (
                    <button
                      type="button"
                      onClick={() => run((c) => takeProposal(c, studentName, sectionId, m.id, new Date().toISOString(), clockNow()), 'Meeting fixed at the new time.')}
                      className="rounded-full border border-plum bg-plum px-2.5 py-1 text-[12px] font-medium text-paper"
                    >
                      Take {dayLabel(m.proposed.date)} · {times[m.proposed.period]?.start}
                    </button>
                  )}
                  {(m.status === 'pending' || m.status === 'proposed' || m.status === 'accepted' || m.status === 'needsReschedule') && (
                    <button
                      type="button"
                      onClick={() => run((c) => withdrawMeeting(c, studentName, sectionId, m.id, new Date().toISOString()), 'Withdrawn.')}
                      className="rounded-full border border-rule px-2.5 py-1 text-[12px] font-medium transition hover:border-ink"
                    >
                      Withdraw
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
