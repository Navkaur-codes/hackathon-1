import { useState } from 'react'
import { ArrowLeftRight, Check, Undo2, X } from 'lucide-react'
import { SlotGrid } from '../../components/SlotGrid'
import { DayBookings } from './DayBookings'
import { affectedBy, approve, describeSlots, loansOf, offerRoom, reject, requestRoom, revoke, unavailableSlots, type ExchangeOutcome } from '../../lib/exchange'
import type { CollegeData, Grant, Id, SlotKey } from '../../types'

type Props = {
  college: CollegeData
  deptId: Id
  /** Apply a Room Exchange action to the latest college; returns the refusal reason, or null when done. */
  act: (fn: (c: CollegeData) => ExchangeOutcome) => string | null
}

const btn = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition disabled:opacity-40'
const field = 'rounded-lg border border-rule bg-paper px-2.5 py-1.5 text-[14px]'
const small = 'font-mono text-[11px] tracking-[0.15em] text-muted uppercase'
const now = () => new Date().toISOString()
const ALLOCATED = { text: 'allocated', color: 'var(--vermilion)' }
const STATUS: Record<Grant['status'], { text: string; color: string }> = {
  requested: { text: 'asked', color: 'var(--gold)' },
  offered: { text: 'offered', color: 'var(--gold)' },
  approved: { text: 'on loan', color: 'var(--plum)' },
  rejected: { text: 'declined', color: 'var(--muted)' },
  revoked: { text: 'taken back', color: 'var(--muted)' },
}

/** Pick a room and weekly slots (busy, blocked or already-lent slots are locked), add a note, send. */
function SlotPicker({
  college,
  rooms,
  title,
  hint,
  action,
  targets,
  onSend,
}: {
  college: CollegeData
  rooms: CollegeData['rooms']
  title: string
  hint: string
  action: string
  /** Departments to choose from (offers); absent for requests. */
  targets?: CollegeData['departments']
  onSend: (roomId: Id, slots: SlotKey[], note: string, toDeptId?: Id) => string | null
}) {
  const [roomId, setRoomId] = useState<Id>(rooms[0]?.id ?? '')
  const [to, setTo] = useState<Id>(targets?.[0]?.id ?? '')
  const [slots, setSlots] = useState<SlotKey[]>([])
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const room = rooms.find((r) => r.id === roomId) ?? rooms[0]
  if (!room) return null
  const locked = unavailableSlots(college, room.id)
  const dept = (id: Id) => college.departments.find((d) => d.id === id)?.code ?? 'Shared'
  return (
    <section className="rounded-xl border border-rule bg-card p-5" aria-label={title}>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="text-[13px] text-muted">{hint}</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 max-w-full flex-col gap-1">
          <span className={small}>Room</span>
          <select
            value={room.id}
            onChange={(e) => {
              setRoomId(e.target.value)
              setSlots([])
              setMsg(null)
            }}
            className={`${field} max-w-full`}
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {r.type} · {r.capacity} seats · {dept(r.owner)}
              </option>
            ))}
          </select>
        </label>
        {targets && (
          <label className="flex min-w-0 max-w-full flex-col gap-1">
            <span className={small}>Offer to</span>
            <select value={to} onChange={(e) => setTo(e.target.value)} className={`${field} max-w-full`}>
              {targets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} · {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className="mt-3 text-[12px] text-muted">
        Click the weekly slots you want (striped = picked; hatched = in use, blocked or already lent). The loan repeats every week of the semester.
      </p>
      <div className="mt-1">
        <SlotGrid
          calendar={college.calendar}
          marked={slots}
          locked={locked}
          markLabel="picked"
          label={`Slots of ${room.name}`}
          onToggle={(k) => setSlots((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (e.g. Microprocessors practicals)" aria-label="Note" className={`${field} min-w-0 flex-1`} />
        <button
          type="button"
          disabled={slots.length === 0}
          onClick={() => {
            const reason = onSend(room.id, slots, note, targets ? to : undefined)
            setMsg(reason ? { ok: false, text: reason } : { ok: true, text: `${action} sent: ${room.name}, ${describeSlots(college, slots)}.` })
            if (!reason) {
              setSlots([])
              setNote('')
            }
          }}
          className={`${btn} border-terracotta bg-terracotta text-paper hover:opacity-90`}
        >
          <ArrowLeftRight size={14} aria-hidden /> {action} {slots.length ? `(${describeSlots(college, slots)})` : ''}
        </button>
      </div>
      {msg && (
        <p role="status" className={`mt-2 text-[13px] ${msg.ok ? 'text-plum' : 'text-vermilion'}`}>
          {msg.text}
        </p>
      )}
    </section>
  )
}

/** Room Exchange on the HOD desk: decide incoming loans, borrow a room, lend idle slots, see every loan. */
export function ExchangeTab({ college, deptId, act }: Props) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const code = (id: Id) => college.departments.find((d) => d.id === id)?.code ?? id
  const roomName = (id: Id) => college.rooms.find((r) => r.id === id)?.name ?? id
  const loans = loansOf(college, deptId)
  const waiting = loans.filter((g) => (g.status === 'requested' && g.fromDeptId === deptId) || (g.status === 'offered' && g.toDeptId === deptId))
  const others = college.rooms.filter((r) => r.owner !== 'shared' && r.owner !== deptId)
  const mine = college.rooms.filter((r) => r.owner === deptId)
  const run = (fn: (c: CollegeData) => ExchangeOutcome, done: string) => {
    const reason = act(fn)
    setMsg(reason ? { ok: false, text: reason } : { ok: true, text: done })
  }

  return (
    <div className="space-y-6">
      {msg && (
        <p role="status" className={`text-[13px] ${msg.ok ? 'text-plum' : 'text-vermilion'}`}>
          {msg.text}
        </p>
      )}

      <section aria-labelledby="waiting-h" className="rounded-xl border border-rule bg-card p-5">
        <h3 id="waiting-h" className="font-display text-base font-semibold">
          Waiting for you {waiting.length > 0 && <span className="ml-1 rounded-full bg-terracotta px-1.5 font-mono text-[11px] text-paper">{waiting.length}</span>}
        </h3>
        {waiting.length === 0 ? (
          <p className="mt-1 text-[13px] text-muted">Nothing to decide.</p>
        ) : (
          <ul className="mt-2 divide-y divide-rule">
            {waiting.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 text-[13px]">
                <span className="min-w-0 flex-1">
                  {g.status === 'requested' ? (
                    <>
                      <strong>{code(g.toDeptId)}</strong> asks for your <strong>{roomName(g.roomId)}</strong>
                    </>
                  ) : (
                    <>
                      <strong>{code(g.fromDeptId)}</strong> offers you <strong>{roomName(g.roomId)}</strong>
                    </>
                  )}{' '}
                  · {describeSlots(college, g.slots)}
                  {g.note && <span className="text-muted"> — “{g.note}”</span>}
                </span>
                <button type="button" onClick={() => run((c) => approve(c, g.id, deptId, now()), `${roomName(g.roomId)} is now on loan to ${code(g.toDeptId)}.`)} className={`${btn} border-ink bg-ink text-paper`}>
                  <Check size={14} aria-hidden /> {g.status === 'requested' ? 'Approve' : 'Accept'}
                </button>
                <button type="button" onClick={() => run((c) => reject(c, g.id, deptId, now()), 'Declined.')} className={`${btn} border-rule hover:border-ink`}>
                  <X size={14} aria-hidden /> Decline
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <DayBookings college={college} deptId={deptId} act={act} />

      {others.length > 0 && (
        <SlotPicker
          college={college}
          rooms={others}
          title="Borrow a room"
          hint="Ask another department for one of its rooms in chosen weekly slots. Once they approve, generate your department to use it."
          action="Request"
          onSend={(roomId, slots, note) => act((c) => requestRoom(c, deptId, roomId, slots, note, now()))}
        />
      )}
      {mine.length > 0 && (
        <SlotPicker
          college={college}
          rooms={mine}
          title="Lend my rooms"
          hint="Offer idle weekly slots of one of your rooms to another department."
          action="Offer"
          targets={college.departments.filter((d) => d.id !== deptId)}
          onSend={(roomId, slots, note, to) => act((c) => offerRoom(c, deptId, roomId, slots, to!, note, now()))}
        />
      )}

      <section aria-labelledby="loans-h" className="rounded-xl border border-rule bg-card p-5">
        <h3 id="loans-h" className="font-display text-base font-semibold">
          Your loans
        </h3>
        {loans.length === 0 ? (
          <p className="mt-1 text-[13px] text-muted">None yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-rule">
            {loans.map((g) => {
              const lending = g.fromDeptId === deptId
              const affected = g.status === 'approved' && lending ? affectedBy(college, g.id) : []
              const mineToWithdraw = (g.status === 'requested' && g.toDeptId === deptId) || (g.status === 'offered' && g.fromDeptId === deptId)
              return (
                <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 text-[13px]">
                  <span
                    className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase"
                    style={{ color: (g.kind === 'allocation' ? ALLOCATED : STATUS[g.status]).color, borderColor: (g.kind === 'allocation' ? ALLOCATED : STATUS[g.status]).color }}
                  >
                    {(g.kind === 'allocation' ? ALLOCATED : STATUS[g.status]).text}
                  </span>
                  <span className="min-w-0 flex-1">
                    {lending ? `${roomName(g.roomId)} → ${code(g.toDeptId)}` : `${roomName(g.roomId)} from ${code(g.fromDeptId)}`} · {describeSlots(college, g.slots)}
                    {g.note && <span className="text-muted"> — “{g.note}”</span>}
                    {g.kind === 'allocation' && <span className="text-muted"> — for the semester, by the College Admin</span>}
                  </span>
                  {g.status === 'approved' && lending && g.kind !== 'allocation' && (
                    <button
                      type="button"
                      onClick={() => {
                        const warn = affected.length
                          ? `${affected.length} ${affected.length === 1 ? 'class' : 'classes'} of ${code(g.toDeptId)} use this room in these slots and will need re-planning. Take it back?`
                          : `Take ${roomName(g.roomId)} back from ${code(g.toDeptId)}?`
                        if (window.confirm(warn)) run((c) => revoke(c, g.id, deptId, now()), `${roomName(g.roomId)} is back with you.`)
                      }}
                      className={`${btn} border-rule hover:border-ink`}
                    >
                      <Undo2 size={14} aria-hidden /> Take back{affected.length ? ` (${affected.length} ${affected.length === 1 ? 'class' : 'classes'} affected)` : ''}
                    </button>
                  )}
                  {mineToWithdraw && (
                    <button type="button" onClick={() => run((c) => reject(c, g.id, deptId, now()), 'Withdrawn.')} className={`${btn} border-rule hover:border-ink`}>
                      Withdraw
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
