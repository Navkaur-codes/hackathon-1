import { useState } from 'react'
import { CircleAlert, Download, EyeOff, Send } from 'lucide-react'
import { publish, publishCheck, unpublish } from '../../lib/publish'
import { PublicLinks } from '../../components/PublicLinks'
import { exportCollege, exportFileName } from '../../lib/transfer'
import type { CollegeData } from '../../types'
import type { Edit } from './setup/tabs'

type Props = {
  college: CollegeData
  /** From lib/access.ts: present only when this session may do it. */
  canPublish: boolean
  canExport: boolean
  edit?: Edit
  /** Open the Conflict Center (shown when publishing is blocked). */
  onConflicts?: () => void
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const btn = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition disabled:opacity-40'

/** Publish the draft as a version teachers and students follow; unpublish; history; export / import. */
export function PublishPanel({ college, canPublish, canExport, edit, onConflicts }: Props) {
  const check = publishCheck(college)
  const pub = college.published
  const log = college.publishLog ?? []
  const draftIsLive = !!pub && !!college.draft && JSON.stringify(pub.timetable) === JSON.stringify(college.draft)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const doPublish = () => {
    if (!edit) return
    const accept = check.unplaced > 0
    if (accept && !window.confirm(`${check.unplaced} periods are not placed. Publish this version anyway?`)) return
    const now = new Date().toISOString()
    const r = publish(college, now, { acceptUnplaced: accept })
    if (!r.ok) return setMessage({ ok: false, text: r.reasons.join(' ') })
    edit(() => r.college)
    setMessage({ ok: true, text: `Published version ${r.college.published!.version}. Teachers and students now follow it.` })
  }
  const doUnpublish = () => {
    if (!edit || !pub) return
    if (!window.confirm(`Take version ${pub.version} down? Teachers and students will see no timetable until you publish again.`)) return
    edit((c) => unpublish(c, new Date().toISOString()))
    setMessage({ ok: true, text: `Version ${pub.version} is no longer published.` })
  }
  const doExport = () => {
    const now = new Date().toISOString()
    const blob = new Blob([exportCollege(college, now)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = exportFileName(college, now)
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section aria-labelledby="publish-h" className="rounded-xl border border-rule bg-card p-5">
      <h2 id="publish-h" className="font-display text-lg font-semibold">
        Publish
      </h2>
      <p className="mt-1 text-[14px]">
        {pub ? (
          <>
            <span className="font-medium">Version {pub.version}</span> is live since {when(pub.at)} — teachers and students follow it.
            {draftIsLive ? ' The draft is the same.' : college.draft ? ' The draft differs from it.' : ''}
          </>
        ) : log.length ? (
          'Nothing is published right now — teachers and students see no timetable.'
        ) : (
          'Nothing published yet — teachers and students see no timetable.'
        )}
      </p>

      {canPublish && (
        <>
          {check.blocked.length > 0 ? (
            <ul className="mt-3 space-y-1 text-[13px]">
              {check.blocked.map((b) => (
                <li key={b} className="flex gap-2">
                  <CircleAlert size={15} className="mt-0.5 shrink-0 text-vermilion" aria-hidden /> {b}
                </li>
              ))}
              {onConflicts && (
                <li>
                  <button type="button" onClick={onConflicts} className="font-medium underline">
                    Open the Conflict Center
                  </button>{' '}
                  — every clash with who is involved and a fix.
                </li>
              )}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-muted">
              The draft passes the independent clash check
              {check.unplaced > 0 ? `; ${check.unplaced} periods are not placed — you will be asked to confirm.` : '.'}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={doPublish} disabled={check.blocked.length > 0 || draftIsLive} className={`${btn} border-ink bg-ink text-paper hover:opacity-90`}>
              <Send size={14} aria-hidden /> Publish as version {(log.at(-1)?.version ?? 0) + 1}
            </button>
            {pub && (
              <button type="button" onClick={doUnpublish} className={`${btn} border-rule hover:border-ink`}>
                <EyeOff size={14} aria-hidden /> Unpublish
              </button>
            )}
          </div>
        </>
      )}

      {message && (
        <p role="status" className={`mt-3 text-[13px] ${message.ok ? 'text-plum' : 'text-vermilion'}`}>
          {message.text}
        </p>
      )}

      <PublicLinks college={college} departments={college.departments} />

      {log.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[13px] text-muted hover:text-ink">Version history ({log.length})</summary>
          <ol className="mt-2 space-y-1 text-[13px]">
            {[...log].reverse().map((e) => (
              <li key={e.version} className="flex flex-wrap gap-x-2">
                <span className="font-mono">v{e.version}</span>
                <span>{when(e.at)}</span>
                <span className="text-muted">
                  · quality {e.score}/100 · {e.periods} periods{e.unplaced ? ` · ${e.unplaced} not placed` : ''}
                  {e.unpublishedAt ? ` · taken down ${when(e.unpublishedAt)}` : pub?.version === e.version ? ' · live' : ''}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}

      {canExport && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule pt-4">
          <button type="button" onClick={doExport} className={`${btn} border-rule hover:border-ink`}>
            <Download size={14} aria-hidden /> Export college (JSON)
          </button>
          <span className="text-[12px] text-muted">A backup copy of the whole college — structure, setup, draft and versions.</span>
        </div>
      )}
    </section>
  )
}
