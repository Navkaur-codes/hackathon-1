import { useState } from 'react'
import { CalendarOff } from 'lucide-react'
import { cancelLeave, localIso, requestLeave, type SelfOutcome } from '../../lib/myDay'
import { shortDate } from '../../lib/semester'
import { coverOf } from '../../lib/leave'
import { periodTimes } from '../../lib/structure'
import type { CollegeData, Id, LeaveRequest } from '../../types'

type Props = { college: CollegeData; teacherId: Id; act: (fn: (c: CollegeData) => SelfOutcome) => string | null }

const field = 'rounded-lg border border-rule bg-paper px-2.5 py-1.5 text-[14px]'
const STATUS: Record<LeaveRequest['status'], { text: string; color: string }> = {
  pending: { text: 'waiting for HOD', color: 'var(--gold)' },
  approved: { text: 'approved', color: 'var(--plum)' },
  rejected: { text: 'declined', color: 'var(--muted)' },
  cancelled: { text: 'called off', color: 'var(--muted)' },
}

/** Ask for leave on one date; the HOD approves and Kaalchakra allots substitutes (HOD screens in v0.7). */
export function LeaveTab({ college, teacherId, act }: Props) {
  const today = localIso(new Date())
  const first = today > college.semester.startDate ? today : college.semester.startDate
  const [date, setDate] = useState(first)
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const times = periodTimes(college.calendar)
  const nameOf = (id: Id) => college.teachers.find((t) => t.id === id)?.name ?? id
  const subjectOf = (assignmentId: Id) => {
    const a = college.assignments.find((x) => x.id === assignmentId)
    return `${college.subjects.find((x) => x.id === a?.subjectId)?.code ?? ''} · ${college.sections.find((x) => x.id === a?.sectionId)?.name ?? ''}`
  }
  const mine = college.leaves.filter((l) => l.teacherId === teacherId).sort((a, b) => b.date.localeCompare(a.date))

  const submit = () => {
    const why = act((c) => requestLeave(c, teacherId, date, reason, new Date().toISOString(), today))
    if (why) return setMsg({ ok: false, text: why })
    setMsg({ ok: true, text: `Leave asked for ${shortDate(date)}. Your HOD decides; your classes that day get a substitute.` })
    setReason('')
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="leave-h" className="rounded-xl border border-rule bg-card p-5">
        <h2 id="leave-h" className="font-display text-lg font-semibold">
          Ask for leave
        </h2>
        <p className="text-[13px] text-muted">
          For one date. Your HOD approves it and Kaalchakra finds a free teacher for each of your classes that day — the weekly timetable does not change.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Date</span>
            <input
              type="date"
              value={date}
              min={first}
              max={college.semester.endDate}
              onChange={(e) => {
                setDate(e.target.value)
                setMsg(null)
              }}
              className={field}
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Reason</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Conference at PU" className={`${field} min-w-0`} />
          </label>
          <button
            type="button"
            onClick={submit}
            className="inline-flex items-center gap-1.5 rounded-full border border-plum bg-plum px-3 py-1.5 text-[13px] font-medium text-paper transition hover:opacity-90"
          >
            <CalendarOff size={14} aria-hidden /> Ask for leave
          </button>
        </div>
        {msg && (
          <p role="status" className={`mt-2 text-[13px] ${msg.ok ? 'text-plum' : 'text-vermilion'}`}>
            {msg.text}
          </p>
        )}
      </section>

      <section aria-labelledby="myleave-h" className="rounded-xl border border-rule bg-card p-5">
        <h2 id="myleave-h" className="font-display text-base font-semibold">
          My leave
        </h2>
        {mine.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">No leave asked for yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-rule">
            {mine.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[13px]">
                <span className="w-16 font-mono text-[12px]">{shortDate(l.date)}</span>
                <span className="min-w-0 flex-1">
                  {l.reason}
                  {l.reply && <span className="block text-muted">HOD: “{l.reply}”</span>}
                  {l.status === 'approved' &&
                    coverOf(college, l.id).map((s) => (
                      <span key={s.id} className={`block text-[12px] ${s.substituteTeacherId ? 'text-muted' : 'text-vermilion'}`}>
                        {times[s.period]?.start} {subjectOf(s.assignmentId)} — {s.substituteTeacherId ? `covered by ${nameOf(s.substituteTeacherId)}` : 'no one free; students are told'}
                      </span>
                    ))}
                </span>
                <span
                  className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase"
                  style={{ color: STATUS[l.status].color, borderColor: STATUS[l.status].color }}
                >
                  {STATUS[l.status].text}
                </span>
                {l.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => {
                      const why = act((c) => cancelLeave(c, teacherId, l.id))
                      setMsg(why ? { ok: false, text: why } : { ok: true, text: 'Request taken back.' })
                    }}
                    className="rounded-full border border-rule px-2.5 py-1 text-[12px] font-medium transition hover:border-ink"
                  >
                    Take back
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
