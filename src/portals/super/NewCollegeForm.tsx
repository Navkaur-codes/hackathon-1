import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cloneCollege, codeProblem, newCollege } from '../../lib/edit'
import type { CollegeData } from '../../types'

type Props = {
  colleges: CollegeData[]
  onCreate: (c: CollegeData) => void
  onCancel: () => void
}

/** Local calendar date as ISO (the semester of a blank college starts today). */
const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const inputCls = 'w-full rounded-lg border border-rule bg-paper px-3 py-2 text-[14px]'
const labelCls = 'font-mono text-[11px] tracking-[0.15em] text-muted uppercase'

/** Name + code → a blank template college, or a copy of an existing college's structure and setup. */
export function NewCollegeForm({ colleges, onCreate, onCancel }: Props) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [from, setFrom] = useState('blank')
  const [tried, setTried] = useState(false)
  const nameInput = useRef<HTMLInputElement>(null)
  useEffect(() => nameInput.current?.focus(), [])

  const problem = !name.trim() ? 'Give the college a name.' : codeProblem(code, colleges)
  const source = colleges.find((c) => c.college.id === from)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (problem) return
    onCreate(source ? cloneCollege(source, code.trim(), name.trim()) : newCollege(code.trim(), name.trim(), todayIso()))
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      aria-labelledby="new-college-h"
      className="rounded-xl border border-ink bg-card p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="new-college-h" className="font-display text-lg font-semibold">
            New college
          </h2>
          <p className="text-[13px] text-muted">Start blank and shape it in the Structure Builder, or copy a college you already run.</p>
        </div>
        <button type="button" onClick={onCancel} aria-label="Cancel" className="rounded-full p-1.5 text-muted hover:bg-ink/5 hover:text-ink">
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[2fr_1fr]">
        <label className="block">
          <span className={labelCls}>Name</span>
          <input
            ref={nameInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Guru Nanak Dev Engineering College"
            className={`mt-1 ${inputCls}`}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Short code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="GNDEC"
            maxLength={16}
            className={`mt-1 font-mono ${inputCls}`}
          />
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className={labelCls}>Start from</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {[{ id: 'blank', label: 'Blank template (5 days × 6 slots)' }, ...colleges.map((c) => ({ id: c.college.id, label: `Copy of ${c.college.code}` }))].map(
            (o) => (
              <label
                key={o.id}
                className={`cursor-pointer rounded-full border px-3 py-1.5 text-[13px] transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-vermilion ${
                  from === o.id ? 'border-ink bg-ink text-paper' : 'border-rule hover:border-ink'
                }`}
              >
                <input type="radio" name="from" value={o.id} checked={from === o.id} onChange={() => setFrom(o.id)} className="sr-only" />
                {o.label}
              </label>
            ),
          )}
        </div>
        <p className="mt-2 text-[12px] text-muted">
          {source
            ? `Copies ${source.college.code}'s calendar, departments, programmes, sections, subjects, teachers, rooms and teacher choices — not its timetable, leave or meetings.`
            : 'One department, one programme, one section, two subjects, two teachers and a room — enough to generate, ready to reshape.'}
        </p>
      </fieldset>

      {tried && problem && (
        <p role="alert" className="mt-3 text-[13px] text-vermilion">
          {problem}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90">
          Create college
        </button>
        <button type="button" onClick={onCancel} className="rounded-full border border-rule px-4 py-2 text-sm transition hover:border-ink">
          Cancel
        </button>
      </div>
    </form>
  )
}
