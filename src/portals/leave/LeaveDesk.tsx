import { useState } from 'react'
import gsap from 'gsap'
import { BadgeCheck, Check, CircleAlert, X } from 'lucide-react'
import { describeSlots } from '../../lib/exchange'
import { approveLeave, cancelApprovedLeave, confirmCover, coverOf, coverOptions, dateCheck, leaveInbox, rejectLeave, swapSubstitute, type LeaveOutcome } from '../../lib/leave'
import { dayFor, localIso } from '../../lib/myDay'
import { approveUnavailable, rejectUnavailable, unavailabilityInbox } from '../../lib/unavailability'
import { periodTimes } from '../../lib/structure'
import type { CollegeData, Id, LeaveRequest, Substitution } from '../../types'
import { dayLabel } from '../dayLabel'

type Act = (fn: (c: CollegeData) => LeaveOutcome | { ok: true; college: CollegeData } | { ok: false; reason: string }) => string | null
type Props = {
  college: CollegeData
  /** One department (HOD) or undefined for the whole college (College Admin). */
  deptId?: Id
  act: Act
  /** Role accent for primary buttons. */
  accent: 'terracotta' | 'vermilion'
}

const btn = 'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition'
const field = 'rounded-lg border border-rule bg-paper px-2 py-1 text-[13px]'
const now = () => new Date().toISOString()

/** A short glide on the changed row (GSAP; off under reduced motion). */
function glide(id: string) {
  requestAnimationFrame(() => {
    const el = document.getElementById(id)
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.fromTo(el, { x: -10, opacity: 0.3 }, { x: 0, opacity: 1, duration: 0.4, ease: 'power2.out', clearProps: 'transform,opacity' })
  })
}

/** Absence Mode for one approved leave: every class that date with its substitute, swap / confirm, verified stamp. */
function AbsencePanel({ college, leave, act }: { college: CollegeData; leave: LeaveRequest; act: Act }) {
  const [msg, setMsg] = useState<string | null>(null)
  const cover = coverOf(college, leave.id)
  const clashes = dateCheck(college, leave.date)
  const times = periodTimes(college.calendar)
  const a = (s: Substitution) => college.assignments.find((x) => x.id === s.assignmentId)
  const subject = (s: Substitution) => college.subjects.find((x) => x.id === a(s)?.subjectId)
  const section = (s: Substitution) => college.sections.find((x) => x.id === a(s)?.sectionId)
  const name = (id: Id | null) => (id ? (college.teachers.find((t) => t.id === id)?.name ?? id) : '')
  const uncovered = cover.filter((s) => s.status === 'uncovered').length

  return (
    <div className="mt-2 rounded-lg bg-paper p-3">
      <p className={`flex items-center gap-1.5 text-[13px] font-medium ${clashes.length ? 'text-vermilion' : 'text-plum'}`}>
        {clashes.length ? <CircleAlert size={15} aria-hidden /> : <BadgeCheck size={15} aria-hidden />}
        {clashes.length
          ? `${clashes.length} clash${clashes.length === 1 ? '' : 'es'} on ${dayLabel(leave.date)}: ${clashes[0].message}`
          : `${dayLabel(leave.date)} checked — 0 clashes${uncovered ? `, ${uncovered} class${uncovered === 1 ? '' : 'es'} without a teacher` : ''}`}
      </p>
      {cover.length === 0 ? (
        <p className="mt-1 text-[13px] text-muted">No classes that day — nothing to cover.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {cover.map((s) => {
            const options = coverOptions(college, s.id)
            const rowId = `cover-${s.id}`
            return (
              <li key={s.id} id={rowId} className={`rounded-md border p-2 text-[13px] ${s.status === 'uncovered' ? 'border-vermilion/50 bg-vermilion/5' : 'border-rule bg-card'}`}>
                <p>
                  <span className="font-mono text-[12px] text-muted">{times[s.period]?.start}</span> <strong>{subject(s)?.code}</strong> · {section(s)?.name}
                </p>
                {s.status === 'uncovered' ? (
                  <p className="text-vermilion">No one is free then — students see a notice. {options.length > 0 && 'Someone is free now:'}</p>
                ) : (
                  <p className="text-muted">{s.note}</p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {(options.length > 0 || s.substituteTeacherId) && (
                    <select
                      value={s.substituteTeacherId ?? ''}
                      aria-label={`Substitute for ${subject(s)?.code} at ${times[s.period]?.start}`}
                      onChange={(e) => {
                        const why = act((c) => swapSubstitute(c, s.id, e.target.value))
                        setMsg(why)
                        if (!why) glide(rowId)
                      }}
                      className={`${field} max-w-full min-w-0`}
                    >
                      {!s.substituteTeacherId && <option value="">Pick a free teacher…</option>}
                      {options.map((o) => (
                        <option key={o.teacherId} value={o.teacherId}>
                          {name(o.teacherId)} — {o.note}
                        </option>
                      ))}
                    </select>
                  )}
                  {s.status === 'suggested' && (
                    <button type="button" onClick={() => setMsg(act((c) => confirmCover(c, s.id)))} className={`${btn} border-plum text-plum`}>
                      <Check size={13} aria-hidden /> Confirm
                    </button>
                  )}
                  <span className="font-mono text-[10px] text-muted uppercase">{s.status === 'confirmed' ? 'confirmed' : s.status === 'suggested' ? 'suggested' : 'uncovered'}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {msg && (
        <p role="status" className="mt-2 text-[13px] text-vermilion">
          {msg}
        </p>
      )}
    </div>
  )
}

/** Leave inbox + Absence Mode, and teachers' unavailability requests — one department or the whole college. */
export function LeaveDesk({ college, deptId, act, accent }: Props) {
  const today = localIso(new Date())
  const inbox = leaveInbox(college, deptId, today)
  const unavail = unavailabilityInbox(college, deptId)
  const [reply, setReply] = useState<Record<Id, string>>({})
  const [open, setOpen] = useState<Id | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const teacher = (id: Id) => college.teachers.find((t) => t.id === id)
  const dept = (id: Id) => college.departments.find((d) => d.id === teacher(id)?.deptId)?.code
  const run = (fn: Parameters<Act>[0], done: string) => {
    const why = act(fn)
    setMsg(why ? { ok: false, text: why } : { ok: true, text: done })
    return !why
  }
  const who = (l: { teacherId: Id }) => (
    <>
      <span className="font-medium">{teacher(l.teacherId)?.name}</span>
      {!deptId && <span className="ml-1 font-mono text-[11px] text-muted">{dept(l.teacherId)}</span>}
    </>
  )
  const primary = accent === 'terracotta' ? 'border-terracotta bg-terracotta text-paper' : 'border-vermilion bg-vermilion text-paper'

  return (
    <div className="space-y-6">
      {!college.published && (
        <p className="rounded-lg bg-marigold/15 px-3 py-2 text-[13px]">Nothing is published yet — leave is decided on the published timetable teachers follow.</p>
      )}
      {msg && (
        <p role="status" className={`text-[13px] ${msg.ok ? 'text-plum' : 'text-vermilion'}`}>
          {msg.text}
        </p>
      )}

      <section aria-labelledby="lv-pending-h" className="rounded-xl border border-rule bg-card p-5">
        <h2 id="lv-pending-h" className="font-display text-lg font-semibold">
          Leave to decide {inbox.pending.length > 0 && <span className="ml-1 rounded-full bg-ink px-1.5 font-mono text-[11px] text-paper">{inbox.pending.length}</span>}
        </h2>
        {inbox.pending.length === 0 ? (
          <p className="mt-1 text-[13px] text-muted">Nothing waiting. Teachers ask from their desk, one date at a time.</p>
        ) : (
          <ul className="mt-2 divide-y divide-rule">
            {inbox.pending.map((l) => {
              const classes = dayFor(college, l.date, { kind: 'teacher', id: l.teacherId })?.classes.filter((x) => x.kind === 'own') ?? []
              return (
                <li key={l.id} className="space-y-1.5 py-3 text-[13px]">
                  <p>
                    {who(l)} · <span className="font-mono">{dayLabel(l.date)}</span> — “{l.reason}”
                  </p>
                  <p className="text-muted">
                    {classes.length
                      ? `Classes that day: ${classes.map((x) => `${x.start} ${x.subject.code} ${x.section.name}`).join(' · ')}`
                      : 'No classes that day in the published timetable.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (run((c) => approveLeave(c, l.id, now(), today), `Approved — ${classes.length} ${classes.length === 1 ? 'class' : 'classes'} covered below.`)) setOpen(l.id)
                      }}
                      className={`${btn} ${primary}`}
                    >
                      <Check size={13} aria-hidden /> Approve & cover
                    </button>
                    <input
                      value={reply[l.id] ?? ''}
                      onChange={(e) => setReply((r) => ({ ...r, [l.id]: e.target.value }))}
                      placeholder="Reply (if declining)"
                      aria-label="Reply"
                      className={`${field} min-w-0 flex-1`}
                    />
                    <button type="button" onClick={() => run((c) => rejectLeave(c, l.id, reply[l.id] ?? '', now()), 'Declined.')} className={`${btn} border-rule hover:border-ink`}>
                      <X size={13} aria-hidden /> Decline
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="lv-up-h" className="rounded-xl border border-rule bg-card p-5">
        <h2 id="lv-up-h" className="font-display text-lg font-semibold">
          Absence Mode — upcoming leave
        </h2>
        <p className="text-[13px] text-muted">Each class gets the best free teacher (same department → teaches the subject → knows the section → lightest day). Swap or confirm; the weekly timetable never changes.</p>
        {inbox.upcoming.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">No approved leave coming up.</p>
        ) : (
          <ul className="mt-2 divide-y divide-rule">
            {inbox.upcoming.map((l) => {
              const cover = coverOf(college, l.id)
              const unc = cover.filter((s) => s.status === 'uncovered').length
              return (
                <li key={l.id} className="py-3 text-[13px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setOpen(open === l.id ? null : l.id)} aria-expanded={open === l.id} className="min-w-0 flex-1 text-left">
                      {who(l)} · <span className="font-mono">{dayLabel(l.date)}</span> · {cover.length} {cover.length === 1 ? 'class' : 'classes'}
                      {unc > 0 && <span className="ml-1 text-vermilion">· {unc} uncovered</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Call off ${teacher(l.teacherId)?.name}'s leave on ${dayLabel(l.date)}? Their substitutes are released.`))
                          run((c) => cancelApprovedLeave(c, l.id, now()), 'Leave called off — the usual teacher takes the classes.')
                      }}
                      className={`${btn} border-rule hover:border-ink`}
                    >
                      Call off
                    </button>
                  </div>
                  {open === l.id && <AbsencePanel college={college} leave={l} act={act} />}
                </li>
              )
            })}
          </ul>
        )}
        {inbox.closed.length > 0 && (
          <details className="mt-3 text-[13px]">
            <summary className="cursor-pointer text-muted">Earlier and decided ({inbox.closed.length})</summary>
            <ul className="mt-2 divide-y divide-rule">
              {inbox.closed.map((l) => (
                <li key={l.id} className="py-1.5">
                  {who(l)} · {dayLabel(l.date)} · <span className="font-mono text-[11px] uppercase">{l.status === 'rejected' ? 'declined' : l.status === 'cancelled' ? 'called off' : l.status}</span>
                  {l.reply && <span className="text-muted"> — “{l.reply}”</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section aria-labelledby="lv-un-h" className="rounded-xl border border-rule bg-card p-5">
        <h2 id="lv-un-h" className="font-display text-base font-semibold">
          Unavailability requests
        </h2>
        <p className="text-[13px] text-muted">A teacher can no longer teach in some weekly slots. Approving changes their availability; the department goes back to Draft and needs a new generate.</p>
        {unavail.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">None.</p>
        ) : (
          <ul className="mt-2 divide-y divide-rule">
            {unavail.map((u) => (
              <li key={u.id} className="space-y-1 py-2.5 text-[13px]">
                <p>
                  {who(u)} · {describeSlots(college, u.slots)} — “{u.reason}”{' '}
                  {u.status !== 'pending' && <span className="font-mono text-[11px] text-muted uppercase">{u.status === 'rejected' ? 'declined' : u.status}</span>}
                </p>
                {u.status === 'pending' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => run((c) => approveUnavailable(c, u.id, now()), 'Approved — generate the department again.')} className={`${btn} ${primary}`}>
                      <Check size={13} aria-hidden /> Approve
                    </button>
                    <input
                      value={reply[u.id] ?? ''}
                      onChange={(e) => setReply((r) => ({ ...r, [u.id]: e.target.value }))}
                      placeholder="Reply (if declining)"
                      aria-label="Reply"
                      className={`${field} min-w-0 flex-1`}
                    />
                    <button type="button" onClick={() => run((c) => rejectUnavailable(c, u.id, reply[u.id] ?? '', now()), 'Declined.')} className={`${btn} border-rule hover:border-ink`}>
                      <X size={13} aria-hidden /> Decline
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
