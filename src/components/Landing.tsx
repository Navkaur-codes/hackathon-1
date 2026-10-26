import { useRef } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'
import { ArrowRight } from 'lucide-react'
import type { SolveResult } from '../solver/best'
import type { CollegeData, Role } from '../types'
import { CollegeCard } from './CollegeCard'
import { ROLES } from './roles'
import { Wheel } from './Wheel'

gsap.registerPlugin(useGSAP, SplitText)

type Props = {
  /** Active colleges on the platform (from the store). */
  colleges: CollegeData[]
  results: Record<string, SolveResult>
  onResult: (collegeId: string, r: SolveResult) => void
  onView: (collegeId: string) => void
  onEnter: (role: Role) => void
}

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

/** Public landing: hero, the colleges on the platform (try-it demo) and "Sign in as …" for each role (v0.9: to the login page). */
export function Landing({ colleges, results, onResult, onView, onEnter }: Props) {
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
        gsap.from('[data-role-card]', { autoAlpha: 0, y: 24, duration: 0.7, ease: 'power3.out', stagger: 0.08, delay: 0.6 })
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
              Try a demo college <ArrowRight size={16} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => scrollTo('roles')}
              className="inline-flex items-center gap-2 rounded-full border border-ink px-5 py-2.5 text-sm font-medium transition hover:bg-ink hover:text-paper"
            >
              Sign in as…
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
            {colleges.length} {colleges.length === 1 ? 'college' : 'colleges'} on this platform
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

      <section id="roles" className="scroll-mt-4 border-t border-rule py-12">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">One timetable, five desks.</h2>
        <p className="mt-2 max-w-2xl text-[15px] text-muted">
          Everyone who depends on the timetable gets a view made for their job — and only the data they should see. Pick a
          desk to step in; you can switch role and college any time from the top bar.
        </p>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {ROLES.map(({ role, icon: Icon, name, accent, line }) => (
            <article
              key={role}
              data-role-card
              className="flex flex-col rounded-xl border border-rule bg-card p-5"
              style={{ borderTop: `4px solid ${accent}` }}
            >
              <Icon size={20} style={{ color: accent }} aria-hidden />
              <h3 className="mt-3 font-display text-base font-semibold">{name}</h3>
              <p className="mt-1 flex-1 text-[13px] leading-relaxed text-muted">{line}</p>
              <button
                type="button"
                onClick={() => onEnter(role)}
                className="mt-4 inline-flex items-center gap-1.5 self-start rounded-full border border-ink px-3 py-1.5 text-[13px] font-medium transition hover:bg-ink hover:text-paper"
              >
                Sign in<span className="sr-only"> as {name}</span> <ArrowRight size={14} aria-hidden />
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
