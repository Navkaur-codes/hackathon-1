import { useRef, useState } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'
import { ArrowRight, Building2, GraduationCap, Landmark, School, Users } from 'lucide-react'
import { Wheel } from './components/Wheel'
import { CollegeCard } from './components/CollegeCard'
import { TimetableView } from './components/TimetableView'
import type { SolveResult } from './solver/best'
import { buildDemoColleges } from './demoData'

const demoColleges = buildDemoColleges()

gsap.registerPlugin(useGSAP, SplitText)

const roles = [
  { icon: Landmark, name: 'Super Admin', accent: 'var(--gold)', line: 'Creates colleges and shapes their structure — departments, sections, subjects, calendar.' },
  { icon: Building2, name: 'College Admin', accent: 'var(--vermilion)', line: 'Generates one clash-free timetable for the whole college and publishes it.' },
  { icon: School, name: 'Head of Department', accent: 'var(--terracotta)', line: 'Plans the department, lends idle rooms, handles leave and substitutes.' },
  { icon: Users, name: 'Teacher', accent: 'var(--plum)', line: 'Sees the week at a glance, requests leave, answers meeting requests.' },
  { icon: GraduationCap, name: 'Student', accent: 'var(--marigold)', line: 'Knows where the next class is — and when a teacher is free to meet.' },
]

export default function App() {
  const root = useRef<HTMLDivElement>(null)
  // Generated results per college (kept while navigating) and the timetable currently open.
  const [results, setResults] = useState<Record<string, SolveResult>>({})
  const [open, setOpen] = useState<string | null>(null)
  const openCollege = open ? demoColleges.find((c) => c.college.id === open) : undefined

  const view = (collegeId: string) => {
    setOpen(collegeId)
    window.scrollTo({ top: 0 })
  }
  const back = () => {
    setOpen(null)
    requestAnimationFrame(() => document.getElementById('colleges')?.scrollIntoView())
  }

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        SplitText.create('[data-hero-title]', {
          type: 'words',
          mask: 'words',
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.words, { yPercent: 110, duration: 0.9, ease: 'expo.out', stagger: 0.07 }),
        })
        gsap.from('[data-hero-fade]', { autoAlpha: 0, y: 16, duration: 0.8, ease: 'power3.out', stagger: 0.1, delay: 0.35 })
        gsap.from('[data-wheel]', { autoAlpha: 0, scale: 0.85, rotate: -90, duration: 1.4, ease: 'expo.out' })
        gsap.to('[data-wheel-spokes]', { rotate: 360, transformOrigin: '50% 50%', duration: 60, ease: 'none', repeat: -1 })
        gsap.from('[data-role-card]', { autoAlpha: 0, y: 24, duration: 0.7, ease: 'power3.out', stagger: 0.08, delay: 0.6 })
        gsap.from('[data-college-card]', { autoAlpha: 0, y: 24, duration: 0.7, ease: 'power3.out', stagger: 0.12, delay: 0.8 })
      })
    },
    { scope: root },
  )

  return (
    <div ref={root} className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 sm:px-8">
      <header className="no-print flex items-center justify-between border-b border-rule py-4">
        <div className="flex items-center gap-2.5">
          <Wheel size={28} spokes={8} />
          <span className="font-display text-xl font-semibold tracking-tight">Kaalchakra</span>
        </div>
        <span className="hidden font-mono text-[11px] tracking-[0.2em] text-muted uppercase sm:block">
          College timetables · any college
        </span>
      </header>

      <main className="flex-1">
        {openCollege && results[openCollege.college.id] ? (
          <TimetableView
            college={openCollege}
            result={results[openCollege.college.id]}
            onBack={back}
            onResult={(r) => setResults((prev) => ({ ...prev, [openCollege.college.id]: r }))}
          />
        ) : (
          <>
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
                  Kaalchakra builds a clash-free week for every section, teacher and room — across departments that
                  share labs and halls — and keeps it right when someone is on leave.
                </p>
                <div data-hero-fade className="mt-7 flex flex-wrap items-center gap-3">
                  <a
                    href="#colleges"
                    className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:opacity-90"
                  >
                    Try a demo college <ArrowRight size={16} aria-hidden />
                  </a>
                  <a
                    href="#roles"
                    className="inline-flex items-center gap-2 rounded-full border border-ink px-5 py-2.5 text-sm font-medium transition hover:bg-ink hover:text-paper"
                  >
                    Who it's for
                  </a>
                </div>
              </div>
              <div className="flex justify-center md:justify-end">
                <div data-wheel className="w-[min(70vw,320px)]">
                  <Wheel size={320} className="h-auto w-full" />
                </div>
              </div>
            </section>

            <section id="colleges" className="border-t border-rule py-12">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Any college, any shape.</h2>
                  <p className="mt-2 max-w-2xl text-[15px] text-muted">
                    Two demo colleges, built from nothing but their structure — different days, periods, departments and
                    lunch breaks. Every number below is computed, not typed in.
                  </p>
                </div>
                <span className="font-mono text-[11px] tracking-[0.2em] text-muted uppercase">
                  {demoColleges.length} colleges on this platform
                </span>
              </div>
              <div className="mt-7 grid gap-4 md:grid-cols-2">
                {demoColleges.map((c) => (
                  <CollegeCard
                    key={c.college.id}
                    data={c}
                    result={results[c.college.id]}
                    onResult={(r) => setResults((prev) => ({ ...prev, [c.college.id]: r }))}
                    onView={() => view(c.college.id)}
                  />
                ))}
              </div>
            </section>

            <section id="roles" className="border-t border-rule py-12">
              <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">One timetable, five desks.</h2>
              <p className="mt-2 max-w-2xl text-[15px] text-muted">
                Everyone who depends on the timetable gets a view made for their job — and only the data they should see.
              </p>
              <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {roles.map(({ icon: Icon, name, accent, line }) => (
                  <article
                    key={name}
                    data-role-card
                    className="rounded-xl border border-rule bg-card p-5"
                    style={{ borderTop: `4px solid ${accent}` }}
                  >
                    <Icon size={20} style={{ color: accent }} aria-hidden />
                    <h3 className="mt-3 font-display text-base font-semibold">{name}</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">{line}</p>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="no-print flex flex-wrap items-center justify-between gap-2 border-t border-rule py-5 font-mono text-[11px] text-muted">
        <span>Kaalchakra · v0.3</span>
        <span>Built at the Punjab Jobs AI Bootcamp</span>
      </footer>
    </div>
  )
}
