import { useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { publicUrl } from '../lib/publicView'
import type { CollegeData, Department } from '../types'

type Props = { college: CollegeData; departments: Department[] }

const btn = 'inline-flex items-center gap-1.5 rounded-full border border-rule px-2.5 py-1 text-[12px] font-medium transition hover:border-ink'

/**
 * The public link of each department once a version is published (v0.9-d): copy to share, or open it. A link
 * carries that version, so every new publish makes new links to share (the user chose this over a stored, permanent
 * link — v0.9-l was taken back out).
 */
export function PublicLinks({ college, departments }: Props) {
  const [copied, setCopied] = useState<string | null>(null)
  if (!college.published) return null
  const base = `${window.location.origin}${window.location.pathname}`
  const copy = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(id)
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }
  return (
    <div className="mt-4 border-t border-rule pt-4">
      <h3 className="font-display text-[16px] font-semibold">Public links · version {college.published.version}</h3>
      <p className="mt-0.5 text-[13px] text-muted">
        Anyone with a link sees that department’s faculty, UG / PG classes and rooms — no sign-in. These links carry version {college.published.version}; after the
        next publish, share the new links.
      </p>
      <ul className="mt-2 divide-y divide-rule">
        {departments.map((d) => {
          const url = publicUrl(base, college, d)
          if (!url) return null
          return (
            <li key={d.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="mr-auto min-w-0 text-[14px]">
                <span className="font-mono text-[12px] text-muted">{d.code}</span> {d.name}
              </span>
              <button type="button" onClick={() => void copy(d.id, url)} className={btn} aria-label={`Copy the public link of ${d.name}`}>
                {copied === d.id ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />} {copied === d.id ? 'Copied' : 'Copy link'}
              </button>
              <a href={url} target="_blank" rel="noreferrer" className={btn} aria-label={`Open the public timetable of ${d.name}`}>
                <ExternalLink size={13} aria-hidden /> Open
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
