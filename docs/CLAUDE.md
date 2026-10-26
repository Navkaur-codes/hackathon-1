# Kaalchakra — Progressive Design Log

> Written **before** each version starts (Design), completed after it (Built, Open issues).
> Global rules: root `CLAUDE.md`. Roadmap: `docs/PLAN.md`.

**Current version: v0.6 Teacher & Student portals — P0.6-a pushed, P0.6-b built (awaiting push), P0.6-c next** · v0.5 done · v0.4 done · v0.35 done · v0.3 done · v0.2 done · v0.1 done

> **▶ RESUME HERE (new chat):** **v0.5 incl. the room rework is complete and pushed** — P0.5-a `74d652a`, P0.5-b `6171526`, P0.5-c `3439fe5`, P0.5-d `d64f465`, P0.5-e `656dd3e`. **v0.6 design approved (2026-10-26)**; P0.6-a Teacher desk `92d4114`; P0.6-b Student desk built (338 tests green). v0.4 complete (`13cdba3`). Live at https://kaalchakra-seven.vercel.app (auto-deploys on push). Check `git log -1` first.
>
> **Next:** the user commits & pushes P0.6-b (`feat(student): student desk with now-next, notices and share link`). Then **P0.6-c** Meet-a-Teacher (`lib/meetings.ts`; office hours are already stored by the teacher desk, the student's name is in the session), then fill v0.6 *Built* / *Open issues* and write the v0.7 design.
>
> **Working notes:** follow the phase cycle and push-checkpoint rules in root `CLAUDE.md` §9; tell the user when a request belongs to another version (memory: flag-other-version-requests). Restart the dev server after adding component files (Tailwind dev quirk). In the preview browser keep a single tab (tabs sync, but a tab opened before a restart runs old code); the preview may lose localStorage across server restarts. Bash heredocs choke on apostrophes — write long text with the Write tool. Open issues: see v0.4 *Open issues* below.

**Phase cycle per version:** D Design (this file) → B Build one feature → T Test → R Record → 🚀 push checkpoint (user commits & pushes) → next feature.

---

## v0.1 Foundation (0–10 min)

### Design
**Goal:** a live, deployed skeleton with the design system, a multi-college data model, and two demo colleges built purely from configuration.

**Screens / components**
- `App.tsx`: placeholder landing — Kaalchakra wordmark (Fraunces), tagline "Every period, in its place.", list of seeded colleges (name + counts read from data, not hard-coded), "Try demo" button (disabled until v0.2). Proves theme + fonts + config-driven data work.

**Files**
- `src/theme.css`: Tailwind v4 `@import "tailwindcss"` + `@theme inline` tokens (paper, card, ink, muted, rule, vermilion, marigold, plum, terracotta, gold; Fraunces / Inter / JetBrains Mono) + dark "Blackboard" overrides + base body (15px / 1.6) + `@media print`. *(User tried Midnight & Saffron, reverted to Paper & Ink with a smaller, tighter type scale — see root CLAUDE.md §6.)*
- `index.html`: title "Kaalchakra — College Timetables", Google Fonts (Fraunces, Inter, JetBrains Mono), wheel favicon.
- `src/types.ts`:
  - `Platform { colleges: College[] }`, `College { id, name, code, status: 'active'|'archived', collegeAdminIds }`
  - `Semester { collegeId, name, startDate, endDate, holidays, noClassDates }` and `Calendar.weekdays` *(added in v0.2)*
  - `BreakRule { period, days?, label? }` — a break is a slot in the shared grid, optionally only on some days
  - `Calendar { collegeId, days: string[] /* any subset/order */, periodsPerDay, startTime, periodMinutes, periodLengths?, breaks: BreakRule[], lunchWindow: number[], teacherMinFreeInLunchWindow, blockedSlots: SlotKey[], labBlockLength, maxMeetingRequestsPerStudent }`
  - `Department { id, collegeId, code, name, status, breaks? }`, `Programme { id, collegeId, deptId, name, shortName, sectionsCount, defaultStrength, breaks? }`, `Section { id, collegeId, deptId, programmeId, name, strength, breaks? }`
  - `Room { id, collegeId, name, type: 'lecture'|'lab'|'seminar', capacity, ownerDeptId | 'shared' }`, `Teacher { id, collegeId, deptId, name, maxPerDay, maxPerWeek, unavailable: SlotKey[] }`
  - `Subject { id, collegeId, deptId, programmeId, code, name, kind: 'theory'|'lab', periodsPerWeek, blockLength? /* labs, defaults to calendar.labBlockLength */, roomType }` — the curriculum, defined per programme
  - `Assignment { id, collegeId, sectionId, subjectId, teacherId }` — who teaches which subject to which section (teacherId may be empty until the HOD assigns one; unassigned subjects show in pre-flight, never reach the solver)
  - `Placement { assignmentId, collegeId, deptId, day, period, length, roomId, locked }`, `Unplaced { assignmentId, reason, suggestion }`, `Timetable`, `Published { timetable, version, at }`
  - `Grant`, `LeaveRequest`, `Substitution`, `OfficeHours { teacherId, slots, accepting }`, `MeetingRequest { id, collegeId, studentName, sectionId, teacherId, day, period, topic, note, status, roomId?, proposedSlot? }`
  - `Session { role: 'superAdmin'|'collegeAdmin'|'deptAdmin'|'teacher'|'student', collegeId?, deptId?, teacherId?, sectionId? }`
- `src/lib/structure.ts`: `generateSections(programme, existing?)` → exactly `sectionsCount` sections named `${deptCode}-${programmeShort}-${A,B,C…}` with `defaultStrength`; keeps edited names/strength of surviving sections when counts change. `syncAssignments(sections, subjects, existing)` → exactly one Assignment per section × subject of its programme (keeps chosen teachers, adds new pairs, drops removed ones). `buildCollege(spec)` turns a structure spec (calendar + depts + programmes with their subjects + rooms + teachers + teacher-per-subject choices) into a full college — the **only** way data is created, demo included.
- `src/demoData.ts`: two specs passed through `buildCollege`:
  1. **Demo Institute of Engineering** — Mon–Sat, 7 slots (09:00, 50 min) with **staggered lunch**: CSE & ME break in slot 4, ECE in slot 5 (lunch window 4–5); depts CSE/ECE/ME, 2 programmes each (Year 2, Year 3) × 1–2 sections, strength 45–60; dept lecture rooms + 1 dept lab each; **shared** 2 computer labs + seminar hall; one Maths teacher teaching across depts.
  2. **Demo College of Arts & Science** — Mon–Fri, 6 slots (09:30, 55 min) with one common 30-min lunch slot (slot 3) and a longer Friday break; depts Commerce/English, 1–2 programmes, 1 shared seminar hall, no labs except 1 language lab.
  Both sized to be solvable with slack.
- Remove Vite boilerplate (`App.css`, counter, assets).

**Decisions**
- **Breaks are slots in one shared grid**, and can be **staggered**: section → programme → department → college default (`effectiveBreaks`, `breakSlots`, `sectionBreakSlots`), optionally per day (e.g. longer Friday break). One shared clock keeps cross-department teacher/room clashes checkable. A shorter lunch slot uses `periodLengths`. New hard rule **H14**: every teacher keeps ≥ `teacherMinFreeInLunchWindow` free slot(s) inside `lunchWindow` on teaching days. *(user request during P0.1-b; replaced the earlier "lunch between periods" model)* `periodTimes(calendar)` derives clock times.
- Section ids are positional (`<programmeId>-a`, `-b`…) so edited names/strengths survive count changes; assignment id = `<sectionId>--<subjectId>`.
- Days/periods are 0-based indexes into the calendar; `SlotKey = \`${day}-${period}\``. Day labels come from `calendar.days`.
- IDs are readable strings prefixed by college code (`eng-t-kaur`, `eng-sec-cse-y2-a`) — unique across colleges.
- No constant anywhere encodes a count of days, periods, departments, sections or subjects.
- Subjects belong to a **programme** (curriculum), so every section of "CSE Year 2" gets the same subject list; only the teacher differs per section. Added at the user's request during v0.1.

**Tests (docs/TEST.md)**: T0.1 build · T0.2 demo sanity (unique ids, refs resolve, every entity has collegeId, all refs within same college) · T0.3 structure generates exact sections × strength, and count changes regenerate correctly · T0.4 every section gets exactly one assignment per subject of its programme; adding/removing a subject or section syncs assignments and keeps chosen teachers.

**Features & push checkpoints**
| ID | Feature | Files | Tests | Commit message |
|---|---|---|---|---|
| P0.1-a | Theme, fonts, landing shell, boilerplate removed | `theme.css`, `index.html`, `main.tsx`, `App.tsx`, `components/Wheel.tsx` | T0.1 build | `feat(ui): paper & ink theme and landing shell` |
| P0.1-b | Multi-college types (incl. Subject) + structure generator (sections + section×subject assignments) | `types.ts`, `lib/structure.ts`, `lib/structure.test.ts` | T0.3, T0.4 | `feat(core): multi-college data model and structure generator` |
| P0.1-c | Two demo colleges via config, shown on landing | `demoData.ts`, `demoData.test.ts`, `App.tsx` | T0.2 | `feat(data): two config-driven demo colleges` |
| (user) | Create GitHub repo, `git remote add origin …`, push, import repo in Vercel | — | live URL loads | — |

**Done when:** `npm run build` + `npm test` pass, pushed to GitHub, Vercel URL shows the landing with both colleges.

### Built
- **P0.1-a** `12a8fc7` — Paper & Ink theme (light + Blackboard dark), restrained type scale, wheel mark + favicon, GSAP landing (headline reveal, rotating wheel, role cards), print base. A dark "Midnight & Saffron" variant was tried and rejected by the user.
- **P0.1-b** `7485142` — `types.ts` (multi-college model, Subject per programme, Assignment = section × subject → teacher, BreakRule) and `lib/structure.ts` (`generateSections`, `syncAssignments`, `buildCollege`, `periodTimes`, `effectiveBreaks` / `breakSlots` / `sectionBreakSlots`). Staggered breaks + rule H14 added at the user's request.
- **P0.1-c** `6f4dd13` — `demoData.ts`: DIET (Mon–Sat × 7 slots, CSE/ECE/ME, 7 sections, ECE lunch staggered, cross-dept Maths & Communication teachers, 2 shared computer labs + seminar hall, a visiting teacher off on Saturdays) and DCAS (Mon–Fri × 6 slots, 30-min lunch slot, extra Friday break, Commerce/English, cross-dept Business Communication). `summarizeCollege` + `CollegeCard` show both on the landing, every number computed.
- Tests: 32 green (T0.1–T0.7).

### Open issues
- ~~Vercel not connected yet~~ → live at https://kaalchakra-seven.vercel.app (connected 2026-10-26).
- Vite dev server's Tailwind output once went stale after a newly created component (missing classes); restarting the dev server fixed it. Production build was unaffected. If classes seem missing in dev, restart the preview before debugging CSS.
- "Generate timetable" buttons are disabled placeholders until v0.2/v0.4 wire the solver.
- Root `README.md` is still the Vite template — replaced at v1.0.

---

## v0.2 Engine

### Design
**Goal:** a pure, seeded scheduling engine that never emits a clash, plus an independent validator that proves it. Works on any college shape (both demos) with no UI dependency. Hard rules H1–H14 and soft rules S1–S7 are defined in root `CLAUDE.md` §3–§4.

**Files (all pure TS under `src/solver/`, no React)**
| File | Responsibility |
|---|---|
| `rng.ts` | `mulberry32(seed)` seeded RNG + `shuffle`. No `Math.random` anywhere in the solver. |
| `validate.ts` | **Independent** checker. `validate(college, timetable) → Conflict[]` where `Conflict { rule: 'H1'…'H14', message, assignmentIds }`. Builds its own indexes; imports only `types` and the break helpers from `lib/structure`. Never imports `solve.ts`. |
| `solve.ts` | `solve(college, opts) → Timetable`. Options: `seed`, `fixed?: Placement[]` (locked slots / other departments' committed placements — treated as already booked), `assignmentIds?` (subset to schedule, e.g. one department), `leaveDays?`. |
| `score.ts` | `score(college, timetable) → { total: 0–100, parts: { spread, sameDay, teacherGaps, sectionGaps, balance, ownRooms, lateLabs } }` from S1–S7. |
| `preflight.ts` | `preflight(college) → Warning[]` capacity math before solving: unassigned teacher, no usable room (type/owner/capacity), teacher load > max/week or > max/day × workable days, section demand > free slots, lab demand vs usable lab-room slots per department. |
| `best.ts` | `solveBest(college, { attempts = 20, baseSeed })` runs seeded restarts, keeps fewest unplaced periods → then highest score. |
| `worker.ts` + `runSolver.ts` | Web Worker running `solveBest`; promise wrapper `runSolver(college)` for the UI. |

**Solver algorithm (`solve.ts`)**
1. **Sessions:** each assignment with a teacher → theory: `periodsPerWeek` single sessions; lab: blocks of `blockLength ?? calendar.labBlockLength` (+ one shorter block for any remainder). Assignments without a teacher → unplaced ("No teacher assigned").
2. **Indexes:** busy sets for teacher / section / room per `day-period`, teacher load per day & week, subject-per-section-per-day counts; pre-filled from `fixed`.
3. **Order (most constrained first):** labs before theory → fewer feasible (day, start) options → higher teacher load → seeded tie-break.
4. **Candidates:** every (day, start, room) where the whole block is legal — section not in break/blocked slot, teacher free/available/not on leave, within max/day & max/week, **H14** (teacher keeps ≥ min free slots in the lunch window that day), room type + capacity + ownership (own dept / shared / approved grant covering the slots), all slots free.
5. **Pick:** lowest soft penalty — same subject already that day (S2, heavy), spread (S1), new teacher/section gaps (S3/S4), teacher daily balance (S5), shared/borrowed room (S6), lab in last slots (S7), room best-fit (smallest room that fits), plus tiny seeded jitter for diversity.
6. **Repair (1 level):** if no candidate, try moving one non-locked placement that blocks a slot to another legal slot, then place. Bounded attempts.
7. **Unplaced with reason + suggestion** if still impossible — classified as: no teacher · no usable room · teacher at limit/unavailable · section has no free slots · no common free slot (names the section, teacher and room type).

**Checkpoints**
| ID | Feature | Files | Tests | Commit message |
|---|---|---|---|---|
| P0.2-a | Independent validator (H1–H14) | `solver/validate.ts`, `validate.test.ts` | T2.* detection: hand-made violating timetables for each rule are caught; a clean one passes | `feat(solver): independent validator for H1–H14` |
| P0.2-b | Solver core (sessions, labs, hard rules incl. H14 & room ownership, soft-penalty pick, fixed/locked placements) **+ semester calendar + leave cover engine** (user request) | `solver/rng.ts`, `solver/solve.ts`, `lib/semester.ts`, `solver/substitutes.ts` + tests | T1 both demos → 0 conflicts, 0 unplaced · T2 "never produced" (many seeds × fixtures → validator clean) · T4 determinism · T5 | `feat(solver): greedy most-constrained-first scheduler` |
| P0.2-c | Repair step, unplaced reasons & suggestions, pre-flight check | `solve.ts`, `solver/preflight.ts`, tests | T3 impossible input → reason + suggestion, still 0 conflicts · T6b preflight | `feat(solver): repair, unplaced reasons and pre-flight check` |
| P0.2-d | Quality score, seeded restarts, Web Worker; landing "Generate timetable" shows result summary (0 clashes · score · unplaced) | `solver/score.ts`, `best.ts`, `worker.ts`, `runSolver.ts`, `CollegeCard.tsx` | T6a score 0–100 · restarts never worse than single run | `feat(solver): quality score, restarts and web worker` |

**Decisions**
- Validator built first (P0.2-a) so every solver test can use it as the judge.
- **Repair is a safety net, not the main tool (measured in P0.2-c):** on 300 random colleges it rescued placements in only 2 — dynamic ordering already avoids most dead ends, and the rest are genuinely impossible input. That is why `preflight` matters: it names the impossible input before solving. Option `repair: false` exists for comparison tests.
- Meetings are ignored by the solver (they never block teaching).
- **Semester timetable (user decision during P0.2-b).** One weekly pattern rolled out over the semester's real dates: `Calendar.weekdays` + `CollegeData.semester` (start/end, holidays, no-class dates); `lib/semester.ts` → `semesterDates`, `semesterSummary`, `teachingDayCounts`, `semesterDelivery` (periods & contact hours per assignment, holidays reduce them), `classesOn(date)` (pattern + that date's substitutions). Demo semesters: DIET 20 Jul–27 Nov 2026 (105 teaching days), DCAS 3 Aug–20 Nov 2026 (74).
- **Leave cover engine pulled forward from v0.7 (user request during P0.2-b).** `solver/substitutes.ts`: `planLeaveCover` auto-allots the best free teacher per affected class (`suggested`, HOD may swap → `confirmed`; `uncovered` if nobody is free), `substituteCandidates` ranks them, `validateDate` checks a date's adjusted timetable with the independent validator. v0.7 keeps only the HOD screens (leave inbox, swap substitute, notices).
- **Leave is date-specific (user decision during P0.2-a).** Teacher requests leave for a date → HOD approves → Kaalchakra builds that date's **adjusted timetable**: each affected class gets a free same-dept substitute in the same slot, or moves to a free slot that week (other classes stay locked). The weekly master timetable never changes. The validator takes `leave` only when checking a date's adjusted timetable; `LeaveRequest` and `Substitution` carry an ISO `date`. Teachers and students see "today" with the changes highlighted. Engine built in P0.2-b (see above); screens in v0.7.
- Performance target: both demos solve 20 restarts in < 1 s in the worker. **Measured after P0.2-b:** DIET 825 ms, DCAS 257 ms for 20 solves (Node).
- **Ordering is dynamic (learned in P0.2-b):** a fixed most-constrained order dead-ended on DCAS (1 period unplaced). The solver now always places the session with the fewest legal slots *right now*; scores are cached and only sessions sharing the booked teacher, section or room are re-scored. Static legality per slot is precomputed per session.

**Done when:** all T1–T6 green, both demo colleges generate with 0 conflicts and 0 unplaced, and the landing shows the verified result.

### Built
- **P0.2-a** `f142336` — independent validator `solver/validate.ts` (H1–H14, plain-language conflicts, `mustKeep`, date-specific `leave`).
- **P0.2-b** `88bf6c0` — solver core `solver/solve.ts` (+ `rng.ts`): dynamic most-constrained-first, hard rules as filters, soft-penalty pick, fixed/locked placements, department subsets; **semester calendar** `lib/semester.ts` (user request); **leave cover engine** `solver/substitutes.ts` (user request, pulled forward from v0.7).
- **P0.2-c** `932f706` — repair step, diagnosed unplaced reasons + fixes, pre-flight check `solver/preflight.ts`.
- **P0.2-d** `b276697` — quality score `solver/score.ts`, restarts `solver/best.ts`, Web Worker `solver/worker.ts` + `runSolver.ts`, landing `GeneratePanel` (verified stamp, score, periods/week, semester hours, "Generate another").
- Results: DIET 96/100 (111 periods/week, 1,617 contact hours, 105 teaching days), DCAS 89/100 (58 periods/week, 789 h, 74 days); 20 tries in ~0.4 s / ~0.15 s in the browser worker. 167 tests green.

### Open issues
- Teacher daily **balance** is the weakest score part (DIET 75 %, DCAS 65 %) — could get a stronger S5 weight later; not a correctness issue.
- Repair rarely helps (2/300 random colleges); fine as a safety net.
- Results are not stored yet — the timetable itself becomes visible in v0.3 (grids) and persists from v0.4 (store).
- ~~Vercel still not connected~~ → live at https://kaalchakra-seven.vercel.app (2026-10-26).

---
## v0.3 Timetable views

### Design
**Goal:** after "Generate timetable", anyone can open the actual weekly timetable of any section, teacher or room, trust it (verified stamp + "why here?" for every class), and print it. Readable at phone width. Everything driven by the college's calendar — any number of days, slots, breaks (rule G4).

**Screens**
- **Landing card** → after a result, a **"View timetable"** button opens the timetable page for that college and result.
- **Timetable page** (`TimetableView`): header with college name, semester ("Odd Semester 2026 · weekly pattern · 20 Jul – 27 Nov"), verified stamp, quality score, and unplaced list (reason + fix) if any. Below: **view switch** `Section | Teacher | Room` + a picker grouped by department, a "Back" link, and **Print** / **Print all sections** buttons.
- **Grid** (`TimetableGrid`): columns = working days, rows = slots with clock times on a sticky left ruler. Section view shows that section's own break rows hatched with their label ("Lunch"); teacher view lightly shades the lunch window; room view shows nothing extra. Labs span their periods (CSS grid row span) with a diagonal-stripe texture. Cell = subject code + name, then section view: teacher · room; teacher view: section · room; room view: section · teacher. Empty slots are blank paper. On narrow screens the grid scrolls horizontally *inside its own box* (the page never does), with the time column sticky.
- **Clash Court popover**: click/Enter on a cell → popover listing every hard rule it satisfies as a checklist, e.g. "✓ Dr. Kaur has no other class at Mon P2", "✓ LT-101 seats 70 ≥ 60", "✓ Not CSE-Y2-A's break", "✓ Dr. Kaur: 3 of 4 periods that day", "✓ Lunch kept (P5 free)", "✓ Own department room". Esc / click outside closes. Keyboard reachable.
- **Motion:** cells drop into the grid with a stagger on first show; on "Generate another" or view switch, **GSAP Flip** moves cells from old to new positions. Off under reduced motion.
- **Print:** A4 landscape, one timetable per page with a header (college, entity, semester, generated at) and no UI chrome; "Print all sections" renders every section, each on its own page.

**Files**
| File | Purpose |
|---|---|
| `lib/gridModel.ts` | Pure: `buildGrid(college, timetable, view, entityId)` → rows (slot index, times, break label), cells (day, start, span, subject, people, room, placement). |
| `lib/explain.ts` | Pure: `explainPlacement(college, timetable, placement)` → checklist `{ rule, ok, text }[]` for Clash Court (independent of the solver). |
| `lib/colors.ts` | Deterministic muted pastel per subject code (hash → small Paper & Ink palette), readable ink text. |
| `components/TimetableView.tsx`, `TimetableGrid.tsx`, `ClashCourt.tsx`, `ViewPicker.tsx` | UI. |
| `App.tsx` | Simple view state: landing ↔ timetable page (no router yet; portals and routing come in v0.4). |

**Checkpoints**
| ID | Feature | Tests | Commit message |
|---|---|---|---|
| P0.3-a | Grid model + `TimetableGrid` + `TimetableView` with Section/Teacher/Room picker, opened from the card | T3.1 grid model: one cell per placement of the entity, labs span `length` rows, section break rows come from its own (staggered) breaks, teacher view includes cross-department classes, rows/cols follow any calendar shape · T3.2 colours deterministic | `feat(ui): timetable grids by section, teacher and room` |
| P0.3-b | Verified stamp, score, unplaced list on the page + Clash Court popover | T3.3 `explainPlacement`: every check ✓ for a solver placement; a hand-made clash shows the failing check (agrees with the validator) | `feat(ui): clash court — why every class is where it is` |
| P0.3-c | GSAP cell-drop + Flip on regenerate/switch + print (single and all sections) | manual: M8 print preview, M9 phone width (no page scroll), M10 reduced motion | `feat(ui): grid motion and print-ready timetables` |

**Decisions**
- Shows the **weekly pattern** (it repeats all semester). A real-date view ("today", with substitutions) belongs to the Teacher/Student portals in **v0.6** — not built here.
- No persistence yet: the timetable lives in memory until the store arrives in **v0.4**; a page refresh returns to the landing.
- No router library: a tiny view state in `App` keeps v0.3 small; v0.4 adds portals.

**Done when:** a user can generate DIET or DCAS, open any section/teacher/room grid, click any class to see why it is legal, print one or all sections, and the page never scrolls sideways at phone width.

### Built
- **P0.3-a** `73f2053` — `lib/gridModel.ts`, `lib/colors.ts`, `TimetableGrid`, `ViewPicker`, `TimetableView`; card "View timetable"; results kept while navigating; hero CTA jumps to colleges.
- **P0.3-b** `88a955c` — Clash Court: `lib/explain.ts` (independent checklist, agrees with the validator) + `ClashCourt` popover / phone bottom sheet; result strip (stamp, score, periods, hours, unplaced + pre-flight) on the page; shared `VerifiedStamp`.
- **P0.3-c** `d8d5440` — `components/gridMotion.ts` (drop-in + Flip), "Generate another" on the page, Print / Print all sections with A4-landscape print CSS.
- 184 tests green; browser-checked at 349 / 375 / 768 / 1280 px.

### Open issues
- ~~Real print dialog not exercised~~ → checked 2026-10-26 through Chrome's print-to-PDF engine. A user saw **no preview** in the dialog (the in-app browser uses the Windows system dialog); fixed with Kaalchakra's own print preview (`components/PrintSheets.tsx`) that opens first. One hand check in Chrome's Ctrl+P on the live URL remains (M8).
- Reduced-motion path is coded but not yet checked with the OS setting (M10).
- Timetables still live in memory only — persistence arrives with the store in v0.4.
- Tailwind dev server needs a restart after new component files (stale classes) — dev-only quirk.

---
## v0.35 Finder & filters

### Design
**Goal:** answer the questions people actually ask about a timetable in seconds — *who is free now? which lab is empty Friday after lunch? when can these three teachers meet? show me only the labs* — without reading every grid. Pure logic in `lib/`, used later by the HOD substitute picker (v0.7), Room Exchange (v0.5), Meet-a-Teacher (v0.6) and the chatbot (v0.8).

**Logic (pure, tested)**
| File | Functions |
|---|---|
| `lib/finder.ts` | `occupancy(college, timetable)` → busy index for teachers / sections / rooms per slot · `freeTeachers(day, periods, { deptId?, subjectCode? })` → free & available teachers with their load that day and whether they teach that subject, best first · `freeRooms(day, periods, { type?, minCapacity?, forDeptId? })` → free rooms with `usable: 'own' \| 'shared' \| 'needs-grant'` · `weekStrip(kind, id)` → busy / free / break for every slot · `nextFree(kind, id, from)` · `commonFree(entities[])` → slots where *all* chosen teachers / rooms / sections are free · `nowSlot(calendar, date)` → which pattern day + period "now" is (or null outside hours). |
| `lib/filters.ts` | `Filters { deptId?, subjectCode?, kind?: 'theory'\|'lab', roomType?, day? }` · `matches(cell, filters)` · `toSearch` / `fromSearch` (filters ↔ URL query, so a filtered view can be bookmarked or shared). |

**Screens**
- **Filter bar** above the grid: chips for *Theory / Lab*, a subject picker (subjects of the current college), day picker, room type, department. Non-matching classes fade back (not removed, so the week's shape stays readable); a count shows "6 of 17 classes match". "Clear" resets. View, entity and filters live in the URL query.
- **"Who's free?" tab** next to "Timetable" on the page:
  - pick a **day + period(s)** or press **Now** → two lists: **Free teachers** (filter by department / subject; each shows "2 periods that day · teaches DS") and **Free rooms** (filter by type & minimum seats; badge *own dept / shared / needs a grant*);
  - **Is X free?** — choose any teacher / room / section → a compact week strip (busy · free · break) with "Next free: Tue P3";
  - **Common free slot** — tick several teachers / rooms / sections → every slot where all are free (for meetings, extra classes, practicals).
- **Ctrl / ⌘ + K palette** on the timetable page: type any section, teacher, room or subject (fuzzy match) → Enter jumps to that grid (a subject applies the subject filter). Keyboard only, Esc closes.

**Checkpoints**
| ID | Feature | Tests | Commit message |
|---|---|---|---|
| P0.35-a | `lib/finder.ts` + `lib/filters.ts` | T35.1 free teachers exclude busy, unavailable and over-limit teachers · T35.2 free rooms by type & capacity with correct usable badge · T35.3 `commonFree` = intersection · T35.4 `nextFree` / `weekStrip` · T35.5 filters match + URL round-trip · `nowSlot` maps real times | `feat(core): finder and filters` |
| P0.35-b | Filter bar on the grid (fade non-matching, match count, URL state) | T35.6 URL round-trip + seed reproduces the timetable · manual M16: filter → count, shareable URL restores the view | `feat(ui): timetable filter bar` |
| P0.35-c | "Who's free?" tab (free teachers / rooms, Now, Is X free, common free slot) + Ctrl/⌘+K palette | T35.7 fuzzy matcher · manual M6: Now, free lab Fri after lunch, common slot, palette jump | `feat(ui): who's free finder and quick search` |

**Decisions**
- Everything is visible to everyone for now; **role scoping** (HOD sees own dept, students only their section, students never see free-room finder) arrives with `access.ts` in **v0.4** — the finder takes an optional scope so no rewrite is needed.
- Works on the **weekly pattern**. A date-aware "who's free on 26 Oct" (holidays, substitutions) belongs to v0.6/v0.7, where real dates are shown.
- Fuzzy search is a small built-in subsequence matcher — no new library.
- **Shareable URL carries the seed (decided in P0.35-b).** Timetables are not stored until v0.4, so the link holds `college` + `seed` (+ view, entity, filters); opening it re-runs one solver attempt at that seed, which rebuilds the identical timetable (solver is deterministic). From v0.4 the link can point at the stored/published version instead.

**Done when:** on the demo timetable a user can filter to labs only, find a free lab on Friday after lunch, find the common free slots of three teachers, and jump to any teacher with Ctrl+K — all from the keyboard as well as the mouse.

### Built
- **P0.35-a** `5e991cc` — `lib/finder.ts` (occupancy, free teachers / rooms, week strip, next free, common free, now slot) + `lib/filters.ts`; 16 tests.
- **P0.35-b** `24ff73b` — `FilterBar` (theory/lab, subject, day, room type, department; match count; Clear); non-matching classes fade via CSS `filter` (never fights GSAP); `lib/viewUrl.ts` puts college, seed, view, entity, filters (and later tab) in the URL — a shared link re-solves the seed and restores the exact view.
- **P0.35-c** `443b3aa` — "Who's free?" tab (`WhoIsFree`: free at a time with Now, Is it free? strip + next free, common free slot; free cells and names are clickable) and Ctrl/⌘+K `CommandPalette` with a built-in fuzzy matcher (`lib/fuzzy.ts`).
- Done-when met on DIET: labs-only filter, a free lab on Friday after lunch (CL-1 / CL-2 shared), common slots of three teachers (22), Ctrl+K jump to any teacher — all keyboard-reachable. 206 tests green.

### Open issues
- No role scoping yet: everyone sees every finder list (students will not see free rooms) — arrives with `access.ts` in v0.4; the finder functions already take optional scope options.
- Finder works on the weekly pattern only; date-aware "who's free on 26 Oct" (holidays, substitutions) belongs to v0.6/v0.7.
- Shared links carry the solver seed because nothing is stored yet; from v0.4 they should point at the stored / published version.
- "Now" uses the device clock and local time zone; fine for a single-campus demo.

---
## v0.4 Super Admin + College Admin portals

### Design
**Goal:** Kaalchakra becomes a real multi-college platform that remembers everything. A **Super Admin** creates, clones and archives colleges and shapes each one in the **Structure Builder**; a **College Admin** fills in rooms, teachers, availability and who-teaches-what (by hand or pasted from Excel), generates the whole college, checks it and **publishes** a version. Every screen reads through `access.ts`, so data of college A never shows in college B. Data persists in localStorage. Roles still come from a role + college switcher (auth is v0.9).

**Data & logic (pure, tested)**
| File | Responsibility |
|---|---|
| `store.ts` | zustand + `persist` (key `kaalchakra`, `version: 1` + `migrate`). State: `platform.colleges: CollegeData[]`, `session: Session`. Seeds the two demo colleges (via `buildCollege`) on first load; **Reset demo data**. Actions are thin: each calls a pure function from `lib/edit.ts` / `lib/publish.ts` on one college (found by `collegeId` first, rule G1) and replaces it. |
| `lib/access.ts` | `visibleColleges(session, platform)` (super: all, read-only · others: own college only, never archived ones) · `can(session, action, collegeId)` for `editStructure` (super only) · `editSetup` / `generate` / `publish` / `export` (collegeAdmin of that college) · `viewDraft` (super read-only + collegeAdmin) · `viewPublished` (everyone in that college). Components never check roles inline. |
| `lib/edit.ts` | Pure edits that keep a college consistent: calendar (days ↔ weekdays, slots, times, per-slot lengths, breaks, lunch window, lab block, blocked slots), semester (dates, holidays, no-class days), department / programme / subject add · update · remove (sections regenerate with `generateSections`, assignments re-sync with `syncAssignments`, chosen teachers kept), section rename / strength / breaks, rooms, teachers (incl. unavailable slots), assignment teacher. Any structure or setup edit **marks the draft stale** (`draftStale: true`) — still viewable, but it cannot be published until regenerated. `cloneCollege(data, code, name)` re-ids every record under the new college id. `newCollege(code, name)` = a small blank template (5 days × 6 slots, a lunch slot, one department, one programme, one section) built through `buildCollege`. |
| `lib/publish.ts` | `publish(college, now)` → refuses with the reason if the draft is missing, stale, or the independent validator reports **any** conflict (root §5); unplaced periods need an explicit `acceptUnplaced`. Stores `published = { timetable, version: n+1, at }` and appends `{ version, at, score, periods }` to `publishLog`. `unpublish(college)`. |
| `lib/csv.ts` | papaparse, tab- or comma-separated, header row optional. `parseTeachers` (`name, dept code, max/day, max/week`), `parseRooms` (`name, type, capacity, owner dept code or "shared"`), `parseAssignments` (`section, subject code, teacher name`). Returns `{ rows, errors: { line, message }[] }`; names resolve within **this** college only. |
| `solver/best.ts` | + `describeTimetable(college, timetable)` → the same summary `SolveResult` carries (score, conflicts, pre-flight, hours…), so the store keeps only the `Timetable` and the UI recomputes the rest. |
| `types.ts` | `CollegeData` gains `draftStale?: boolean` and `publishLog: { version, at, score, periods }[]`; `College.collegeAdminIds` holds admin display names until v0.9 links real users. |

**Screens**
- **Header** (every page): wordmark · `RoleSwitcher` (role chips in the role accent colours) · `CollegeSwitcher` (only colleges `access.ts` allows; hidden for Super Admin) · current-role badge. The session persists, so a refresh reopens the same portal. Light hash routes (`#/super`, `#/super/<collegeId>/structure`, `#/college/setup`, `#/college/generate`, …) — no router library.
- **Landing:** hero stays; the five role cards become **"Enter as …"** buttons; the colleges section lists the colleges in the store (new ones appear). HOD / Teacher / Student show a short "arrives in v0.5 / v0.6" panel in v0.4.
- **Super Admin → Colleges:** a card per college — status (active / archived), counts from `summarizeCollege`, draft / published version, last score, clash count (read-only status). Actions: **New college** (name + code → blank template, or **Clone** an existing one), **Open Structure Builder**, **View timetable** (read-only), **Archive / Restore**, College Admin names.
- **Structure Builder** (Super Admin): tabs **Calendar** (working-day chips mapped to real weekdays, slots per day, start time, slot length + per-slot lengths, breaks per day with labels, lunch window, teacher min free in the lunch window, lab block length) · **Semester** (dates, holidays, no-class days, live "N teaching days") · **Departments** (add / rename / archive, department breaks) · **Programmes** (per department: name, short name, **number of sections**, **students per section**, breaks → generated sections listed live) · **Subjects** (per programme: code, name, theory / lab, periods per week, lab block, room type). A side panel shows the live summary and **pre-flight** warnings with fixes, so impossible structures are caught before anyone generates.
- **College Admin → Setup:** tabs **Sections** (rename, strength, section breaks) · **Rooms** (department and **shared** rooms: name, type, capacity, owner) · **Teachers** (name, department, max/day, max/week, **availability grid** — click slots to mark unavailable; grid shape from the calendar) · **Assignments** (per section: each subject → teacher picker; unassigned highlighted) · **Blocked slots** (click grid) · **Paste from Excel** (pick teachers / rooms / assignments, paste, preview good rows + row errors, Import). Every tab shows the pre-flight count.
- **College Admin → Generate & publish:** pre-flight panel → **Generate whole college** (worker, 20 tries) → saved as the draft → result strip + the existing `TimetableView` (grids, filters, Who's free?, Clash Court, print) → **Publish** (blocked with the validator's reasons on any conflict; confirm if periods are unplaced) · **Unpublish** · version history · **Export JSON** / **Import JSON** (whole college, validated: ids, `collegeId`, references).
- `TimetableView` gains `readOnly` (no Generate another) for Super Admin. Once timetables are stored, shared links point at `?college=…&v=<published version>` (or the draft) instead of a seed.

**Checkpoints**
| ID | Feature | Tests | Commit message |
|---|---|---|---|
| P0.4-a | Store (persist, seed, reset, migrate) + `access.ts` + RoleSwitcher / CollegeSwitcher + hash routes + landing "Enter as …" | T4.2 persist → reload identical · T4.4 collegeAdmin sees only own college · T4.6 super sees all, cannot edit setup / generate / publish; college A never visible to B | `feat(core): persistent multi-college store and role access` |
| P0.4-b | Super Admin colleges list: new (blank template), clone, archive / restore, read-only status + timetable | T4.7 clone: every id re-prefixed, refs resolve, no id shared with the source, solves with 0 conflicts · blank template solves | `feat(super): colleges list, create, clone and archive` |
| P0.4-c | Structure Builder (calendar, semester, departments, programmes, subjects) + live pre-flight | T4.5 change sections count / strength / slots per day → sections & assignments regenerate; a 5-day × 5-slot calendar still solves with 0 conflicts · T4.9 add / remove subject or department keeps other assignments and chosen teachers; edits mark the draft stale | `feat(super): structure builder` |
| P0.4-d | College Admin setup (sections, rooms, teachers + availability grid, assignments, blocked slots) + paste-from-Excel | T4.1 csv: good rows parsed, bad rows reported with line numbers, names resolved within the college only | `feat(college): college setup and paste from excel` |
| P0.4-e | Generate whole college → draft → Publish / Unpublish / version log + Export / Import JSON | T4.3 export → import identical · T4.8 publish blocked on conflict or stale draft, version increments, unpublish clears | `feat(college): generate, publish and versions` |

**Decisions**
- **Store holds data, logic stays pure.** Every edit is a tested function in `lib/edit.ts` / `lib/publish.ts`; the zustand store only routes it to the right college. The solver and validator stay untouched (they already take a `CollegeData`).
- **Only the `Timetable` is stored**; score, conflicts and pre-flight are recomputed (`describeTimetable`), so they can never drift from the data.
- **Edits mark the draft stale instead of deleting it** — the admin can still look at it, but Publish needs a fresh generate. A published version stays live until replaced or unpublished.
- **College Admin sets up all rooms in v0.4** (department + shared). HOD department CRUD and Room Exchange are **v0.5**, Teacher / Student portals **v0.6**, real logins **v0.9**. Role scoping of the v0.35 finder (students never see free rooms) is applied through `access.ts` when those portals arrive.
- Super Admin has **no generate / publish / setup edits** (root §2) — structure and read-only status only.
- If time runs short: paste-from-Excel is the last part of P0.4-d to build; Export / Import JSON the last part of P0.4-e.
- **Decided in P0.4-a:** routes are only `#/<portal>` for now (sub-routes come with the screens that need them); the shown portal always follows the session's role, the URL is corrected to match. The college switcher lists every active college — it stands in for logging in, not for data access. Super Admin's session remembers the last college so switching back to another role lands there (its access ignores it).
- **Decided in P0.4-d:** pasted names (department, section, subject, teacher) resolve only inside the open college; an existing teacher / room name is refused rather than silently updated; removing a teacher sends their classes back to "no teacher yet" (pre-flight then asks). **All open tabs share one saved state** — each reloads when another saves (found as a data-loss bug while testing). Main bundle passed 500 kB (papaparse) — code-split the portals later.
- **Decided in P0.4-c:** department, programme and subject **codes are fixed once created** (record ids derive from them); names, counts and everything else stay editable. Removing a department that still owns teachers or rooms is refused (those belong to the College Admin's setup). Changing "students each" updates only sections still at the old default. Day-indexed data (breaks, blocked / unavailable slots, grants, office hours) follows its real weekday when working days change; anything past the last slot is dropped when slots shrink. Builder tab lives in the URL (`#/super/<id>/structure/<tab>`).
- **Decided in P0.4-b:** a clone copies structure + setup (incl. grants and office hours) but never timetables or date-specific records, and starts with no College Admins. College codes may not overlap another college's id prefix (e.g. "DIET CSE" → `diet-cse-…` would mix with DIET's records). Super Admin can open a draft only read-only and only while one exists in this browser session — stored drafts arrive in P0.4-e.

**Done when:** a Super Admin creates a new college (or clones DIET) and shapes its calendar, departments, programmes and subjects; switched to that college's College Admin, they add rooms and teachers (one batch pasted from Excel), assign teachers, generate with 0 clashes and publish v1; after a browser refresh everything is still there; and the College Admin of DCAS never sees any of it.

### Added design — flexible lunch (user request after P0.4-b, 2026-10-26) · *approved and built (P0.4-x)*
**Request:** a section's lunch may sit in a different slot on different days, and Kaalchakra may choose it — "either 11:30 or 12:30" — when that gives a better timetable. This is an **engine change** (v0.2 area: solver, validator, rule H7) requested during v0.4; built as its own checkpoint **P0.4-x before P0.4-c**, so the Structure Builder can edit it.
- **Already possible:** a *fixed* lunch that differs by day (`BreakRule.days`, e.g. P4 Mon–Wed, P5 Thu–Sat) at college / department / programme / section level — only the editing screen is missing (P0.4-c).
- **New — flexible break:** `BreakRule.options?: number[]` (slot indexes, e.g. `[3, 4]` = DIET's 11:30 and 12:20 slots — times always come from the calendar, never hard-coded, rule G2). On each working day of the rule (all days, or its `days`), **exactly one option slot stays free** for the section as its break; `period` is the preferred slot.
- **Solver:** option slots are teachable, but a class may never take a section's *last* free option that day (same idea as H14 for teachers); a lab block can never cover every option. A soft penalty keeps lunch at the preferred slot, so it moves only when that buys a better placement. No second algorithm — the same legality filter, one more check.
- **Validator (independent):** H7 = no class in a fixed break or blocked slot **and**, for every flexible rule and day, at least one option slot free for the section.
- **Views:** one helper `resolvedBreakSlots(college, section, busy)` in `lib/structure.ts` picks the slot that is actually lunch each day (preferred if free, else the first free option); the grid, Clash Court ("Lunch at 12:20 today — 11:30 is taken by DS"), Who's free and pre-flight use it. Pre-flight counts a flexible break as one slot per day.
- **Demo:** DIET **ME Year 3** gets a flexible lunch `[P4 11:30, P5 12:20]` to prove it; everything else unchanged.
- **Tests (T7f.1–T7f.4):** the solver never fills all options of a day (many seeds × random colleges, validator clean); the validator catches a hand-made "no lunch left" day; both demos still 0 clashes / 0 unplaced, quality not lower than with the fixed lunch; the resolved lunch is shown in the grid / explain / finder.
- **Root CLAUDE.md:** H7 got one sentence for flexible breaks (user approved, 2026-10-26).
- **Learned while building:** on DIET the lunch never moves (96/100 either way) — the small penalty keeps 11:30 unless moving buys a placement; a test college with a 4-period lab shows the move. Colleges already saved in a browser keep their old breaks (the demo is only a seed) — "Reset demo data" picks up the new demo.
- **Room lending for one class on one day** (asked at the same time) = Room Exchange, **v0.5 (P0.5-c)**; the engine already supports slot grants (H11).

### Built
- **P0.4-a** `7f63b9c` — `store.ts` (zustand persist, demo seed through `buildCollege`, reset, migrate / corrupt → seed), `lib/access.ts` (`visibleColleges`, `collegeFor`, `can`, `sessionFor`), hash routes `lib/route.ts`, RoleSwitcher / CollegeSwitcher, landing "Enter" per role, portal shells.
- **P0.4-b** `f8bc701` — Super Admin colleges: new college from a blank template, clone (every id re-prefixed), archive / restore, College Admin names, read-only status.
- **P0.4-x** `28e20c7` — **flexible lunch** (user request, engine change): `BreakRule.options`, solver keeps one option free per day, independent H7 check, resolved lunch in grid / Clash Court / Who's free / pre-flight; root H7 got one sentence (approved).
- **P0.4-c** `4280341` — **Structure Builder** `#/super/<id>/structure/<tab>`: calendar (days, slots, times, slot lengths, lunch window, lab block, breaks incl. per-day and flexible), semester, departments & years (sections × students), subjects; live pre-flight; pure structure edits in `lib/edit.ts`.
- **P0.4-d** `cf0274d` — **College Admin setup** `#/college/setup/<tab>`: teachers + availability grid, who teaches what, rooms (own / shared), sections, blocked slots, **paste from Excel** (`lib/csv.ts`); shared `SlotGrid`, `PreflightPanel`, `BreakEditor`; **tab sync** (an older tab no longer overwrites newer edits).
- **P0.4-e** — the generated timetable is stored as the **draft** (`setDraft`, `describeTimetable`), **publish** rules in `lib/publish.ts` (blocked on no draft, stale draft or any clash; unplaced needs an OK; versions + history; unpublish), **export / import** in `lib/transfer.ts` (`checkCollege`), Publish panel on the College Admin desk, Super Admin reads drafts read-only.
- Done-when met: a new college (PEC) shaped in the Structure Builder, filled by pasting from Excel, generated with 0 clashes (98/100); DIET published v1 → v2 → unpublished → v3 with history; everything survives a reload; DCAS's College Admin never sees another college. 274 tests green.

### Open issues
- **Bundle > 500 kB** after minification (papaparse + four desks) — code-split the portals with `import()` before v1.0.
- Landing "Generate" is an in-memory preview (not saved) and shared links still carry the solver seed; links to a stored draft / published version can come with the Teacher / Student portals (v0.6).
- Teachers and students don't see the published version yet — their desks are **v0.6**; HOD department screens and Room Exchange (incl. lending a room for one class on a given day, asked by the user) are **v0.5**.
- Import replaces the whole college (with a confirm); there is no merge and no undo — export first is the advice in the UI.
- Codes of departments / programmes / subjects are fixed once created (ids derive from them).
- Browsers that saved data before P0.4-x keep the old demo breaks until "Reset demo data".
- Still to hand-check: Chrome's Ctrl+P on the live URL (M8) and the OS reduced-motion setting (M10).

---

## v0.5 HOD portal + Room Exchange

### Design
**Goal:** departments plan in parallel without ever clashing. A **Head of Department (HOD)** keeps their own department ready — teachers, who teaches what, subjects, sections, department rooms — generates **only their department** against everything the rest of the college has already booked, and marks it **Ready**. Idle department rooms can be **lent**: one HOD offers or another requests a room for chosen weekly slots, the owner approves, the borrower's timetable may then use exactly those slots. All scoping goes through `access.ts` (root §2: HOD writes only their own department).

**Data & logic (pure, tested)**
| File | Responsibility |
|---|---|
| `types.ts` | `Grant` gains `kind: 'offer' \| 'request'`, `note?`, `createdAt`, `decidedAt?` (status flow `offered → approved` when the borrower takes it · `requested → approved / rejected` by the owner · `approved → revoked` by the owner). `Department.status` (`draft` / `ready`) is finally used. `Session.deptId` set for HODs. |
| `lib/access.ts` | HOD actions on **own department only**: `editDept` (teachers of the dept, its sections' names / strength / breaks, subjects of its programmes, rooms it owns, who teaches its sections — any teacher of the college may be chosen), `generateDept`, `markReady`, `exchange` (offer / request / approve / revoke grants where the dept is owner or borrower). Read: own department's grids + shared rooms + rooms granted to it. `deptScope(session)` gives the department id or none. College Admin keeps everything it has; Super Admin unchanged. `sessionFor('deptAdmin')` picks the first department of the college; a **department switcher** appears for HODs. |
| `lib/deptPlan.ts` | `generateDept(college, deptId, opts)` options for `solveBest`: `assignmentIds` = the department's assignments, `fixed` = every **other** department's placements from the college draft (the global ledger) — no second algorithm (root §5). `mergeDept(college, deptId, result)` → new college draft: other departments' placements untouched, this department's replaced, other departments' unplaced kept. `readiness(college, deptId)` → checklist (every class has a teacher · no pre-flight error for the dept · the dept is in the draft with nothing unplaced · draft not stale). `markReady` / back to `draft` on any edit of the dept. |
| `lib/exchange.ts` | `requestRoom(college, borrowerDeptId, roomId, slots, note)` · `offerRoom(college, ownerDeptId, roomId, slots, toDeptId, note)` · `accept(college, grantId)` (borrower takes an offer) · `approve` / `reject` (owner decides a request) · `revoke` (owner) · `affectedBy(college, grantId)` → borrower placements that would lose their room · `freeSlotsOf(college, roomId)` from the draft (via `finder.weekStrip`). Every change marks the draft stale when it can change what is legal. |

**Screens**
- **HOD desk** `#/dept` (accent terracotta): header with the department (switcher), **status chip** Draft / Ready.
  - **Overview:** readiness checklist with links to fix each item · **Generate my department** (worker, 20 tries, against the rest of the college) → result strip (0 clashes · score · unplaced) → saved into the college draft → **View timetable** (sections, teachers and rooms of this dept; shared and borrowed rooms; read-only for other departments) · **Mark Ready** (enabled when the checklist is green) · **teacher load chart** (periods given vs weekly limit per teacher, bars from the curriculum).
  - **Setup** `#/dept/setup/<tab>`: the College Admin setup tabs reused with a **department scope** — Teachers (own), Who teaches what (own sections), Subjects (own programmes), Sections (own), Rooms (own), Paste from Excel (rows outside the dept refused with a reason).
  - **Room Exchange** `#/dept/exchange`: *My rooms* (each with its free slots this week and incoming requests → Approve / Reject; Offer idle slots to a department; approved loans → Revoke with "N classes will lose this room") · *Borrow a room* (find a free room of a type and size, pick weekly slots on its free-slot grid, add a note → Request; open offers → Accept) · history.
- **College Admin desk:** a **Departments** strip — each department's status (Draft / Ready) and unplaced count; Room Exchange ledger (read-only list of all grants). Publishing still needs only a clean draft; departments not Ready show a warning, not a block.
- **Super Admin:** unchanged.

**Checkpoints**
| ID | Feature | Tests | Commit message |
|---|---|---|---|
| P0.5-a | HOD session + department switcher, `access.ts` HOD rules, HOD desk with department-scoped Setup (reused tabs), teacher load chart, readiness checklist + Mark Ready (any edit → Draft) | T5.1 HOD sees / edits only own department (+ shared and granted rooms read) · readiness rules · scoped paste refuses other departments | `feat(dept): hod desk with department setup and ready status` |
| P0.5-b | Generate my department against the global ledger → merged into the college draft; HOD timetable view scoped to the dept; College Admin departments strip | T5.2 dept A then dept B → 0 global conflicts · merge leaves other departments' placements and unplaced identical · stale and fixed placements respected | `feat(dept): department generate against the college ledger` |
| P0.5-c | Room Exchange: offer / request / accept / approve / reject / revoke weekly slot grants; free-slot picker; revoke warns and the draft goes stale; College Admin ledger | T5.3 no grant → another department's room never used · T5.4 approved grant → borrower uses only the granted slots · T5.5 revoke → affected placements listed and the validator flags them (H11) · every transition is legal only for the right HOD | `feat(dept): room exchange between departments` |

**Decisions**
- **One ledger, one algorithm.** The college draft is the global booking ledger; a department generate is `solveBest` with the other departments' placements as fixed bookings, merged back. The College Admin's "Generate whole college" stays and simply replaces everything.
- **Grants are weekly slots** ("Lab-2, every Thursday P3–P4"), because the timetable is a weekly pattern. The user's ask — *lend a department room for one class on a particular day* — is met for a weekday slot that repeats every week. A **one-off loan for a single date** (e.g. only 26 Oct) belongs with date-specific changes (leave cover, adjusted timetables) in **v0.7**.
- **HOD edits stay inside the structure the Super Admin set:** no new programmes or section counts, but subjects of the department's programmes are theirs (root §2). Shared rooms remain the College Admin's.
- **Ready is a signal, not a lock:** any edit to the department returns it to Draft; College Admin can publish with departments not Ready (warned).
- Leave approval and substitutes on the HOD desk are **v0.7** (screens on the engine built in v0.2).
- If time runs short: the load chart and the College Admin ledger list are the first to drop; the offer flow can drop before the request flow.
- **Decided in P0.5-b:** a department generate clears the college-wide stale flag; from then on a draft is judged by **coverage** (every period of every class placed or reported) + the independent clash check — per department on the HOD desk, for the whole college when publishing. So an ME-only change holds back only ME, while a college-wide change (e.g. a blocked slot) holds back every department with a class there. A regenerated department goes back to Draft until its HOD marks it Ready again. HOD timetable pickers show their department plus the teachers and rooms it uses; the finder (Who's free?) is still college-wide (role scoping of the finder comes with v0.6).
- **Decided in P0.5-a:** the College Admin may also edit and generate any department (it runs the whole college), but **Ready** and **room loans** belong to HODs. Readiness counts only the department's own pre-flight *errors* (a missing teacher is a warning and has its own checklist line). An HOD chooses teachers from the whole college for their sections (shared faculty), but adds teachers and rooms only to their own department; shared rooms stay with the College Admin. Subjects of the department's programmes are editable on the HOD desk (root §2), programmes and section counts stay with the Super Admin.

**Done when:** an HOD of DIET CSE fixes their setup, generates CSE against the rest, and marks it Ready; the ECE HOD requests CSE's lab for Thursday P3–P4, the CSE HOD approves, ECE re-generates and uses that lab only then; revoking it lists the affected class and blocks publishing until ECE re-generates; nothing ever clashes across departments; and an HOD can never edit another department.

### Added design — semester room allocation + single-date room requests (user request before v0.6, 2026-10-26) · *approved; P0.5-d and P0.5-e built*
**Request:** the timetable is one weekly pattern for the whole semester, so a room another department uses is in effect theirs for the semester — the person who designs the timetable (the **College Admin**) should assign rooms, including other departments' rooms. Keep requesting, for when someone needs a specific room **on a particular day**. User's choices: allocation **automatic + hand edits**; requests **single dates, keep the weekly HOD loans**; a single-date request is approved by **the HOD who owns the room** (shared rooms → College Admin).
This reworks v0.5's room rules and pulls single-date loans forward from **v0.7**; built as **P0.5-d** and **P0.5-e** before v0.6.

**P0.5-d — the College Admin assigns rooms for the semester**
- **Whole-college generate** (`solveBest` option `anyRoom`, College Admin only): every suitable room of the college may be used — own department first, shared next, another department's room only when it helps (a heavier soft penalty than shared, S6). Department generate by an HOD keeps today's rules (own · shared · loans · allocations to it).
- **Allocations are recorded, never silent:** `syncAllocations(college)` derives, from the draft **and** the published version, every class sitting in another department's room and keeps exactly those as `Grant { kind: 'allocation', status: 'approved' }` (from the owner to the user department, its weekly slots). So rule H11 stays true (an approved grant covers the slot), the validator stays independent, HOD generates honour them, and the published version stays valid while a newer draft changes things. Allocations are the College Admin's: HODs see them ("Allocated for the semester by the College Admin") but cannot revoke them; weekly HOD loans keep working as before.
- **Hand edits:** on the College Admin's timetable, Clash Court gets **"Move to another room"**: rooms of the right type and size that are free for the whole block, labelled *own · shared · other department (will be allocated)*; `moveToRoom(college, placement, roomId)` checks type, seats and that the room is free, updates the draft and re-syncs allocations. The validator re-checks everything.
- **Tests (T5.6, T5.7):** squeezed labs → whole-college generate puts ECE's labs in the CSE lab, records them as allocations, 0 conflicts; with enough own rooms no other department's room is used; an HOD re-generating a department keeps its allocated rooms; moving a class into another department's room creates the allocation and moving it back removes it (unless the published version still uses it); unsuitable / busy rooms refused.

**P0.5-e — single-date room requests**
- `RoomBooking { id, collegeId, roomId, deptId (asker), date, periods, purpose, status: requested · approved · declined · withdrawn · needsNewRoom, createdAt, decidedAt? }` — a room for **one date** (extra class, seminar, test). It never changes the weekly pattern.
- `lib/bookings.ts`: `freeOnDate(college, roomId, date)` from the **published** timetable on that real date (holiday / no-class days are free) minus blocked slots and other approved bookings; `requestBooking`, `decideBooking` (the room's HOD; shared rooms → College Admin), `withdraw`; a booking for a date in the past or outside the semester is refused. `bookingsAfterPublish` marks approved bookings whose slot a new published version now needs as **needsNewRoom** (like meetings).
- Screens: HOD Room Exchange gets **"Book a room for a day"** (pick room, date, free periods, purpose) and the bookings to decide; College Admin decides bookings of shared rooms and sees every booking in the ledger. (Teachers and students will see bookings on *Today* in v0.6.)
- **Tests (T5.8):** free periods follow the published day of that date; owner HOD (or College Admin for shared rooms) decides, nobody else; the same period of a room is never booked twice; past dates refused; a re-publish that needs the slot → needsNewRoom.

- **Learned in P0.5-d:** letting every room be a candidate made the solver 4–17× slower (the cache re-scored every session sharing any room). Two exact / safe fixes: the room loop stops once no later room can beat the best (rooms sorted by owner penalty, then size), and with `anyRoom` a room-sharer is re-scored only when its cached best choice sits in the booked room and time — cached choices stay legal, only the option count can be slightly stale. DIET 0.74 s → 0.58 s for 20 tries with all rooms; scores unchanged (DIET 96, DCAS 90).

**Root CLAUDE.md (needs the user's OK):** H11 gets one sentence — *"The College Admin may allocate another department's room for the semester; every such use is recorded as an approved allocation grant, so the rule still holds."* — and §2 gains "allocate rooms across departments" for `collegeAdmin` and "request a room for a single date" for `deptAdmin`.

### Built
- **P0.5-a** `74d652a` — **HOD desk** `#/dept`: HOD rules in `lib/access.ts` (`DeptAction`, `canDept`, `deptScope`; session `deptId` + department switcher), `lib/deptPlan.ts` readiness checklist + Ready / Draft (`markReady`, `deptEdit`), teacher load bars, department-scoped Setup reusing the College Admin tabs (+ Subjects) and scoped paste (`limitToDept`).
- **P0.5-b** `6171526` — **Generate my department**: `deptSolveOptions` (other departments' placements as fixed bookings — same `solveBest`), `mergeDept`, `coverage`; per-department staleness (judged by coverage + the independent clash check); department-scoped timetable pickers; College Admin **Departments** strip; department remembered across role switches.
- **P0.5-c** — **Room Exchange**: weekly slot loans (`lib/exchange.ts`: request / offer / approve / reject / revoke / `affectedBy` / `unavailableSlots` / `describeSlots`), HOD Room Exchange tab with slot picker and "N waiting" badge, revoke warns with the affected classes, College Admin ledger. No engine change: approved grants were already honoured by the solver, validator (H11), pre-flight and finder.
- **P0.5-d** `d64f465` — **College Admin allocates rooms for the semester** (user request): solver option `anyRoom` for whole-college generate (other departments' rooms only when they help), `lib/allocation.ts` (`syncAllocations` → approved `allocation` grants from the draft + published version, so H11 holds; `roomOptions`, `moveToRoom`), Clash Court **Move to another room**, ledger "Rooms across departments"; all-rooms solve sped up from 7.3 s to ~0.5 s.
- **P0.5-e** — **Single-date room requests** (user request, from v0.7): `RoomBooking` + `lib/bookings.ts` (free periods from the published day of that date, owning HOD or College Admin for shared rooms decides, own rooms booked at once, `needsNewRoom` after a re-publish); HOD **Book a room for a day** + requests to decide; College Admin **Day bookings** panel. The weekly pattern never changes.
- Done-when met on DIET: an HOD fixes the department, generates it against the rest and marks it Ready; ECE (labs squeezed) requests the CSE lab for Thursday / Friday slots, CSE approves, ECE re-generates into exactly those slots; taking it back lists the 2 affected classes and blocks publishing (H11) until ECE re-generates; no cross-department clash at any point; an HOD can never edit or decide for another department. 299 tests green.

### Open issues
- ~~Loans are weekly only~~ → single-date bookings built in P0.5-e. Teachers / students do not see bookings yet — show them on *Today* in **v0.6**.
- A `needsNewRoom` booking only gets a label; the HOD books another room by hand (no automatic re-booking).
- The finder (Who's free?) and the timetable's "Who's free" tab are still college-wide for every role — role scoping comes with the Teacher / Student portals (**v0.6**).
- A college-wide change (blocked slot, calendar) holds back every department with a class there; each must re-generate (or the College Admin generates the whole college).
- Leave approval and substitute screens on the HOD desk are **v0.7** (engine since v0.2).
- Bundle > 500 kB (code-split the desks before v1.0); M8 / M10 hand checks still open.

---

## v0.6 Teacher & Student portals + Meet-a-Teacher

### Design
**Goal:** everyone who lives by the timetable can use it. A **teacher** sees their week and today (with any substitution duty), their load, asks for leave and keeps office hours; a **student** sees their section's week and **Now / Next** on a phone, sees substitute notices, prints or shares the timetable, and can **request a meeting** with a teacher in a slot when both are free. Both read **only the published version** — a draft never leaks (root §2). Dates are real semester dates (rule G6): holidays and no-class days say so instead of showing classes.

**Data & logic (pure, tested)**
| File | Responsibility |
|---|---|
| `types.ts` | `Session.studentName?` (a student types their name once; real accounts in v0.9). `MeetingRequest` gains `date` (ISO), `createdAt`, `reply?`; `LeaveRequest` gains `createdAt`. |
| `lib/access.ts` | `selfScope(session, colleges)` → the teacher or section this session is (validated inside its college). Teachers / students: `viewPublished` only; a student may ask only a teacher who teaches their section or belongs to its department (`canMeet`). The finder's free-room view stays with admins and HODs. |
| `lib/myDay.ts` | Pure, from the **published** timetable only: `dayFor(college, date, who)` → that date's status (teaching / holiday / no-class / weekend / outside the semester, with its label) and the classes of a teacher or section in order, with that date's **substitutions** (teacher's own classes covered by someone else, and duties they cover for others; a section's class with its substitute). `nowNext(college, at, who)` → the class happening now (or the break) and the next one today, with clock times from `periodTimes` / `nowSlot`. `weekLoad(college, teacherId)` → periods per day and week vs limits. Nothing when nothing is published. |
| `lib/share.ts` | `encodeShare(college, sectionId)` → a compact, self-contained, **read-only** snapshot of one section's published week (days, slot times, breaks, classes: subject, teacher, room; version, semester) compressed with `lz-string` into the URL (`?s=…`); `decodeShare(s)` → the snapshot or null. Fully client-side, so the link works on any phone without the college's data. |
| `lib/meetings.ts` | `bookableSlots(college, teacherId, sectionId, date)` = teacher free ∩ section free on that date's published day (reusing `finder.commonFree`), minus breaks / blocked slots and past times; office-hour slots flagged. `requestMeeting(...)` refuses beyond `calendar.maxMeetingRequestsPerStudent` pending requests, outside the bookable slots, or with a teacher the student may not ask. Teacher actions: `accept` (optionally with a free room from `finder.freeRooms`), `propose` (another bookable slot), `decline` with a reply; student `withdraw`. `meetingsAfterPublish(college)` → accepted meetings whose slot now holds a class become `needsReschedule` (called by `publish`); meetings never block teaching (root §3). `meetingCounts(college, deptId)` for the HOD (counts only). |
| `lib/publish.ts` | `publish` also re-checks accepted meetings against the new version. |

**Screens**
- **Header:** a **teacher picker** for the Teacher role (teachers of the college) and a **section picker + "your name"** for the Student role — stand-ins for logging in (v0.9).
- **Teacher desk** `#/teacher` (accent plum): **Today** (date with ← → and "today"; holiday / no-class banner; classes in order with room and section; *substitution duty* and *covered by …* tags) · **My week** (published grid, print via the existing preview) · **Load** (periods per day vs daily limit, week vs weekly limit) · **Leave** (pick a teaching date → reason → request; list with status — approval and cover are the HOD's screens in **v0.7**) · **Office hours** (pick free slots of the week, "accepting requests" switch) · **Meeting requests** inbox (P0.6-c).
- **Student desk** `#/student` (accent marigold, phone first): **Now / Next** card (what and where, until when; "Free now" / "Lunch" / "No classes today — Diwali break") · **Today** with substitute notices · **This week** (section grid, print) · **Share** (copy link → opens a read-only view of the section's week on any device) · **Meet a teacher** (P0.6-c: pick a teacher of the section, a date, a free slot — office hours highlighted — topic and note; my requests with status).
- **Shared view** `/?s=…`: Kaalchakra header, section, semester, version, the week grid, print — no desk, no data needed.
- When nothing is published: both desks say so plainly ("Your college has not published a timetable yet").

**Checkpoints**
| ID | Feature | Tests | Commit message |
|---|---|---|---|
| P0.6-a | Teacher desk: identity picker, Today (dates, holidays, substitution duties), My week + print, load, leave request, office hours | T6.1 teachers and students read only the published version, never a draft · T6.2 teacher scope (own classes, duties) · T6.3 now / next for given times (incl. break, before / after hours, holiday) · leave request rules | `feat(teacher): teacher desk with today, week, load, leave and office hours` |
| P0.6-b | Student desk: section + name, Now / Next, Today with substitute notices, This week + print, share link + shared read-only view; phone layout | T6.2 student scope (own section only) · T6.4 share encode → decode round trip; a broken link is refused · M9 phone width | `feat(student): student desk with now-next, notices and share link` |
| P0.6-c | Meet-a-Teacher: student request (bookable slots, office hours, max pending), teacher inbox (accept with room / propose / decline), statuses, HOD counts; publish marks clashing accepted meetings `needsReschedule` | T6.5 bookable = teacher free ∩ section free (published) · T6.6 max pending refused · T6.7 teacher sees only own requests, HOD counts only · T6.8 a re-publish that puts a class into an accepted meeting → `needsReschedule` | `feat(meet): meet-a-teacher requests and inbox` |

**Decisions**
- **Published only, always.** Teacher and student screens never read `draft`; with nothing published they say so. Today's view = the published weekly pattern on that real date + that date's substitutions (`classesOn`).
- **Share links carry the timetable itself** (compressed), because Kaalchakra has no server: whoever opens the link sees the snapshot taken when it was shared, labelled with its version and date — not live data.
- **Meetings are booked on real dates** in slots where both are free in the published timetable; they never block teaching, and a later version that needs the slot turns them into *needs reschedule* with a notice to both.
- **Leave:** the teacher requests here; the HOD's approval, auto-allotted substitute and notices are **v0.7** (engine since v0.2). Teacher-requested unavailable slots also wait for the HOD screens in v0.7.
- No new library: `lz-string` is already in the stack for share links.
- If time runs short: office hours and the load card drop first; the shared read-only view can fall back to "copy the section's printable page".

**Done when:** after the College Admin publishes DIET, a teacher sees today's classes (and a holiday banner on a holiday), their week and load, and requests leave for a date; a student of CSE-Y2-A on a phone sees Now / Next and this week, shares a link that opens the week on another device, and requests a meeting in a slot when both are free; the teacher accepts it with a room and the student sees "accepted"; a re-publish that needs that slot marks it *needs reschedule*; and no teacher or student ever sees a draft.

### Built
- **P0.6-a** — **Teacher desk** `#/teacher[/week|leave|hours]`: `lib/myDay.ts` (published-only `dayFor`, `nowNext`, `weekLoad`, `teachingSlots`, leave request / take back, office hours), `teacherScope` + teacher picker in the header, tabs Today (real dates, holiday banner, substitution duty / covered tags, Now / Next, load bars) · My week (published grid, one-page print) · Leave · Office hours. Decided: single-date room bookings belong to a department, not a teacher, so they are not shown on the teacher's Today.
- **P0.6-b** — **Student desk** `#/student[/week|share]` (phone first): section picker + name, Now / Next card, today with substitute notices and breaks, the week + one-page print, **share link** (`lib/share.ts`: the published week compressed into `?s=…`, ~1.2 k characters for DIET) opening a read-only `SharedWeek` on any device; broken links refused. Decided: a saved session without a valid teacher / section lands on the first one of its college; after the last class Now says "Done for today".

### Open issues
_(fill after v0.6)_

---

