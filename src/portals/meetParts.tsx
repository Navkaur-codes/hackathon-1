import type { Bookable } from '../lib/meetings'
import type { MeetingRequest } from '../types'

/** Shared bits of Meet-a-Teacher (student and teacher side). */

const MEETING_STATUS: Record<MeetingRequest['status'], { text: string; color: string }> = {
  pending: { text: 'waiting', color: 'var(--gold)' },
  accepted: { text: 'accepted', color: 'var(--plum)' },
  proposed: { text: 'new time offered', color: 'var(--terracotta)' },
  declined: { text: 'declined', color: 'var(--muted)' },
  withdrawn: { text: 'withdrawn', color: 'var(--muted)' },
  needsReschedule: { text: 'needs a new time', color: 'var(--vermilion)' },
}

export function StatusChip({ status }: { status: MeetingRequest['status'] }) {
  const s = MEETING_STATUS[status]
  return (
    <span className="rounded-full border px-2 py-0.5 font-mono text-[10px] whitespace-nowrap uppercase" style={{ color: s.color, borderColor: s.color }}>
      {s.text}
    </span>
  )
}

type PickerProps = { slots: Bookable[]; value: number | null; onPick: (p: number) => void; empty: string }

/** Free slots as chips; office hours marked. */
export function SlotPicker({ slots, value, onPick, empty }: PickerProps) {
  if (slots.length === 0) return <p className="text-[13px] text-muted">{empty}</p>
  return (
    <div role="radiogroup" aria-label="Free times" className="flex flex-wrap gap-1.5">
      {slots.map((b) => (
        <button
          key={b.period}
          type="button"
          role="radio"
          aria-checked={value === b.period}
          onClick={() => onPick(b.period)}
          title={b.officeHour ? 'Office hour' : `${b.start}–${b.end}`}
          className={`rounded-full border px-2.5 py-1 font-mono text-[12px] transition ${
            value === b.period ? 'border-ink bg-ink text-paper' : b.officeHour ? 'border-marigold bg-marigold/15 hover:border-ink' : 'border-rule hover:border-ink'
          }`}
        >
          {b.start}
          {b.officeHour && <span className="ml-1 font-sans text-[10px]">★ office hour</span>}
        </button>
      ))}
    </div>
  )
}
