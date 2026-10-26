import { useState } from 'react'
import { SlotGrid } from '../../components/SlotGrid'
import { setAccepting, teachingSlots, toggleOfficeHour, type SelfOutcome } from '../../lib/myDay'
import type { CollegeData, Id, SlotKey } from '../../types'

type Props = { college: CollegeData; teacherId: Id; act: (fn: (c: CollegeData) => SelfOutcome) => string | null }

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
  )
}
