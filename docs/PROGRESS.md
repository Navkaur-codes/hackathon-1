# Kaalchakra — Build Progress

> Updated after every feature. Source material for the final README.
> Each version: **D**esign → **B**uild → **T**est → **R**ecord, with a 🚀 push checkpoint after every feature (the user commits & pushes).

**Status:** v0.4 Super Admin + College Admin — P0.4-b done, awaiting push · **Live URL:** https://kaalchakra-seven.vercel.app · **Repo:** https://github.com/Navkaur-codes/hackathon-1

## Resume here (for a new chat)
- **Done:** v0.1, v0.2, v0.3 · v0.35: P0.35-a (finder + filters logic), P0.35-b (filter bar + shareable URL), P0.35-c (Who's free? tab + Ctrl/⌘+K) · print-preview fix · v0.4: P0.4-a (store + `access.ts` + role/college switcher), P0.4-b (Super Admin create / clone / archive).
- **Next:** P0.4-c Structure Builder → P0.4-d College Admin setup → P0.4-e generate + publish.
- **Still open:** OS reduced-motion (M10) not hand-checked; one hand check of Chrome's Ctrl+P on the live URL (M8).
- **Numbers:** 231 tests · DIET 96/100, DCAS 89/100 · 0 clashes · 20 tries ≈ 0.4 s in the browser.

## Version checklist (ticked after the user confirms each push)
- [x] **v0.1 Foundation**
  - [x] P0.1-a Theme, fonts, landing shell — `12a8fc7`
  - [x] P0.1-b Multi-college types + `structure.ts` + staggered breaks — `7485142`
  - [x] P0.1-c Two demo colleges via config — `6f4dd13`
  - [x] (user) GitHub repo + first push + Vercel connected — https://kaalchakra-seven.vercel.app (2026-10-26)
- [x] **v0.2 Engine**
  - [x] P0.2-a Independent validator (H1–H14) — `f142336`
  - [x] P0.2-b Solver core + semester calendar + leave cover engine — `88bf6c0`
  - [x] P0.2-c Repair, unplaced reasons, pre-flight check — `932f706`
  - [x] P0.2-d Quality score, restarts, Web Worker, landing result — `b276697`
- [x] **v0.3 Timetable views**
  - [x] P0.3-a Grid model + grids by section / teacher / room, opened from the card — `73f2053`
  - [x] P0.3-b Verified stamp, score, unplaced list + Clash Court popover — `88a955c`
  - [x] P0.3-c GSAP cell-drop + Flip, print (single + all sections) — `d8d5440`
- [x] **v0.35 Finder & filters**
  - [x] P0.35-a `lib/finder.ts` + `lib/filters.ts` — `5e991cc`
  - [x] P0.35-b Filter bar on the grid (URL state) — `24ff73b`
  - [x] P0.35-c "Who's free?" tab + Ctrl/⌘+K palette — `443b3aa`
- [ ] **v0.4 Super Admin + College Admin portals**
  - [x] P0.4-a Store + role/college switcher + `access.ts` — `7f63b9c`
  - [ ] P0.4-b Super Admin colleges list/create/clone (done, awaiting push)
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
| — | v0.2 | P0.2-b | Solver core `solver/solve.ts` + `rng.ts`: sessions (labs as blocks), all hard rules as filters (incl. staggered breaks, H14 lunch, room ownership/grants, leave), soft-penalty pick, fixed/locked placements, department subsets. **Dynamic most-constrained-first** ordering fixed a DCAS dead-end; cached re-scoring made it 9× faster | `88bf6c0` | 131 tests green; DIET: 0 same-subject repeats, 5 section idle periods |
| — | v0.2 | P0.2-b | **Semester timetable** (user request): `Calendar.weekdays`, `Semester` (dates, holidays, no-class days), `lib/semester.ts` rolls the weekly pattern over real dates, hours delivered per subject, classes on a date; demo semesters added; landing card shows semester | `88bf6c0` | T0.8–T0.10 |
| — | v0.2 | P0.2-b | **Leave cover engine** (user request — *pulled forward from v0.7*): auto-allot best free teacher per class on the leave date, HOD can swap, `uncovered` if none, `validateDate` | `88bf6c0` | T7.1–T7.2 · 147 tests green |
| — | v0.2 | P0.2-c | **Repair step** (lift one class sharing the teacher/section/room, re-place both, else restore exactly), **diagnosed unplaced reasons** (no room of type / too small / other dept's room → Room Exchange, teacher never available, weekly or daily limit, section full, no consecutive block, no common slot) and **pre-flight check** `solver/preflight.ts` (semester dates, unassigned teachers, unusable rooms, teacher week/day overload, section over capacity, lab block vs breaks, lab-room capacity) | `932f706` | 159 tests; repair helps rarely (2/300 random colleges) — most stuck classes are truly impossible, which pre-flight now reports up front |
| — | v0.2 | P0.2-d | **Quality score** `solver/score.ts` (S1–S7, weighted 0–100), **restarts** `solver/best.ts` (20 seeds, fewest unplaced → best score, bundles validator, pre-flight and semester totals), **Web Worker** `solver/worker.ts` + `runSolver.ts` (inline fallback), **landing `GeneratePanel`**: spinning wheel while solving, "0 clashes — verified" stamp, score counter, periods/week, semester contact hours, "Generate another" | `b276697` | 167 tests; browser: DIET 96/100 in 432 ms, DCAS 89/100 in 144 ms |
| — | v0.3 | P0.3-a | **Timetable page**: `lib/gridModel.ts` (grid + entity lists), `lib/colors.ts` (subject pastels), `TimetableGrid` (sticky time ruler, hatched own breaks, labs spanning with stripes), `ViewPicker` (Section/Teacher/Room + grouped picker), `TimetableView`; card gets **View timetable**; results kept while navigating; hero "Try a demo college" now jumps to the colleges | `73f2053` | 178 tests; fixed grid overflowing at desktop width (min-w-max → explicit min width) |
| — | v0.3 | P0.3-b | **Clash Court**: `lib/explain.ts` plain-language checklist of every hard rule for a class (independent of the solver, agrees with the validator), `ClashCourt` popover (beside the class; bottom sheet on phones; Esc/outside click; focus returns to the class); timetable page shows **verified stamp, score, periods, semester hours, unplaced + pre-flight** with fixes; shared `VerifiedStamp` | `88a955c` | fixed: picker squeezed to 86 px on phones; React-compiler lint on useCallback (ref pattern instead) |
| — | v0.3 | — | One-page progress report `docs/Kaalchakra-Progress.pdf` (user request): what works today + roadmap | `d8d5440` | |
| — | v0.3 | P0.3-c | **Grid motion** `components/gridMotion.ts`: staggered drop-in on first show; **GSAP Flip** on "Generate another" / view switch (stable per-class ids, snapshot taken right before the state change); all off under reduced motion. **Generate another** on the timetable page. **Print** (one timetable per A4 landscape, print header with college, semester, verified stamp, date) and **Print all sections** (one page per section); print always ink-on-white, colours kept | `d8d5440` | fixed: print would have been white-on-white in dark mode; a week overflowed A4 (745 px > 718) → compact print cells (434 px); hover translate removed from cells (fights GSAP) |
| — | v0.35 | P0.35-a | **Finder** `lib/finder.ts` (`occupancy`, `freeTeachers` with load + teaches-subject ranking, `freeRooms` with own / granted / shared / needs-grant, `weekStrip`, `nextFree`, `commonFree`, `nowSlot`) and **filters** `lib/filters.ts` (dept, subject, theory/lab, room type, day; URL round-trip) | `5e991cc` | 16 tests; logic only — screens come in P0.35-b/c |
| — | v0.35 | P0.35-b | **Filter bar** `components/FilterBar.tsx` above the grid: All / Theory / Lab chips, subject, day, room type and department pickers (options read from the college), "6 of 17 classes match" count, Clear. Non-matching classes **fade back** (CSS `filter`, so it never fights GSAP's opacity tweens) and stay clickable. **Shareable URL** `lib/viewUrl.ts`: college, seed, view, entity and filters live in the query; opening the link re-solves the same seed (deterministic) and restores the exact view; Back clears it | `24ff73b` | 203 tests (T35.6); browser-checked desktop + 375 px |
| — | v0.35 | P0.35-c | **"Who's free?" tab** `components/WhoIsFree.tsx` beside "Timetable": pick a day + one or more periods or press **Now** → free teachers (dept / subject filters, load that day, "teaches DS") and free rooms (type, min seats, badge own / granted / shared / needs a grant for a chosen dept); **Is it free?** week strip (free · busy · break · unavailable) + next free slot; **Common free slot** for any mix of teachers, rooms, sections. Clicking a free cell asks who's free then; names open their grid. **Ctrl/⌘+K palette** `components/CommandPalette.tsx` + `lib/fuzzy.ts` (subsequence matcher, no library): sections, teachers, rooms, subjects; ↑↓ Enter Esc; a subject applies the subject filter. Tab kept in the URL (`tab=free`); Print switches back to the timetable | `443b3aa` | 206 tests (T35.7); M6 browser-checked desktop + 375 px |
| — | fix | — | **Print preview** (user report: the print dialog showed no preview). Diagnosis: print output was already correct (checked through Chrome's real print-to-PDF engine, 1 page per timetable, 7 for all sections); the Claude in-app browser opens the Windows system dialog, which has no preview pane. Fix: `components/PrintSheets.tsx` — Kaalchakra's own preview of the exact A4 sheets (This timetable / All sections, Print, Esc) opens before the browser dialog; screen-side copy of the print styles (`.print-sheet` in `theme.css`); `shortDate` moved to `lib/semester.ts`. Vercel connected: kaalchakra-seven.vercel.app | `ae19925` | 206 tests; checked desktop + 375 px and via print-to-PDF |
| — | v0.4 | D | **v0.4 design** written in `docs/CLAUDE.md`: zustand store (persist, seed, reset), `access.ts`, role/college switcher, Super Admin colleges + Structure Builder, College Admin setup + paste-from-Excel, generate → publish with versions, export/import; pure `edit` / `publish` / `csv` modules | — | approved by the user |
| — | v0.4 | P0.4-a | **Persistent multi-college store + role access**: `store.ts` (zustand `persist`, key `kaalchakra` v1, seeds the demos through `buildCollege`, reset demo data, migrate / corrupt data → fresh seed, `updateCollege` touches one college only); `lib/access.ts` (`visibleColleges`, `collegeFor`, `can` per action, `sessionFor`); `lib/route.ts` hash routes `#/super` · `#/college` · `#/dept` · `#/teacher` · `#/student` (a portal always matches the session's role); header `RoleSwitcher` (chips / select on phones) + `CollegeSwitcher` + "My desk" + leave; `Landing` split out of `App` with "Enter" per role; portal shells: Super Admin all-colleges status, College Admin own college (generate → view timetable), HOD / Teacher / Student "opens in v0.5 / v0.6"; footer "Reset demo data". Dev fix: zustand pre-bundled in `vite.config.ts` (late discovery loaded two React copies in dev only) | `7f63b9c` | 224 tests (T4.2, T4.4, T4.6 + routes); browser-checked desktop + 375 px |
| — | v0.4 | P0.4-b | **Super Admin colleges**: `lib/edit.ts` — `newCollege` (blank template through `buildCollege`: 5 days × 6 slots + lunch, one dept / programme / section, two subjects, two teachers, a room; semester from today), `cloneCollege` (copies structure + setup, re-prefixes every id, drops timetables / leave / meetings), `codeProblem` (empty, taken, too long, or a code whose ids would overlap another college's), `setArchived`, `setCollegeAdmins`; store `addCollege`. `portals/super/NewCollegeForm` (name, code, start from blank or a copy) + `SuperPortal` cards: status, counts, College Admin names (edit), draft score, **View timetable read-only** (`TimetableView readOnly`, gated by `can('generate')`), **Open as College Admin**, **Archive / Restore** (confirm) | pending | 231 tests (T4.7); browser-checked desktop + 375 px |
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
