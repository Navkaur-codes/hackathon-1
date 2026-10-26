import { useEffect, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ArrowUpRight, MessageCircle, Send, X } from 'lucide-react'
import type { AssistantScope } from '../lib/access'
import { ask, suggestions, type Answer, type AskContext, type Jump, type MeetAction, type OpenPage } from '../lib/assistant'
import { shortDate } from '../lib/semester'
import type { CollegeData } from '../types'

type Props = {
  college: CollegeData
  scope: AssistantScope
  /** Role accent (CSS colour) for the button and the asker's bubbles. */
  accent: string
  /** Undefined when this role cannot open that grid (e.g. a student asking about someone else). */
  onJump: (j: Jump) => void
  canJump: (j: Jump) => boolean
  onOpen?: (page: OpenPage) => void
  /** Student: send a meeting request from an answer (returns the refusal, or null when sent). */
  onRequest?: (a: MeetAction, topic: string) => string | null
}

type Turn = { q: string; a: Answer }

/** The meet action of an answer: one topic box + a Request button per offered time. */
function MeetActions({ actions, onRequest }: { actions: MeetAction[]; onRequest: NonNullable<Props['onRequest']> }) {
  const [topic, setTopic] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  if (msg?.ok) return <p className="mt-2 text-[13px] text-plum">{msg.text}</p>
  return (
    <div className="mt-2 space-y-1.5">
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="What about? (needed to send)"
        aria-label="Meeting topic"
        className="w-full rounded-lg border border-rule bg-paper px-2 py-1 text-[13px]"
      />
      <div className="flex flex-wrap gap-1.5">
        {actions.map((a) => (
          <button
            key={a.period}
            type="button"
            onClick={() => {
              const why = onRequest(a, topic)
              setMsg(why ? { ok: false, text: why } : { ok: true, text: `Request sent for ${shortDate(a.date)} — track it in Meet a teacher.` })
            }}
            className="rounded-full border border-ink bg-ink px-2.5 py-1 text-[12px] font-medium text-paper transition hover:opacity-90"
          >
            {a.label}
          </button>
        ))}
      </div>
      {msg && <p className="text-[12px] text-vermilion">{msg.text}</p>}
    </div>
  )
}

/** "Ask Kaal" — a chat drawer on every desk (bottom sheet on phones). Offline, rule-based, role-scoped (lib/assistant.ts). */
export function ChatDrawer({ college, scope, accent, onJump, canJump, onOpen, onRequest }: Props) {
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [text, setText] = useState('')
  const [context, setContext] = useState<AskContext>({})
  const button = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const chips = suggestions(college, scope)

  // Ctrl/⌘+J toggles from anywhere; Esc closes and gives focus back to the button
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open) input.current?.focus()
    else if (wasOpen.current) button.current?.focus()
    wasOpen.current = open
  }, [open])
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [turns])

  // slide in; never under reduced motion, never blocking input
  useGSAP(
    () => {
      if (!open || !panel.current) return
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from(panel.current, { y: 24, opacity: 0, duration: 0.25, ease: 'power2.out', clearProps: 'transform,opacity' })
      })
      return () => mm.revert()
    },
    { dependencies: [open] },
  )

  const send = (q: string) => {
    const question = q.trim()
    if (!question) return
    const r = ask(college, scope, question, new Date(), context)
    setTurns((t) => [...t, { q: question, a: r.answer }])
    setContext(r.context)
    setText('')
  }

  return (
    <div className="no-print">
      {!open && (
        <button
          ref={button}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask Kaal (Ctrl+J)"
          title="Ask Kaal (Ctrl+J)"
          className="fixed right-4 bottom-4 z-40 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-medium text-paper shadow-lg transition hover:opacity-90"
          style={{ background: accent }}
        >
          <MessageCircle size={17} aria-hidden /> Ask Kaal
        </button>
      )}
      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-label="Kaal Assistant"
          className="fixed inset-x-0 bottom-0 z-50 flex h-[78dvh] flex-col rounded-t-2xl border border-rule bg-card shadow-2xl sm:inset-x-auto sm:top-4 sm:right-4 sm:bottom-4 sm:h-auto sm:w-[25rem] sm:rounded-2xl"
        >
          <div className="flex items-center gap-2 border-b border-rule px-4 py-3">
            <MessageCircle size={17} style={{ color: accent }} aria-hidden />
            <p className="font-display text-base font-semibold">Ask Kaal</p>
            <span className="font-mono text-[10px] tracking-wider text-muted uppercase">offline · {college.college.code}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="ml-auto rounded-full p-1.5 text-muted transition hover:bg-ink/5 hover:text-ink">
              <X size={17} aria-hidden />
            </button>
          </div>

          <div ref={list} className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
            {turns.length === 0 && (
              <p className="text-[13px] text-muted">Ask in plain words — about free teachers and rooms, where a class is, who teaches what, substitutes, meetings or holidays.</p>
            )}
            {turns.map((t, i) => (
              <div key={i} className="space-y-1.5">
                <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm px-3 py-1.5 text-[14px] text-paper" style={{ background: accent }}>
                  {t.q}
                </p>
                <div className={`max-w-[95%] rounded-2xl rounded-bl-sm border px-3 py-2 text-[14px] ${t.a.refused ? 'border-vermilion/40 bg-vermilion/5' : 'border-rule bg-paper'}`}>
                  <p>{t.a.text}</p>
                  {t.a.lines && t.a.lines.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-[13px] text-muted">
                      {t.a.lines.map((l, j) =>
                        t.a.unknown ? (
                          <li key={j}>
                            <button type="button" onClick={() => send(l)} className="text-left text-ink underline underline-offset-2">
                              {l}
                            </button>
                          </li>
                        ) : (
                          <li key={j}>· {l}</li>
                        ),
                      )}
                    </ul>
                  )}
                  {(t.a.jumps?.some(canJump) || t.a.open) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {t.a.jumps?.filter(canJump).map((j) => (
                        <button
                          key={j.entityId}
                          type="button"
                          onClick={() => {
                            onJump(j)
                            setOpen(false)
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-rule px-2.5 py-1 text-[12px] font-medium transition hover:border-ink"
                        >
                          {j.label} <ArrowUpRight size={12} aria-hidden />
                        </button>
                      ))}
                      {onOpen &&
                        t.a.open?.map((o) => (
                          <button
                            key={o.page}
                            type="button"
                            onClick={() => {
                              onOpen(o.page)
                              setOpen(false)
                            }}
                            className="inline-flex items-center gap-1 rounded-full border border-rule px-2.5 py-1 text-[12px] font-medium transition hover:border-ink"
                          >
                            {o.label} <ArrowUpRight size={12} aria-hidden />
                          </button>
                        ))}
                    </div>
                  )}
                  {t.a.actions && t.a.actions.length > 0 && onRequest && <MeetActions actions={t.a.actions} onRequest={onRequest} />}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-rule px-4 py-3">
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1" aria-label="Suggested questions">
              {chips.map((c) => (
                <button key={c} type="button" onClick={() => send(c)} className="shrink-0 rounded-full border border-rule bg-paper px-2.5 py-1 text-[12px] transition hover:border-ink">
                  {c}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                send(text)
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={input}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ask about the timetable…"
                aria-label="Your question"
                className="min-w-0 flex-1 rounded-full border border-rule bg-paper px-3 py-2 text-[14px]"
              />
              <button type="submit" disabled={!text.trim()} aria-label="Ask" className="rounded-full p-2.5 text-paper transition disabled:opacity-40" style={{ background: accent }}>
                <Send size={15} aria-hidden />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
