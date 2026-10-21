import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { fuzzyFilter } from '../lib/fuzzy'
import type { GridView } from '../lib/gridModel'
import type { CollegeData, Id } from '../types'

export type PaletteChoice = { kind: GridView; id: Id } | { kind: 'subject'; code: string }

type Item = { key: string; kind: GridView | 'subject'; title: string; hint: string; choice: PaletteChoice }

const KIND_LABEL: Record<Item['kind'], string> = { section: 'Section', teacher: 'Teacher', room: 'Room', subject: 'Subject' }
const MAX = 12

type Props = { college: CollegeData; onChoose: (c: PaletteChoice) => void; onClose: () => void }

/** Ctrl/⌘+K: fuzzy-find any section, teacher, room or subject; Enter jumps there. Keyboard first, Esc closes. */
export function CommandPalette({ college, onChoose, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)

  const items = useMemo<Item[]>(() => {
    const dept = new Map(college.departments.map((d) => [d.id, d.name]))
    const subjects = new Map<string, string>()
    for (const s of college.subjects) if (!subjects.has(s.code)) subjects.set(s.code, s.name)
    return [
      ...college.sections.map((s) => ({ key: `s:${s.id}`, kind: 'section' as const, title: s.name, hint: `${dept.get(s.deptId) ?? ''} · ${s.strength} students`, choice: { kind: 'section' as const, id: s.id } })),
      ...college.teachers.map((t) => ({ key: `t:${t.id}`, kind: 'teacher' as const, title: t.name, hint: dept.get(t.deptId) ?? '', choice: { kind: 'teacher' as const, id: t.id } })),
      ...college.rooms.map((r) => ({ key: `r:${r.id}`, kind: 'room' as const, title: r.name, hint: `${r.type} · ${r.capacity} seats · ${r.owner === 'shared' ? 'shared' : (dept.get(r.owner) ?? '')}`, choice: { kind: 'room' as const, id: r.id } })),
      ...[...subjects].map(([code, name]) => ({ key: `sub:${code}`, kind: 'subject' as const, title: `${code} · ${name}`, hint: 'filter the timetable', choice: { kind: 'subject' as const, code } })),
    ]
  }, [college])

  const results = useMemo(() => fuzzyFilter(items, query, (i) => i.title).slice(0, MAX), [items, query])
  const current = Math.min(active, Math.max(results.length - 1, 0))

  // focus the search box on open and give focus back to whatever had it on close
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    input.current?.focus()
    return () => before?.focus?.()
  }, [])
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [current])

  const choose = (i: Item | undefined) => {
    if (!i) return
    onChoose(i.choice)
    onClose()
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(results.length ? (current + 1) % results.length : 0)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(results.length ? (current - 1 + results.length) % results.length : 0)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(results[current])
    } else if (e.key === 'Tab') {
      e.preventDefault() // keep focus inside the dialog
    }
  }

  return (
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center bg-ink/30 px-4 pt-[12vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jump to a section, teacher, room or subject"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKey}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-rule bg-card shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-rule px-4">
          <Search size={16} className="text-muted" aria-hidden />
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={results[current] ? `pal-${results[current].key}` : undefined}
            aria-autocomplete="list"
            placeholder="Section, teacher, room or subject…"
            className="min-w-0 flex-1 bg-transparent py-3 text-[15px] outline-none placeholder:text-muted"
          />
          <kbd className="rounded border border-rule px-1.5 font-mono text-[10px] text-muted">Esc</kbd>
        </div>
        <ul ref={list} id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
          {results.length === 0 && <li className="px-4 py-3 text-[13px] text-muted">Nothing matches “{query}”.</li>}
          {results.map((r, i) => (
            <li
              key={r.key}
              id={`pal-${r.key}`}
              role="option"
              aria-selected={i === current}
              onMouseMove={() => setActive(i)}
              onClick={() => choose(r)}
              className={`flex cursor-pointer items-baseline gap-3 px-4 py-2 ${i === current ? 'bg-ink/[0.06]' : ''}`}
            >
              <span className="w-16 shrink-0 font-mono text-[10px] tracking-wider text-muted uppercase">{KIND_LABEL[r.kind]}</span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{r.title}</span>
              <span className="hidden truncate text-[12px] text-muted sm:block">{r.hint}</span>
            </li>
          ))}
        </ul>
        <p className="border-t border-rule px-4 py-2 font-mono text-[10px] tracking-wider text-muted uppercase">
          ↑ ↓ to move · Enter to open · Esc to close
        </p>
      </div>
    </div>
  )
}
