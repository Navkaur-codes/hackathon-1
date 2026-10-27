import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { TextField } from '../../../components/fields'
import { setSemester } from '../../../lib/edit'
import { semesterSummary, shortDate } from '../../../lib/semester'
import type { CollegeData } from '../../../types'

type Props = { college: CollegeData; edit: (fn: (c: CollegeData) => CollegeData) => void }
type Day = { date: string; label: string }

const dateCls = 'rounded-lg border border-rule bg-paper px-2.5 py-1.5 text-[14px]'

function DayList({ title, hint, days, onChange }: { title: string; hint: string; days: Day[]; onChange: (d: Day[]) => void }) {
  const [date, setDate] = useState('')
  const [label, setLabel] = useState('')
  const add = () => {
    if (!date || days.some((d) => d.date === date)) return
    onChange([...days, { date, label: label.trim() || title.replace(/s$/, '') }].sort((a, b) => a.date.localeCompare(b.date)))
    setDate('')
    setLabel('')
  }
  return (
    <section aria-label={title}>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="mb-2 text-[13px] text-muted">{hint}</p>
      <ul className="divide-y divide-rule">
        {days.map((d) => (
          <li key={d.date} className="flex items-center gap-3 py-1.5 text-[14px]">
            <span className="w-24 font-mono text-[13px]">{shortDate(d.date)}</span>
            <span className="flex-1">{d.label}</span>
            <button
              type="button"
              aria-label={`Remove ${d.label} on ${d.date}`}
              onClick={() => onChange(days.filter((x) => x.date !== d.date))}
              className="rounded-full p-1.5 text-muted hover:bg-ink/5 hover:text-vermilion"
            >
              <Trash2 size={14} aria-hidden />
            </button>
          </li>
        ))}
        {days.length === 0 && <li className="py-1.5 text-[13px] text-muted">None.</li>}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={`${title}: date`} className={dateCls} />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="What is it?"
          aria-label={`${title}: name`}
          className={`${dateCls} w-48`}
        />
        <button type="button" onClick={add} disabled={!date} className="inline-flex items-center gap-1 rounded-full border border-rule px-3 py-1.5 text-[13px] hover:border-ink disabled:opacity-40">
          <Plus size={14} aria-hidden /> Add
        </button>
      </div>
    </section>
  )
}

/** Semester dates, holidays and no-class days — the weekly pattern rolls out over the real dates (rule G6). */
export function SemesterTab({ college, edit }: Props) {
  const sem = college.semester
  const s = semesterSummary(college)
  const bad = sem.endDate < sem.startDate
  return (
    <div className="space-y-8">
      <section aria-label="Semester dates">
        <div className="flex flex-wrap items-end gap-4">
          <TextField label="Semester name" value={sem.name} onCommit={(v) => v.trim() && edit((c) => setSemester(c, { name: v.trim() }))} className="w-56" />
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Starts</span>
            <input type="date" value={sem.startDate} onChange={(e) => e.target.value && edit((c) => setSemester(c, { startDate: e.target.value }))} className={dateCls} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Ends</span>
            <input type="date" value={sem.endDate} onChange={(e) => e.target.value && edit((c) => setSemester(c, { endDate: e.target.value }))} className={dateCls} />
          </label>
        </div>
        <p className={`mt-3 text-[14px] ${bad ? 'text-vermilion' : ''}`} aria-live="polite">
          {bad ? (
            'The semester ends before it starts.'
          ) : (
            <>
              <strong className="font-display text-lg">{s.teachingDays}</strong> teaching days over {s.weeks} weeks · {s.holidaysOnWorkingDays} holidays
              on working days · {s.noClassDays} no-class days
            </>
          )}
        </p>
      </section>
      <DayList title="Holidays" hint="No classes; delivered hours drop for the subjects that fall on them." days={sem.holidays} onChange={(holidays) => edit((c) => setSemester(c, { holidays }))} />
      <DayList
        title="No-class days"
        hint="Working days without regular classes — exams, fest, orientation."
        days={sem.noClassDates}
        onChange={(noClassDates) => edit((c) => setSemester(c, { noClassDates }))}
      />
    </div>
  )
}
