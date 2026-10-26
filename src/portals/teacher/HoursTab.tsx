import { useState } from 'react'
import { SlotGrid } from '../../components/SlotGrid'
import { setAccepting, teachingSlots, toggleOfficeHour, type SelfOutcome } from '../../lib/myDay'
import { describeSlots } from '../../lib/exchange'
import { requestUnavailable, unavailabilityInbox, withdrawUnavailable, type UnavailOutcome } from '../../lib/unavailability'
import type { CollegeData, Id, SlotKey } from '../../types'

type Props = { college: CollegeData; teacherId: Id; act: (fn: (c: CollegeData) => SelfOutcome | UnavailOutcome) => string | null }

/** Office hours: free weekly slots when students may find the teacher; highlighted for Meet-a-Teacher. */
export function HoursTab({ college, teacherId, act }: Props) {
  const [msg, setMsg] = useState<string | null>(null)
  const hours = college.officeHours.find((o) => o.teacherId === teacherId)
  const teacher = college.teachers.find((t) => t.id === teacherId)!
  const locked = new Map<SlotKey, string>(teachingSlots(college, teacherId))
  for (const k of teacher.unavailable) if (!locked.has(k)) locked.set(k, 'unavailable')
  for (const k of college.calendar.blockedSlots) if (!locked.has(k)) locked.set(k, 'blocked for the college')
  const accepting = hours?.accepting ?? true

  return (
    <>
    <section aria-labelledby="hours-h" className="rounded-xl border border-rule bg-card p-5">
      <h2 id="hours-h" className="font-display text-lg font-semibold">
        Office hours
      </h2>
      <p className="text-[13px] text-muted">
        Mark free slots of your week when students can find you. Your classes are locked. Students will see these highlighted when they ask for a
        meeting.
      </p>
      <label className="mt-3 inline-flex items-center gap-2 text-[14px]">
        <input
          type="checkbox"
          checked={accepting}
          onChange={(e) => setMsg(act((c) => setAccepting(c, teacherId, e.target.checked)))}
          className="size-4 accent-[var(--plum)]"
        />
        Accepting meeting requests
      </label>
      <div className="mt-3">
        <SlotGrid
          calendar={college.calendar}
          marked={hours?.slots ?? []}
          onToggle={(k) => setMsg(act((c) => toggleOfficeHour(c, teacherId, k)))}
          markLabel="office hour"
          label="Office hours"
          locked={locked}
        />
      </div>
      <p className="mt-2 text-[12px] text-muted">
        {(hours?.slots.length ?? 0) === 0 ? 'No office hours yet.' : `${hours!.slots.length} office ${hours!.slots.length === 1 ? 'hour' : 'hours'} a week.`}
      </p>
      {msg && (
        <p role="status" className="mt-1 text-[13px] text-vermilion">
          {msg}
        </p>
      )}
    </section>
    <Unavailable college={college} teacherId={teacherId} act={act} />
    </>
  )
}

/** Ask the HOD to be unavailable in some weekly slots from now on (rule H6); see the answers. */
function Unavailable({ college, teacherId, act }: Props) {
  const [picked, setPicked] = useState<SlotKey[]>([])
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const teacher = college.teachers.find((t) => t.id === teacherId)!
  const mine = unavailabilityInbox(college).filter((u) => u.teacherId === teacherId)
  const already = new Map<SlotKey, string>(teacher.unavailable.map((k) => [k, 'already unavailable']))
  return (
    <section aria-labelledby="unav-h" className="mt-6 rounded-xl border border-rule bg-card p-5">
      <h2 id="unav-h" className="font-display text-base font-semibold">
        Ask to be unavailable
      </h2>
      <p className="text-[13px] text-muted">
        Can no longer teach in some weekly slots (an evening course, a duty elsewhere)? Pick them and say why — your HOD decides, then the timetable is generated again.
      </p>
      <div className="mt-3">
        <SlotGrid
          calendar={college.calendar}
          marked={picked}
          onToggle={(k) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))}
          markLabel="asked"
          label="Slots to ask for"
          locked={already}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why?" aria-label="Reason" className="min-w-0 flex-1 rounded-lg border border-rule bg-paper px-2.5 py-1.5 text-[14px]" />
        <button
          type="button"
          disabled={picked.length === 0}
          onClick={() => {
            const why = act((c) => requestUnavailable(c, teacherId, picked, reason, new Date().toISOString()))
            setMsg(why ? { ok: false, text: why } : { ok: true, text: 'Sent to your HOD.' })
            if (!why) {
              setPicked([])
              setReason('')
            }
          }}
          className="rounded-full border border-plum bg-plum px-3 py-1.5 text-[13px] font-medium text-paper transition hover:opacity-90 disabled:opacity-40"
        >
          Ask the HOD
        </button>
      </div>
      {msg && (
        <p role="status" className={`mt-2 text-[13px] ${msg.ok ? 'text-plum' : 'text-vermilion'}`}>
          {msg.text}
        </p>
      )}
      {mine.length > 0 && (
        <ul className="mt-3 divide-y divide-rule border-t border-rule">
          {mine.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[13px]">
              <span className="min-w-0 flex-1">
                {describeSlots(college, u.slots)} — “{u.reason}”{u.reply && <span className="text-muted"> · HOD: “{u.reply}”</span>}
              </span>
              <span className="font-mono text-[10px] text-muted uppercase">{u.status === 'pending' ? 'waiting for HOD' : u.status === 'rejected' ? 'declined' : 'approved'}</span>
              {u.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => setMsg(act((c) => withdrawUnavailable(c, teacherId, u.id)) ? { ok: false, text: 'Could not take it back.' } : { ok: true, text: 'Taken back.' })}
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
  )
}
