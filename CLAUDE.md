# Kaalchakra — Global Rules (DO NOT EDIT)

> "Every period, in its place." A clash-free, multi-college timetable platform for **any** college.
> This file holds the **unchanging** rules. Never edit it. Per-version design lives in `docs/CLAUDE.md` (imported at the bottom).

## 1. Product
- Hackathon brief (Punjab Jobs AI Bootcamp · J-PAL): web app that produces college timetables, works for any college. 120 min. Submission = GitHub repo (README, this CLAUDE.md, small commits) + live Vercel link.
- Judged on: **Core** (no clashes) · **Usability** (admin uses it without help) · **Design** (clear, readable) · **Advanced** (harder cases) · **Relevance** (real college problems). Every feature must serve one of these.
- Stack: React 19 + Vite + TypeScript, Tailwind v4, zustand (persist to localStorage), GSAP + @gsap/react, papaparse, lz-string, lucide-react, vitest. **Fully client-side**, no backend. Deploy: Vercel.
- Do not add libraries beyond these without a clear need noted in `docs/PROGRESS.md`.

## 1a. Multi-college & nothing hard-coded
| ID | Rule |
|---|---|
| G1 | Kaalchakra hosts **many colleges**. Every college-owned entity has `collegeId`; every selector, solver run, validator and ledger is scoped by `collegeId` first. |
| G2 | **Never hard-code** counts or names of departments, programmes/years, sections, students per section, **subjects**, rooms, teachers, working days, periods per day, timings, lunch slot or lab block length. Always read them from the college's config. No "CSE/ECE/ME", no "8 periods", no "Mon–Sat" in logic. |
| G3 | Demo data is only a **seed** that goes through the same config/structure path as user data (`lib/structure.ts`). Two demo colleges of different shapes must both work. |
| G4 | UI grids, loops, pickers and charts are driven by the calendar/structure config (any number of days and periods). |
| G5 | **Subjects** are defined per programme (the curriculum). Every section of a programme inherits its subjects; an **Assignment** only links *section × subject → teacher*. Periods/week, theory/lab and room type live on the Subject, never in the solver. *(added at the user's request during v0.1)* |

## 2. Roles & access (all filtering goes through `src/lib/access.ts` — never inline role checks in components)
| Role | Scope | Can |
|---|---|---|
| `superAdmin` | all colleges | create / edit / archive / clone colleges; **Structure Builder** (calendar: days, periods, timings, lunch, lab block length; departments; programmes/years; number of sections; students per section → sections generated; **subject catalogue per programme**: code, name, theory/lab, periods per week, room type); assign College Admins; read-only view of every college's status. **No direct timetable edits.** |
| `collegeAdmin` | own college | adjust structure within Super Admin's setup (rename sections, strength, blocked slots), **shared rooms**, generate whole college, lock slots, Conflict Center, publish/unpublish, all leave, export |
| `deptAdmin` (HOD) | own department | CRUD own teachers/sections/subjects/dept rooms, **assign a teacher to each section × subject**, dept generate (against global ledger), mark Draft→Ready, Room Exchange (offer/request/approve), leave approval + substitutes for own dept |
| `teacher` | own classes (+ read own dept) | view My Week/Today/load/substitution duties, request leave, request unavailable slots, set office hours, accept / propose / decline **meeting requests** |
| `student` | own section | read-only published section timetable, Now/Next, substitute notices, print, share link, **request a meeting** with a teacher of own section/dept and track status |
- Teacher & Student read **only the published version**; drafts never leak.
- HOD writes only own department; shared rooms are owned by College Admin.
- No data ever crosses colleges; a user of college A never sees college B (Super Admin excepted, read-only).
- Until auth (v0.9) the session comes from a role + college switcher; auth only replaces how the session is set — screens must not change.

## 3. Hard rules — a timetable that breaks ANY of these is invalid
| ID | Rule |
|---|---|
| H1 | A **teacher** is in at most one place per (day, period) — across **all departments**. |
| H2 | A **section** has at most one class per (day, period). |
| H3 | A **room** hosts at most one class per (day, period) — across **all departments** (global booking ledger). |
| H4 | Room **type** matches the session (theory→lecture/seminar as specified, lab→lab). |
| H5 | Room **capacity** ≥ section strength. |
| H6 | No class in a teacher's **unavailable** slots or on an **approved leave** day. |
| H7 | No class in a section's **break slots** or any college **blocked slot**. Breaks may differ by group and day: a section's breaks = its own rules → else its programme's → else its department's → else the college default (`effectiveBreaks` / `sectionBreakSlots` in `lib/structure.ts`). *(staggered breaks added at the user's request in v0.1)* |
| H8 | A **lab** occupies `blockLength` (default from calendar) **consecutive** periods on the same day, same room, never crossing that section's break slot or the day end. |
| H9 | Teacher **max periods/day** and **max periods/week** are respected. |
| H10 | **Locked** placements never move or disappear. |
| H11 | A section may use a room only if the room is owned by its dept, is `shared`, or an **approved grant** covers that slot. |
| H12 | Every placement references existing entities and lies inside the configured days/periods. |
| H13 | Nothing crosses colleges: a placement's section, teacher and room all belong to the same college as the timetable. |
| H14 | **Teacher break:** on every day a teacher teaches, at least `teacherMinFreeInLunchWindow` (default 1) of the college's `lunchWindow` slots stay free for them — so staggered breaks across departments never leave a shared teacher without lunch. |

**Break model:** breaks are **slots in one shared period grid** (not gaps between periods), so every section shares one clock and cross-department clashes stay checkable. A break slot may be shorter via `calendar.periodLengths`. Never hard-code a lunch period (rule G2).

### Meeting rules (Meet-a-Teacher)
- Bookable slots = teacher free ∩ student's section free, from the **published** timetable (reuse `finder.commonFree`); office hours are highlighted, not required.
- Meetings **never block teaching**: the solver ignores them. If a re-plan puts a class into an accepted meeting slot, the meeting becomes `needsReschedule`.
- Max pending requests per student comes from college config (default 3). Teacher sees only own requests; HOD sees counts only.

## 4. Soft rules — optimise, never at the cost of a hard rule (score 0–100 in `score.ts`)
| ID | Rule | Weight |
|---|---|---|
| S1 | Spread a subject's periods across different days | 3 |
| S2 | ≤ 1 period of the same theory subject per section per day | 3 |
| S3 | Minimise teacher idle gaps between classes | 2 |
| S4 | Minimise section idle gaps | 2 |
| S5 | Balance each teacher's daily load | 2 |
| S6 | Prefer own-department rooms before shared/borrowed rooms | 1 |
| S7 | Avoid labs in the last period(s) of the day | 1 |

## 5. Solver invariants
- **Never emit a clash.** If a session cannot be placed legally, put it in `unplaced` with a human-readable `reason` and a `suggestion`. Unplaced-with-reason is always better than a clash.
- `validate.ts` is **independent** of `solve.ts` and re-checks H1–H14; every generate, re-plan, edit and publish runs it. **Publish is blocked** if it reports any conflict.
- Solver is **pure and deterministic per seed** (seeded RNG, no `Math.random`, no Date inside). Restarts = different seeds; keep best (fewest unplaced, then highest score).
- Dept-scoped generate, re-plan and lock all reuse `solve.ts` by passing existing placements as fixed bookings — no second algorithm.
- Heavy solving runs in a Web Worker; UI stays responsive.

## 6. Design system — "Paper & Ink" (no generic blue/green dashboard look) *(user tried Midnight & Saffron in v0.1 and chose to keep Paper & Ink with a tighter type scale)*
- Light: paper `#F4EFE6`, card `#FBF8F2`, ink `#1C1B19`, muted `#6B665E`, rule `#D9D2C5`, vermilion `#D9481C`, marigold `#E8A33D`, plum `#5B3A5E`, terracotta-brown `#8A4B2A`, gold `#B8892B`.
- Dark "Blackboard": bg `#151412`, text `#EDE8DE`, accents slightly lifted.
- Role accents: Super Admin gold · College Admin vermilion · HOD terracotta-brown · Teacher plum · Student marigold.
- Fonts (Google Fonts): **Fraunces** headings (600), **Inter** UI, **JetBrains Mono** times/codes.
- **Type scale (keep it restrained):** body 15px / 1.6 · hero h1 36 → 48 → 56px (`text-4xl sm:text-5xl lg:text-[3.5rem]`, max ~16ch) · section h2 24 → 30px · card/panel titles 16px · secondary text 13–15px · eyebrows & labels mono 11px uppercase, wide tracking · buttons 14px. Timetable cells: subject 13px, meta 11px.
- Subject cells: muted pastel hashed per subject, ink text; labs = diagonal stripes, span their periods. Lunch row always visible.
- GSAP gotcha: never animate an element that also uses Tailwind `translate-*` for positioning — wrap it (outer div positions, inner div animates).
- Colours only via CSS variables/Tailwind theme tokens defined in one place (`src/theme.css`).
- GSAP: use `useGSAP` hook, scope animations to a container ref, clean up automatically. Wrap all motion in `gsap.matchMedia()` and disable under `prefers-reduced-motion`. Animations must never block interaction or delay data.
- Accessible: text contrast ≥ 4.5:1, keyboard reachable controls, visible focus, works at 375px width, clean print CSS (one timetable per A4).

## 7. Structure
```
CLAUDE.md (this, global)   README.md   docs/{CLAUDE.md, PLAN.md, PROGRESS.md, TEST.md}
src/ types.ts store.ts demoData.ts theme.css main.tsx App.tsx
     solver/  solve validate score preflight replan substitutes conflicts worker (+ *.test.ts)
     lib/     access structure meetings finder assistant auth csv share colors
     portals/ super/ college/ department/ teacher/ student/
     components/ shared UI (TimetableGrid, Wheel, RoleSwitcher, CollegeSwitcher, StructureBuilder, ClashCourt, MeetingInbox, ChatDrawer, ...)
```
- Logic (solver, lib) is pure TS with no React imports, so it is unit-testable.

## 8. Commands
- `npm run dev` · `npm run build` · `npm test` (vitest run) · `npm run lint`

## 9. Working rules
1. Work version by version (v0.1 → v1.0, roadmap in `docs/PLAN.md`). Every version runs the phase cycle:
   - **D — Design:** write version N's design in `docs/CLAUDE.md` (screens, components, data touched, rules, test IDs, feature checkpoints) and show the user a 5-line summary before coding.
   - **B — Build:** implement one feature (checkpoint) at a time.
   - **T — Test:** unit tests + `npm run build` + quick browser check for that feature; update `docs/TEST.md`.
   - **R — Record:** update `docs/PROGRESS.md`; after the last feature fill *Built* / *Open issues* in `docs/CLAUDE.md`.
2. After every feature: update `docs/PROGRESS.md` (log row + checklist).
3. After adding or running tests: update `docs/TEST.md` (status + "Last run" line).
4. **Never finish a version with failing tests or a failing build.** Solver/data logic changes need a test.
5. **Claude never runs `git commit` or `git push` — the user does.** When a feature's tests and build pass, stop and print this block, then wait for the user's "pushed / continue":
   ```
   🚀 PUSH CHECKPOINT  <id e.g. P0.2-b>  — <feature name>
   Tests: <N passed> · Build: ok
   Files changed: <list>
   Run:
     git add -A
     git commit -m "<type(scope): message>"
     git push
   ```
   Commit types: feat, fix, test, docs, chore, style, refactor. Checkpoint IDs come from `docs/PLAN.md` ("Features & checkpoints per version").
6. Keep it simple: if a feature takes too long, follow the drop order in `docs/PLAN.md`; never drop solver tests.
7. Never edit this file.

## Current version design
@docs/CLAUDE.md
