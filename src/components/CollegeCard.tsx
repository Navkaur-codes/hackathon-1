import { CalendarRange, Clock, Coffee, DoorOpen } from 'lucide-react'
import { summarizeCollege } from '../lib/structure'
import type { CollegeData } from '../types'
import { GeneratePanel } from './GeneratePanel'

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** Landing-page card for one college. Every figure comes from `summarizeCollege` (rule G2). */
export function CollegeCard({ data }: { data: CollegeData }) {
  const s = summarizeCollege(data)
  const stats = [
    { label: 'Departments', value: s.departments.length },
    { label: 'Sections', value: s.sections },
    { label: 'Students', value: s.students },
    { label: 'Subjects', value: s.subjects },
    { label: 'Teachers', value: s.teachers },
    { label: 'Rooms', value: s.rooms },
  ]

  return (
    <article data-college-card className="flex flex-col rounded-xl border border-rule bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className="font-mono text-[11px] tracking-[0.2em] text-vermilion uppercase">{data.college.code}</span>
          <h3 className="mt-1 font-display text-lg leading-snug font-semibold">{data.college.name}</h3>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5 sm:justify-end">
          {s.departments.map((code) => (
            <span key={code} className="rounded-full border border-rule px-2 py-0.5 font-mono text-[11px] text-muted">
              {code}
            </span>
          ))}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-rule py-4 min-[400px]:grid-cols-3">
        {stats.map((x) => (
          <div key={x.label} className="min-w-0">
            <dt className="truncate text-[11px] tracking-wide text-muted uppercase">{x.label}</dt>
            <dd className="font-display text-xl font-semibold tabular-nums">{x.value}</dd>
          </div>
        ))}
      </dl>

      <ul className="mt-4 space-y-1.5 text-[13px] text-muted">
        <li className="flex items-start gap-2">
          <CalendarRange size={14} className="mt-[3px] shrink-0" aria-hidden />
          <span>
            <span className="text-ink">{s.semester.name}</span> · {shortDate(s.semester.startDate)} –{' '}
            {shortDate(s.semester.endDate)} · {s.semester.teachingDays} teaching days ({s.semester.holidaysOnWorkingDays}{' '}
            holidays off)
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Clock size={14} className="mt-[3px] shrink-0" aria-hidden />
          <span>
            {s.dayRange} · {s.slotsPerDay} slots a day · <span className="font-mono whitespace-nowrap">{s.hours}</span>
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Coffee size={14} className="mt-[3px] shrink-0" aria-hidden />
          <span>{s.staggeredBreaks ? 'Staggered lunch — departments break at different times' : 'One common lunch break'}</span>
        </li>
        <li className="flex items-start gap-2">
          <DoorOpen size={14} className="mt-[3px] shrink-0" aria-hidden />
          <span>
            {s.sharedRooms} shared {s.sharedRooms === 1 ? 'room' : 'rooms'} competed for by every department
          </span>
        </li>
      </ul>

      <GeneratePanel college={data} />
    </article>
  )
}
