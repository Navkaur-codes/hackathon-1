# Kaalchakra — Build Progress

> Updated after every feature. Source material for the final README.
> Each version: **D**esign → **B**uild → **T**est → **R**ecord, with a 🚀 push checkpoint after every feature (the user commits & pushes).

**Status:** v0.2 Engine in progress — P0.2-b done, awaiting push (Vercel pending) · **Live URL:** _tbd_ · **Repo:** https://github.com/Navkaur-codes/hackathon-1

## Version checklist (ticked after the user confirms each push)
- [x] **v0.1 Foundation**
  - [x] P0.1-a Theme, fonts, landing shell — `12a8fc7`
  - [x] P0.1-b Multi-college types + `structure.ts` + staggered breaks — `7485142`
  - [x] P0.1-c Two demo colleges via config — `6f4dd13`
  - [ ] (user) GitHub repo + first push + Vercel connected
- [ ] **v0.2 Engine**
  - [x] P0.2-a Independent validator (H1–H14) — `f142336`
  - [ ] P0.2-b Solver core (sessions, labs, hard rules, soft pick, fixed placements)
  - [ ] P0.2-c Repair, unplaced reasons, pre-flight check
  - [ ] P0.2-d Quality score, restarts, Web Worker, landing result
- [ ] **v0.3 Timetable views**
  - [ ] P0.3-a TimetableGrid (section/teacher/room)
  - [ ] P0.3-b Clash seal + Clash Court popover
  - [ ] P0.3-c GSAP cell-drop + wheel + print CSS
- [ ] **v0.35 Finder & filters**
  - [ ] P0.35-a `finder.ts`
  - [ ] P0.35-b Filter bar (URL state)
  - [ ] P0.35-c Who's-free panel + Ctrl+K
- [ ] **v0.4 Super Admin + College Admin portals**
  - [ ] P0.4-a Store + role/college switcher + `access.ts`
  - [ ] P0.4-b Super Admin colleges list/create/clone
  - [ ] P0.4-c Structure Builder
  - [ ] P0.4-d College Admin setup + paste-from-Excel
  - [ ] P0.4-e Generate all + Publish/version
- [ ] **v0.5 HOD portal + Room Exchange**
  - [ ] P0.5-a HOD dept CRUD + Draft→Ready
  - [ ] P0.5-b Dept generate vs global ledger
  - [ ] P0.5-c Room Exchange (offer/request/grant/revoke)
- [ ] **v0.6 Teacher & Student portals + Meet-a-Teacher**
  - [ ] P0.6-a Teacher portal
  - [ ] P0.6-b Student portal
  - [ ] P0.6-c Meet-a-Teacher
- [ ] **v0.7 Ops & insights**
  - [ ] P0.7-a Leave inbox + Absence Mode screens (engine already built in P0.2-b)
  - [ ] P0.7-b Lock & regenerate + Conflict Center
  - [ ] P0.7-c Dashboard + Shared-Resource Ledger
- [ ] **v0.8 Kaal Assistant**
  - [ ] P0.8-a `assistant.ts` intents
  - [ ] P0.8-b ChatDrawer UI
- [ ] **v0.9 Authentication**
  - [ ] P0.9-a `auth.ts` (users, salted hash)
  - [ ] P0.9-b Login screen + route guards + demo accounts
- [ ] **v1.0 Ship**
  - [ ] P1.0-a Full test run + fixes
  - [ ] P1.0-b README
  - [ ] (user) Final push, check Vercel URL, submit

## Log
| Time | Version | Checkpoint | Feature | Commit (by user) | Notes |
|---|---|---|---|---|---|
| 14:15 | setup | — | Plan approved, Vite React-TS scaffold, libraries installed, docs created | — | not yet committed |
| — | setup | — | Plan revision 2: multi-college platform, Super Admin + Structure Builder, Meet-a-Teacher, no hard-coded structure | — | docs + PDF updated |
| — | setup | — | Plan revision 3: D/B/T/R phases per version, push checkpoint after every feature, user pushes to GitHub | — | docs updated |
| — | v0.1 | P0.1-a | Landing shell: GSAP headline reveal, rotating wheel, role cards, boilerplate removed (first draft in Paper & Ink) | pending | |
| — | v0.1 | P0.1-a | Tried a "Midnight & Saffron" dark restyle — user preferred Paper & Ink | — | discarded |
| — | v0.1 | P0.1-a | **Back to Paper & Ink with a tighter type scale**: hero 36→56px (was 48→72px), body 15px, h2 24→30px, buttons 14px, cards 13px | `12a8fc7` | h1 now 2 lines on mobile; no overflow at 463px |
| — | v0.1 | P0.1-b | `types.ts` (multi-college model incl. Subject, Assignment = section × subject → teacher), `lib/structure.ts` (generateSections, syncAssignments, buildCollege from a spec, periodTimes) | `7485142` | 13 tests green |
| — | v0.1 | P0.1-b | **Staggered breaks** (user request): breaks are slots in the shared grid; section → programme → dept → college inheritance, per-day rules, per-slot lengths; new hard rule **H14** teacher lunch; H7/H8 reworded | `7485142` | 17 tests green |
| — | v0.1 | P0.1-c | Two demo colleges as structure specs → `buildCollege`: **DIET** (Mon–Sat, 7 slots, CSE/ECE/ME, 7 sections, 385 students, 31 subjects, 12 teachers, ECE lunch staggered, shared Maths & Communication teachers, 2 shared computer labs + seminar hall) and **DCAS** (Mon–Fri, 6 slots, 30-min lunch, Friday assembly, Commerce/English, 4 sections). `summarizeCollege` + `CollegeCard` on the landing | `6f4dd13` | 32 tests green; fixed narrow-width card layout |
| — | v0.2 | P0.2-a | Independent validator `solver/validate.ts`: H1–H14 with plain-language messages naming the clashing classes; options `mustKeep` (H10) and `leave` (H6) | `f142336` | 24 tests: clean timetable + one violation per rule, staggered-break edge case, grants, leave |
| — | v0.2 | P0.2-b | Solver core `solver/solve.ts` + `rng.ts`: sessions (labs as blocks), all hard rules as filters (incl. staggered breaks, H14 lunch, room ownership/grants, leave), soft-penalty pick, fixed/locked placements, department subsets. **Dynamic most-constrained-first** ordering fixed a DCAS dead-end; cached re-scoring made it 9× faster | pending | 131 tests green; DIET: 0 same-subject repeats, 5 section idle periods |
| — | v0.2 | P0.2-b | **Semester timetable** (user request): `Calendar.weekdays`, `Semester` (dates, holidays, no-class days), `lib/semester.ts` rolls the weekly pattern over real dates, hours delivered per subject, classes on a date; demo semesters added; landing card shows semester | pending | T0.8–T0.10 |
| — | v0.2 | P0.2-b | **Leave cover engine** (user request — *pulled forward from v0.7*): auto-allot best free teacher per class on the leave date, HOD can swap, `uncovered` if none, `validateDate` | pending | T7.1–T7.2 · 147 tests green |
| — | v0.2 | — | Decision (user): **leave is date-specific** — HOD approval creates that date's adjusted timetable (substitute or moved class); weekly master unchanged. `LeaveRequest`/`Substitution` gain `date` | — | built in v0.7 |
| — | v0.1 | — | Scope: **Subjects** added — curriculum per programme in the Structure Builder; assignments = section × subject → teacher | — | user request; root CLAUDE.md G2/G5 + docs updated |

## Decisions
- Fully client-side (localStorage) to remove deploy risk; auth is demo-grade, production path = Supabase/Firebase + row-level security.
- Solver: greedy most-constrained-first + repair + seeded restarts; independent validator guarantees zero clashes.
- Chatbot is rule-based (no API key, deterministic, testable); LLM upgrade is future work.
- Design: "Paper & Ink" editorial theme with GSAP motion and a restrained type scale (a dark "Midnight & Saffron" alternative was tried and rejected by the user).
- Multi-college: every entity carries `collegeId`; Super Admin defines each college's structure (calendar, departments, programmes, sections, strength). Nothing about a college's shape is hard-coded — two differently shaped demo colleges prove it.
- Meet-a-Teacher: students request meetings in common free slots; meetings never block teaching.
- Breaks: one shared period grid with break *slots* that may differ per department, year, section and day (staggered lunch); teachers are guaranteed a free slot in the lunch window (H14).
- Git: Claude prepares each commit (message + files) at a push checkpoint; the user commits and pushes.

## Screenshots to capture (for README)
- [ ] Landing (hero + wheel)
- [ ] Super Admin: colleges list + Structure Builder
- [ ] Meet-a-Teacher: student request → teacher inbox
- [ ] College Admin: generated timetable with "0 clashes — verified" seal
- [ ] HOD: Room Exchange (offer/request/grant)
- [ ] Who's free? finder
- [ ] Conflict Center / dashboard (load bars, room heatmap)
- [ ] Teacher: My Week + Today
- [ ] Student on mobile: Now/Next + substitute notice
- [ ] Kaal Assistant answering a question
- [ ] Print preview
