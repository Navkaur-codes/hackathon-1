import { useState } from 'react'
import { BadgeCheck, CircleAlert, Loader2 } from 'lucide-react'
import { roomOptions } from '../../lib/allocation'
import { localIso } from '../../lib/myDay'
import { periodTimes } from '../../lib/structure'
import { conflictReport, type ConflictItem, type Fix } from '../../solver/conflicts'
import type { CollegeData, Id, Placement } from '../../types'
import { dayLabel } from '../dayLabel'

type Props = {
  college: CollegeData
  /** Each fix is an existing action; present only when this session may do it. */
  onGenerateDept?: (deptId: Id) => Promise<void>
  onGenerateAll?: () => Promise<void>
  onMoveRoom?: (placement: Placement, roomId: Id) => string | null
  onUnlock?: (placement: Placement) => string | null
  onLeave: () => void
}

const btn = 'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition disabled:opacity-40'

/** Every clash in one place, with who is involved and a button that fixes it. Reads; the fixes are existing actions. */
export function ConflictCenter({ college, onGenerateDept, onGenerateAll, onMoveRoom, onUnlock, onLeave }: Props) {
  const today = localIso(new Date())
  const report = conflictReport(college, today)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const times = periodTimes(college.calendar)
  const code = (id: Id) => college.departments.find((d) => d.id === id)?.code ?? id
  const describe = (p: Placement) => {
    const a = college.assignments.find((x) => x.id === p.assignmentId)
    const s = college.subjects.find((x) => x.id === a?.subjectId)?.code
    const sec = college.sections.find((x) => x.id === a?.sectionId)?.name
    const t = college.teachers.find((x) => x.id === a?.teacherId)?.name
    const r = college.rooms.find((x) => x.id === p.roomId)?.name
    return `${s} · ${sec} · ${t ?? 'no teacher'} · ${college.calendar.days[p.day]} ${times[p.period]?.start} · ${r}${p.locked ? ' · locked' : ''}`
  }
  const run = async (key: string, fn: () => Promise<void> | string | null, done: string) => {
    setBusy(key)
    setMsg(null)
    try {
      const why = await fn()
      setMsg(why ? { ok: false, text: why } : { ok: true, text: done })
    } finally {
      setBusy(null)
    }
  }

  const fixButton = (fix: Fix, item: ConflictItem, i: number) => {
    const key = `${item.rule}-${i}-${fix.kind}-${'deptId' in fix ? fix.deptId : ''}`
    const spin = busy === key ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null
    if (fix.kind === 'generateDept' && onGenerateDept)
      return (
        <button type="button" disabled={!!busy} onClick={() => run(key, () => onGenerateDept(fix.deptId), `${code(fix.deptId)} generated again.`)} className={`${btn} border-rule hover:border-ink`}>
          {spin} Generate {code(fix.deptId)}
        </button>
      )
    if (fix.kind === 'generateAll' && onGenerateAll)
      return (
        <button type="button" disabled={!!busy} onClick={() => run(key, onGenerateAll, 'Whole college generated again (locked classes kept).')} className={`${btn} border-rule hover:border-ink`}>
          {spin} Generate whole college
        </button>
      )
    if (fix.kind === 'unlock' && onUnlock)
      return (
        <button
          type="button"
          disabled={!!busy}
          onClick={() => run(key, () => fix.placements.map((p) => onUnlock(p)).find((x) => x) ?? null, 'Unlocked — generate again to move it.')}
          className={`${btn} border-ink bg-ink text-paper`}
        >
          Unlock {fix.placements.length > 1 ? `${fix.placements.length} classes` : 'the locked class'}
        </button>
      )
    if (fix.kind === 'moveRoom' && onMoveRoom) return <MoveRoom college={college} placement={fix.placement} onMove={(roomId) => run(key, () => onMoveRoom(fix.placement, roomId), 'Moved.')} />
    return null
  }

  const list = (title: string, note: string, rows: ConflictItem[], live: boolean) =>
    rows.length > 0 && (
      <section className="rounded-xl border border-vermilion/50 bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <CircleAlert size={18} className="text-vermilion" aria-hidden /> {title} <span className="rounded-full bg-vermilion px-1.5 font-mono text-[11px] text-paper">{rows.length}</span>
        </h2>
        <p className="text-[13px] text-muted">{note}</p>
        <ul className="mt-3 space-y-3">
          {rows.map((item, i) => (
            <li key={`${item.rule}-${i}`} className="rounded-lg border border-rule bg-paper p-3 text-[13px]">
              <p>
                <span className="mr-2 rounded bg-vermilion/10 px-1.5 font-mono text-[11px] text-vermilion">{item.rule}</span>
                {item.message}
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted">{item.deptIds.map(code).join(' · ') || 'college'}</p>
              <ul className="mt-1 text-[12px] text-muted">
                {item.placements.map((p) => (
                  <li key={`${p.assignmentId}-${p.day}-${p.period}`}>{describe(p)}</li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {live && <span className="text-[12px] text-muted">Fix it in the draft, then publish a new version:</span>}
                {item.fixes.map((f, j) => (
                  <span key={j}>{fixButton(f, item, i)}</span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>
    )

  return (
    <div className="space-y-6">
      {report.clean ? (
        <section className="flex items-center gap-3 rounded-xl border border-plum/40 bg-card p-5">
          <BadgeCheck size={28} className="text-plum" aria-hidden />
          <div>
            <p className="font-display text-lg font-semibold">No clashes anywhere</p>
            <p className="text-[13px] text-muted">The draft and the live version pass every hard rule against today’s data, and every upcoming leave day is covered.</p>
          </div>
        </section>
      ) : (
        report.blocked.length > 0 && (
          <section className="rounded-xl border border-rule bg-card p-5">
            <h2 className="font-display text-base font-semibold">Publishing is blocked</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px]">
              {report.blocked.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            {onGenerateAll && report.draft.length === 0 && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => run('blocked-all', onGenerateAll, 'Whole college generated again (locked classes kept).')}
                className={`${btn} mt-3 border-ink bg-ink text-paper`}
              >
                {busy === 'blocked-all' && <Loader2 size={12} className="animate-spin" aria-hidden />} Generate whole college
              </button>
            )}
          </section>
        )
      )}
      {msg && (
        <p role="status" className={`text-[13px] ${msg.ok ? 'text-plum' : 'text-vermilion'}`}>
          {msg.text}
        </p>
      )}
      {list('Clashes in the draft', 'The independent check found these. Each card names who is involved; pick a fix.', report.draft, false)}
      {list(
        'Clashes in the live version',
        `Version ${college.published?.version ?? ''} no longer fits today’s data (something changed after it was published). Teachers and students still follow it.`,
        report.published,
        true,
      )}
      {report.leaveDays.length > 0 && (
        <section className="rounded-xl border border-marigold bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Leave days that need you</h2>
          <ul className="mt-2 divide-y divide-rule text-[13px]">
            {report.leaveDays.map((d) => (
              <li key={d.leaveId} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <strong>{dayLabel(d.date)}</strong> · {college.teachers.find((t) => t.id === d.teacherId)?.name} on leave —{' '}
                  {d.uncovered.length > 0 && `${d.uncovered.length} ${d.uncovered.length === 1 ? 'class has' : 'classes have'} no substitute`}
                  {d.clashes.length > 0 && ` ${d.clashes.length} clash${d.clashes.length === 1 ? '' : 'es'}: ${d.clashes[0].message}`}
                </span>
                <button type="button" onClick={onLeave} className={`${btn} border-rule hover:border-ink`}>
                  Open Leave
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function MoveRoom({ college, placement, onMove }: { college: CollegeData; placement: Placement; onMove: (roomId: Id) => void }) {
  const options = roomOptions(college, placement).filter((o) => !o.current)
  const [to, setTo] = useState('')
  if (options.length === 0) return <span className="text-[12px] text-muted">No free room of this type and size then.</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Room to move to" className="max-w-full min-w-0 rounded-lg border border-rule bg-card px-2 py-1 text-[12px]">
        <option value="">Move to a free room…</option>
        {options.map((o) => (
          <option key={o.room.id} value={o.room.id}>
            {o.room.name} · {o.usable === 'own' ? 'own' : o.usable === 'shared' ? 'shared' : o.usable === 'loan' ? 'on loan' : 'will be allocated'}
          </option>
        ))}
      </select>
      <button type="button" disabled={!to} onClick={() => onMove(to)} className={`${btn} border-ink bg-ink text-paper`}>
        Move
      </button>
    </span>
  )
}
