import { useState, type ReactNode } from 'react'

// Small form fields for editors. Text and numbers commit on blur or Enter (not on every key), so a value
// being typed is never clamped half-way; Esc restores the saved value.

const inputCls = 'min-w-0 rounded-lg border border-rule bg-paper px-2.5 py-1.5 text-[14px] focus-visible:border-ink'
const labelCls = 'font-mono text-[11px] tracking-[0.15em] text-muted uppercase'

type CommitProps<T> = { value: T; onCommit: (v: T) => void; label: string; hideLabel?: boolean; className?: string; hint?: ReactNode }

function useDraft<T>(value: T) {
  const [draft, setDraft] = useState<string | null>(null)
  return { shown: draft ?? String(value ?? ''), editing: draft !== null, setDraft }
}

function Labelled({ label, hideLabel, hint, children }: { label: string; hideLabel?: boolean; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className={hideLabel ? 'sr-only' : labelCls}>{label}</span>
      {children}
      {hint && <span className="text-[12px] text-muted">{hint}</span>}
    </label>
  )
}

export function TextField({ value, onCommit, label, hideLabel, className = '', hint, placeholder }: CommitProps<string> & { placeholder?: string }) {
  const d = useDraft(value)
  const commit = () => {
    if (d.editing && d.shown !== value) onCommit(d.shown)
    d.setDraft(null)
  }
  return (
    <Labelled label={label} hideLabel={hideLabel} hint={hint}>
      <input
        value={d.shown}
        placeholder={placeholder}
        onChange={(e) => d.setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') d.setDraft(null)
        }}
        className={`${inputCls} ${className}`}
      />
    </Labelled>
  )
}

export function NumberField({
  value,
  onCommit,
  label,
  hideLabel,
  className = 'w-20',
  hint,
  min,
  max,
  allowEmpty = false,
}: CommitProps<number | undefined> & { min?: number; max?: number; allowEmpty?: boolean }) {
  const d = useDraft(value)
  const commit = () => {
    if (d.editing) {
      const raw = d.shown.trim()
      if (raw === '' && allowEmpty) onCommit(undefined)
      else if (raw !== '' && Number.isFinite(Number(raw)) && Number(raw) !== value) onCommit(Number(raw))
    }
    d.setDraft(null)
  }
  return (
    <Labelled label={label} hideLabel={hideLabel} hint={hint}>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={d.shown}
        onChange={(e) => d.setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') d.setDraft(null)
        }}
        className={`${inputCls} tabular-nums ${className}`}
      />
    </Labelled>
  )
}

/** A row of toggle chips (multi-select). */
export function Chips<T extends string | number>({
  options,
  selected,
  onToggle,
  label,
}: {
  options: { value: T; label: string; title?: string }[]
  selected: T[]
  onToggle: (v: T) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => {
        const on = selected.includes(o.value)
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            title={o.title}
            onClick={() => onToggle(o.value)}
            className={`rounded-full border px-2.5 py-1 text-[13px] transition ${on ? 'border-ink bg-ink text-paper' : 'border-rule text-ink hover:border-ink'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
