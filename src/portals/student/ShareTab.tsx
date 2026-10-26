import { useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { shareUrl, snapshotOf } from '../../lib/share'
import type { CollegeData, Id } from '../../types'

type Props = { college: CollegeData; sectionId: Id }

/** A link that opens this section's week, read-only, on any phone — the timetable travels inside the link. */
export function ShareTab({ college, sectionId }: Props) {
  const snap = snapshotOf(college, sectionId)!
  const url = shareUrl(`${window.location.origin}${window.location.pathname}`, snap)
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied('yes')
    } catch {
      setCopied('failed')
    }
  }

  return (
    <section aria-labelledby="share-h" className="rounded-xl border border-rule bg-card p-5">
      <h2 id="share-h" className="font-display text-lg font-semibold">
        Share {snap.section}’s week
      </h2>
      <p className="text-[13px] text-muted">
        Send this link to classmates or parents. It opens the week on any phone — read-only, no login. It shows version {snap.version}; if the college
        publishes a new version, share again.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          aria-label="Share link"
          onFocus={(e) => e.target.select()}
          className="min-w-0 flex-1 rounded-lg border border-rule bg-paper px-2.5 py-1.5 font-mono text-[12px] text-muted"
        />
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink bg-ink px-3 py-1.5 text-[13px] font-medium text-paper transition hover:opacity-90"
        >
          {copied === 'yes' ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copied === 'yes' ? 'Copied' : 'Copy link'}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-rule px-3 py-1.5 text-[13px] font-medium transition hover:border-ink"
        >
          Open <ExternalLink size={14} aria-hidden />
        </a>
      </div>
      {copied === 'failed' && <p className="mt-2 text-[13px] text-vermilion">Could not copy here — select the link and copy it by hand.</p>}
      <p className="mt-2 font-mono text-[11px] text-muted">{url.length.toLocaleString('en-IN')} characters</p>
    </section>
  )
}
