import { Plus, Trash2 } from 'lucide-react'
import { Chips, TextField } from '../../../components/fields'
import { periodTimes } from '../../../lib/structure'
import type { BreakRule, Calendar } from '../../../types'

type Props = {
  calendar: Calendar
  /** undefined = inherits from the level above (only when `inheritFrom` is given). */
  rules: BreakRule[] | undefined
  onChange: (rules: BreakRule[] | undefined) => void
  /** e.g. "the college" — shows an "own breaks / same as …" switch. */
  inheritFrom?: string
}

/**
 * Break rules on the shared slot grid (root H7): a fixed slot, or a choice of slots the solver picks per day
 * (flexible lunch). Each rule applies to every working day or only some days, e.g. lunch at P4 Mon–Wed
 * and P5 Thu–Sat.
 */
export function BreakEditor({ calendar, rules, onChange, inheritFrom }: Props) {
  const times = periodTimes(calendar)
  const slotOpts = times.map((t) => ({ value: t.index, label: `P${t.index + 1}`, title: `${t.start}–${t.end}` }))
  const dayOpts = calendar.days.map((d, i) => ({ value: i, label: d }))
  const list = rules ?? []
  const set = (i: number, r: BreakRule) => onChange(list.map((x, j) => (j === i ? r : x)))
  const toggle = (arr: number[], v: number) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v].sort((a, b) => a - b))

  if (inheritFrom && rules === undefined)
    return (
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
        Same breaks as {inheritFrom}.
        <button
          type="button"
          onClick={() => onChange([{ period: calendar.breaks[0]?.period ?? 0, label: 'Lunch' }])}
          className="rounded-full border border-rule px-2.5 py-1 text-[13px] text-ink hover:border-ink"
        >
          Set its own breaks
        </button>
      </div>
    )

  return (
    <div className="space-y-3">
      {list.length === 0 && <p className="text-[13px] text-muted">No breaks — every slot is teachable.</p>}
      {list.map((r, i) => {
        const flexible = (r.options?.length ?? 0) > 1
        const allDays = r.days === undefined
        return (
          <div key={i} className="rounded-lg border border-rule p-3">
            <div className="flex flex-wrap items-end gap-3">
              <TextField label="Name" value={r.label ?? ''} placeholder="Lunch" onCommit={(v) => set(i, { ...r, label: v.trim() || undefined })} className="w-32" />
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Kind</span>
                <Chips
                  label="Kind of break"
                  options={[
                    { value: 'fixed', label: 'Fixed slot' },
                    { value: 'flex', label: 'Solver picks one of…' },
                  ]}
                  selected={[flexible ? 'flex' : 'fixed']}
                  onToggle={(v) =>
                    v === 'flex'
                      ? set(i, { ...r, options: [r.period, Math.min(r.period + 1, calendar.periodsPerDay - 1)].filter((p, k, a) => a.indexOf(p) === k) })
                      : set(i, { period: r.period, ...(r.days ? { days: r.days } : {}), ...(r.label ? { label: r.label } : {}) })
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => onChange(list.filter((_, j) => j !== i))}
                aria-label={`Remove break ${r.label ?? i + 1}`}
                className="ml-auto rounded-full p-2 text-muted hover:bg-ink/5 hover:text-vermilion"
              >
                <Trash2 size={15} aria-hidden />
              </button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">{flexible ? 'Options' : 'Slot'}</span>
                {flexible ? (
                  <>
                    <Chips
                      label="Option slots"
                      options={slotOpts}
                      selected={r.options!}
                      onToggle={(p) => {
                        const options = toggle(r.options!, p)
                        if (options.length === 0) return
                        set(i, { ...r, options, period: options.includes(r.period) ? r.period : options[0] })
                      }}
                    />
                    <label className="flex items-center gap-2 text-[13px]">
                      Preferred
                      <select value={r.period} onChange={(e) => set(i, { ...r, period: Number(e.target.value) })} className="rounded-lg border border-rule bg-paper px-2 py-1">
                        {r.options!.map((p) => (
                          <option key={p} value={p}>
                            P{p + 1} · {times[p]?.start}
                          </option>
                        ))}
                      </select>
                    </label>
                    {r.options!.length < 2 && <span className="text-[12px] text-vermilion">Pick at least two slots, or make it a fixed break.</span>}
                  </>
                ) : (
                  <select
                    value={r.period}
                    onChange={(e) => set(i, { ...r, period: Number(e.target.value) })}
                    className="w-40 rounded-lg border border-rule bg-paper px-2 py-1.5 text-[14px]"
                    aria-label="Break slot"
                  >
                    {times.map((t) => (
                      <option key={t.index} value={t.index}>
                        P{t.index + 1} · {t.start}–{t.end}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Days</span>
                <Chips
                  label="Days this break applies"
                  options={[{ value: -1, label: 'Every day' }, ...dayOpts]}
                  selected={allDays ? [-1] : r.days!}
                  onToggle={(d) => {
                    if (d === -1) return set(i, { ...r, days: undefined })
                    const days = toggle(allDays ? [] : r.days!, d)
                    set(i, { ...r, days: days.length === 0 || days.length === calendar.days.length ? undefined : days })
                  }}
                />
              </div>
            </div>
          </div>
        )
      })}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange([...list, { period: 0, label: 'Break' }])}
          className="inline-flex items-center gap-1.5 rounded-full border border-rule px-3 py-1.5 text-[13px] hover:border-ink"
        >
          <Plus size={14} aria-hidden /> Add a break
        </button>
        {inheritFrom && (
          <button type="button" onClick={() => onChange(undefined)} className="rounded-full px-3 py-1.5 text-[13px] text-muted hover:text-ink">
            Use the same breaks as {inheritFrom}
          </button>
        )}
      </div>
    </div>
  )
}
