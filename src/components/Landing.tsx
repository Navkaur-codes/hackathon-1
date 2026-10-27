import { useRef } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'
import { ArrowRight, CalendarCheck, Layers, Share2, Wand2 } from 'lucide-react'
import type { SolveResult } from '../solver/best'
import { DEMO_COLLEGE_IDS } from '../demoData'
import type { CollegeData } from '../types'
import { CollegeCard } from './CollegeCard'
import { Wheel } from './Wheel'

gsap.registerPlugin(useGSAP, SplitText)

type Props = {
  /** Active colleges; only the seeded demo ones are listed (colleges a Super Admin creates stay private). */
  colleges: CollegeData[]
  results: Record<string, SolveResult>
  onResult: (collegeId: string, r: SolveResult) => void
  onView: (collegeId: string) => void
  onSignIn: () => void
}

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

/** The steps from an empty college to a timetable everyone can open. */
const STEPS = [
  { icon: Layers, title: 'Shape the college', text: 'Working days, periods, lunch breaks, departments, years, sections and the subjects each year studies.' },
  { icon: CalendarCheck, title: 'Add people and rooms', text: 'Teachers with their limits and unavailable hours, rooms and labs, who teaches what — typed or pasted from Excel.' },
  { icon: Wand2, title: 'Generate and check', text: 'One click builds every department’s week; an independent checker proves there is not a single clash.' },
  { icon: Share2, title: 'Publish and share', text: 'Each department gets a public link — faculty, UG / PG classes and rooms — that opens on any phone, no sign-in.' },
]

/** What every generated timetable is checked against before it can be published (root CLAUDE.md §3, in plain words). */
const GUARANTEES = [
  'No teacher in two places at once — across every department',
  'No section with two classes in one period',
  'No room booked twice, and always the right type and size',
  'Labs in back-to-back periods, never across lunch',
  'Every section and every teacher keeps a lunch break',
  'Teachers’ daily and weekly limits and unavailable hours respected',
]

/** Public landing: hero (try a demo · sign in), the demo colleges, and how Kaalchakra works. */
export function Landing({ colleges: active, results, onResult, onView, onSignIn }: Props) {
  const colleges = active.filter((c) => DEMO_COLLEGE_IDS.includes(c.college.id))
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        SplitText.create('[data-hero-title]', {
          type: 'words',
          mask: 'words',
          autoSplit: true,
          onSplit: (self) => gsap.from(self.words, { yPercent: 110, duration: 0.9, ease: 'expo.out', stagger: 0.07 }),
        })
        gsap.from('[data-hero-fade]', { autoAlpha: 0, y: 16, duration: 0.8, ease: 'power3.out', stagger: 0.1, delay: 0.35 })
        gsap.from('[data-wheel]', { autoAlpha: 0, scale: 0.85, rotate: -90, duration: 1.4, ease: 'expo.out' })
        gsap.to('[data-wheel] [data-wheel-spokes]', { rotate: 360, transformOrigin: '50% 50%', duration: 60, ease: 'none', repeat: -1 })
        gsap.from('[data-step-card]', { autoAlpha: 0, y: 24, duration: 0.7, ease: 'power3.out', stagger: 0.08, delay: 0.6 })
        gsap.from('[data-college-card]', { autoAlpha: 0, y: 24, duration: 0.7, ease: 'power3.out', stagger: 0.12, delay: 0.8 })
      })
    },
    { scope: root },
  )

  return (
    <div ref={root}>
      <section className="grid items-center gap-10 py-12 md:grid-cols-[1.3fr_1fr] md:py-16">
        <div>
          <p data-hero-fade className="mb-4 font-mono text-[11px] tracking-[0.25em] text-vermilion uppercase">
            Every period, in its place
          </p>
          <h1
            data-hero-title
            className="max-w-[16ch] font-display text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl lg:text-[3.5rem]"
          >
            Timetables without the <em className="text-vermilion">clashes</em>.
          </h1>
          <p data-hero-fade className="mt-5 max-w-lg text-base leading-relaxed text-muted sm:text-[17px]">
            Kaalchakra builds a clash-free week for every section, teacher and room — across departments that share labs
            and halls — and keeps it right when someone is on leave.
          </p>
          <div data-hero-fade className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => scrollTo('colleges')}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:opacity-90"
            >
              Demo college <ArrowRight size={16} aria-hidden />
            </button>
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center gap-2 rounded-full border border-ink px-5 py-2.5 text-sm font-medium transition hover:bg-ink hover:text-paper"
            >
              Sign in
            </button>
          </div>
        </div>
        <div className="flex justify-center md:justify-end">
          <div data-wheel className="w-[min(70vw,320px)]">
            <Wheel size={320} className="h-auto w-full" />
          </div>
        </div>
      </section>

      <section id="colleges" className="scroll-mt-4 border-t border-rule py-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Any college, any shape.</h2>
            <p className="mt-2 max-w-2xl text-[15px] text-muted">
              Colleges built from nothing but their structure — different days, periods, departments and lunch breaks.
              Every number below is computed, not typed in.
            </p>
          </div>
          <span className="font-mono text-[11px] tracking-[0.2em] text-muted uppercase">
            {colleges.length} demo {colleges.length === 1 ? 'college' : 'colleges'} · try without signing in
          </span>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {colleges.map((c) => (
            <CollegeCard
              key={c.college.id}
              data={c}
              result={results[c.college.id]}
              onResult={(r) => onResult(c.college.id, r)}
              onView={() => onView(c.college.id)}
            />
          ))}
        </div>
      </section>

      <section id="how" className="scroll-mt-4 border-t border-rule py-12">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">From an empty college to a shared timetable.</h2>
        <p className="mt-2 max-w-2xl text-[15px] text-muted">
          The Super Admin creates the college and its College Admin; the College Admin and HODs do the rest. Four steps, any college shape.
        </p>
        <ol className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} data-step-card className="flex flex-col rounded-xl border border-rule bg-card p-5">
              <span className="flex items-center justify-between">
                <Icon size={20} className="text-vermilion" aria-hidden />
                <span className="font-mono text-[11px] tracking-[0.2em] text-muted">0{i + 1}</span>
              </span>
              <h3 className="mt-3 font-display text-base font-semibold">{title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 rounded-xl border border-rule bg-card p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold">Checked before it is published — every time.</h3>
          <ul className="mt-3 grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-2">
            {GUARANTEES.map((g) => (
              <li key={g} className="flex gap-2">
                <span aria-hidden className="font-mono text-vermilion">✓</span>
                {g}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] text-muted">
            A class that cannot be placed legally is listed with the reason and a fix — never squeezed in. When a teacher is on leave, a free substitute is
            suggested for that day only.
          </p>
        </div>
      </section>
    </div>
  )
}
