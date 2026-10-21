# Plan: **Kaalchakra** — "Every period, in its place."
*(Kaal-chakra = "wheel of time". A timetable platform for any college — admins build it, teachers and students live by it.)*

## Context
Brief (Punjab Jobs AI Bootcamp / J-PAL, Hackathon 1, 120 min, individual) is deliberately minimal: "build a web app that produces college timetables, for any college". Product scope is ours to decide. Real pain: timetables are hand-made over weeks; departments compete for shared rooms (seminar halls, computer labs); results still have clashes, uneven teacher loads, empty rooms.

| Judging criterion | How Kaalchakra wins it |
|---|---|
| Core – no clashes | Constraint solver + **independent validator**; "✓ 0 clashes — verified" seal; prefers *unplaced-with-reason* over ever producing a clash |
| Usability | Multi-college platform with 5 role portals (Super Admin / College Admin / HOD / Teacher / Student), Structure Builder (no hard-coded shape), guided setup, one-click demo college, paste-from-Excel, plain-language errors |
| Design | Editorial "Paper & Ink" look (not a blue/green dashboard), GSAP motion, notice-board-ready print |
| Advanced | Lab double-periods, teacher availability, shared rooms, lock & regenerate, absence re-plan, substitute finder |
| Relevance | Shared-room fairness ledger, teacher load balance, empty-room heatmap, teacher leave requests, student "what's next" view, student ↔ teacher meeting requests |

Submission: GitHub repo (source, README, CLAUDE.md, small commits) + live Vercel link.
Decisions: **React + Vite + TypeScript, fully client-side** (solver in Web Worker, data in localStorage), **Vercel**. Roles are a **role switcher with name picker (no passwords)** — honest for a no-backend demo; real auth listed as future work. `D:\hackathon` is empty; node 24 & git present.

## Multi-college platform & nothing hard-coded
Kaalchakra hosts **many colleges** on one platform. Every entity carries `collegeId`; data, views, solver runs and the global booking ledger are **per college** (no cross-college sharing).
**No hard-coded structure:** number/names of departments, programmes/years, sections per year, students per section, rooms, teachers, working days, periods per day, period timings, lunch slot and lab block length all come from the college's configuration. Code must never assume "CSE/ECE/ME", "8 periods", "Mon–Sat" or a fixed count — loops and grids are always driven by config. Demo data is only a **seed** loaded through the same config path (two demo colleges of different shapes prove it: an engineering college with 3 depts × 6 periods/day Mon–Sat, and a small arts & science college with 2 depts × 5 periods Mon–Fri).

**Staggered breaks:** breaks are slots in one shared period grid and may differ per department, year/programme, section and day (section → programme → department → college default). Hard rule H14 guarantees every teacher a free slot inside the college lunch window on teaching days, so a teacher shared by departments with different lunch slots still gets lunch.

## Users & roles (5 roles, college- & department-scoped)
Until v0.9: role switcher → pick role → pick college → pick yourself (dept / teacher / section). Real login comes **last** (v0.9). Every screen filters data by the chosen role + scope; the scope rule lives in one helper (`lib/access.ts`) so it is testable.

| Role | Who | Scope |
|---|---|---|
| **Super Admin** | Platform owner / university or management body | All colleges on the platform |
| **College Admin** | Principal / Timetable Office / Dean Academics | Whole college, all departments |
| **Department Admin (HOD)** | Head of Department / dept timetable coordinator | Own department only (+ read shared rooms) |
| **Teacher** | Faculty member | Own classes only (+ read own dept timetable) |
| **Student** | Class / section student or CR | Own section only (read-only) |

### What each role SEES and CAN DO
**Super Admin**
- Sees: list of all colleges with status cards (departments, sections, students, teachers, rooms counts; timetable published? clash seal; quality score), platform overview.
- Can: **create / edit / archive colleges**; define each college's **structure** with a Structure Builder:
  - college calendar: working days, periods per day, start time, period length, lunch slot(s), lab block length;
  - departments (any number, any names/codes);
  - per department: programmes/years (e.g. "B.Tech Year 2", "BA Sem 3"), **number of sections** per year, **students per section** (strength) → sections auto-generated with editable names (e.g. CSE-Y2-A, CSE-Y2-B);
  - assign a College Admin to each college; clone a college's structure as a template for a new college.
- Cannot: edit department-level timetables directly (that is College Admin / HOD work) — keeps responsibilities clean.

**College Admin**
- Sees: college dashboard (all depts' quality score, clash seal, unplaced count), every timetable (section / teacher / room), shared-room ledger across depts, room utilisation heatmap, all leave requests.
- Can: adjust structure inside limits set by Super Admin (rename sections, tweak strength, blocked college slots), manage **shared rooms** (seminar halls, central computer labs), generate the **whole-college** timetable (so cross-dept shared rooms and shared teachers never clash), lock slots (e.g. college assembly, seminar), publish/unpublish, export/print all, approve leave escalated by HODs.

**Department Admin (HOD)**
- Sees: own dept's sections, teachers, rooms; dept timetables; dept teacher load chart; own dept's share of shared rooms (demand vs allocated); dept leave requests; dept pre-flight warnings & unplaced reasons.
- Can: add/edit own teachers, sections, subjects/assignments, own dept rooms; mark teacher availability; **submit dept data as "Ready"** to College Admin (status chip: Draft → Ready → Published); approve/reject teacher leave → pick substitute (Absence Mode) for own dept; print dept timetables.
- Cannot: edit other departments, college settings or shared rooms; cannot publish college-wide.

**Teacher**
- Sees: *My Week* grid (subject, section, room), *Today* card (now/next class + room), weekly load vs max, substitution duties assigned to me, own leave request status, read-only own-dept section timetables.
- Can: request leave for a day (reason) → goes to HOD inbox; set preferred unavailable slots (request, HOD approves); set office hours; accept/propose/decline student meeting requests; print own timetable.
- Cannot: edit any timetable or see other depts' data.

**Student**
- Sees: own section's published timetable (mobile-first), *Now / Next* card with room & teacher, today's list, notice when a class has a substitute ("DBMS today taken by Prof. X").
- Can: pick college + dept + section, print, copy share link, **request a meeting with a teacher** and track its status.
- Cannot: see drafts, teacher loads, or other sections' admin data.

### Meet-a-Teacher requests (Student ↔ Teacher)
Real problem: students don't know when a teacher is free and wander between staff rooms.
- **Teacher** sets *office hours* (optional slots in their free periods) and a toggle "accepting meeting requests".
- **Student** opens a teacher (only teachers who teach their section, or same dept) → sees **"Can I meet?"** strip: slots where *both* the teacher and the student's section are free (computed from the published timetable, reuses `finder.commonFree`), office hours highlighted → sends a request `{teacher, slot, topic, note}`.
- **Teacher** gets a Requests inbox: accept (optionally pick a room from free rooms), propose another free slot, or decline with note. Max N pending requests per student (default 3, configurable) to avoid spam.
- **Student** sees status (pending / accepted with time & room / rescheduled / declined) on their dashboard; accepted meetings appear as small markers on both timetables (do not block teaching slots — the solver ignores them; if a re-plan later moves a class into that slot the meeting is flagged "needs reschedule").
- Chatbot: "Can I meet Prof. Kaur tomorrow?" → answers with common free slots + "Request" button.
- Access: students request only within own college; teacher sees only own requests; HOD sees counts only (no content).

### Cross-department rooms & clash prevention (core differentiator)
Problem: depts own rooms, some sit idle (CSE lab free Fri) while another dept (IT) is short; and if each HOD makes a timetable separately, two depts can book the same room/teacher → clash.
**Room ownership & booking authority**
- Every room has an owner: a department **or** `college-shared` (seminar hall, central labs).
- Only the owner dept's sections can be scheduled into a dept room — unless a **grant** exists. Shared rooms are allocated by College Admin (open to all depts, optional per-dept weekly quota).
**Room Exchange (lend / borrow between departments)**
- Owner HOD sees *My rooms' free slots* (from current timetable) and can **offer** a room: whole week, or specific day/period slots.
- Borrower HOD browses offers or **requests** a room type/slots ("need 1 lab, 4 periods/week") → owner HOD approves/rejects → approval creates a **Grant** `{roomId, fromDept, toDept, slots | all, status}`.
- Solver for the borrower dept may use only granted slots of that room. Revoking a grant flags affected placements for re-plan.
- College Admin sees all grants and can grant/override any room directly.
**One global booking ledger (no inter-dept clashes)**
- Rooms and teachers are **global resources**. A HOD can generate *their own dept* timetable at any time; the solver treats every other dept's committed (Ready/Published) placements as **fixed bookings**, so a dept draft can never clash with another dept's rooms or shared teachers (e.g. a Maths teacher teaching CSE and ME).
- Commit order = first Ready wins; College Admin can run a **full-college regenerate** (all depts together, fairest) at any time.
- **Conflict Center** (College Admin): global validator across all depts; any cross-dept clash (from stale drafts, edited data, revoked grants) is listed with the two parties and one-click actions: re-plan dept X / reassign room / regenerate all. Publish is **blocked** while any global clash exists.
*(Super Admin: read-only on rooms of every college; rooms are created by College Admin / HOD inside the structure Super Admin defined.)*
**Access summary for rooms**
| Action | College Admin | HOD (owner) | HOD (other dept) | Teacher | Student |
|---|---|---|---|---|---|
| Create/edit shared rooms | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create/edit own dept rooms | ✅ | ✅ | ❌ | ❌ | ❌ |
| Offer / approve lending of a dept room | ✅ | ✅ | ❌ | ❌ | ❌ |
| Request to borrow a room | — | ✅ | ✅ | ❌ | ❌ |
| See room timetable / occupancy | all | own + shared + granted | own + shared + granted | own classes' rooms | own section's rooms |
| Resolve cross-dept clashes, publish | ✅ | ❌ (mark Ready only) | ❌ | ❌ | ❌ |

### Search, filters & "Who's free?" finder
All results respect the viewer's role scope (`access.ts`).
- **Quick search (Ctrl/⌘+K command palette)** — type any teacher, section, room, subject or code → jump straight to its timetable. Fuzzy match, recent items.
- **Timetable filter bar** (on every grid/list view) — Department · Section · Teacher · Room · Room type (lecture/lab/seminar) · Subject · Day · Theory/Lab chips; "Today only" toggle; filters are kept in the URL so a filtered view can be shared/bookmarked.
- **Who's free? finder** — pick day + period(s) (or "now") →
  - **Free teachers**: filter by dept / subject they teach; shows each one's load that day (used to pick substitutes, schedule extra classes, meetings).
  - **Free rooms**: filter by type, min capacity, owner dept/shared; shows whether you can use it directly or must request a grant (one click → Room Exchange request).
- **Is X free? quick check** — select a teacher/room/section → week heat-strip of busy/free slots with next free slot highlighted ("Prof. Kaur next free: Tue P3").
- **Common free slot** — select several teachers (or a teacher + a room) → slots where all are free (for meetings, extra/makeup classes, practical exams).
- Visibility by role: College Admin & HOD → full finder (HOD: own dept teachers + rooms usable by dept); Teacher → free rooms + own dept colleagues' free status (for swaps); Student → search own section only, free-room finder hidden.

**Department workflow (the "relevance" story):** HODs fill own dept data in parallel → mark Ready → College Admin runs one generate across all depts (shared rooms & teachers fairly allocated) → Publish → teachers & students see it instantly. Leave flow: Teacher → HOD (substitute / re-plan) → students see substitute notice.
**Publishing model:** portals for Teacher & Student read only the **published** version; drafts never leak. Republish after re-plan bumps a version number shown on all views ("v3 · published 21 Oct 10:42").

## What makes it uncommon (vs ~30 "form + grid" apps)
1. **Three portals, one source of truth** — admin draft vs published version; teacher/student views update on publish.
2. **Clash Court** — click a cell → popover listing hard rules it satisfies; unplaced items get a reason + suggestion ("Lab demand 14 > 12 lab slots: add Sat periods or a 2nd lab").
3. **Absence Mode** — teacher leave → substitute finder (free same-dept teachers) or re-plan affected classes only; changed cells animate (GSAP Flip).
4. **Shared-Resource Ledger** — per shared room: each department's demand vs allocation, idle hours.
5. **Pre-flight Check** — capacity math before solving (teacher hours, lab demand vs lab slots, section hours vs slots).
6. **Lock & regenerate**, **share link**, **paste from Excel**, **notice-board print**.

## Design system — "Paper & Ink" (kept after trying a dark alternative; tighter type scale in root CLAUDE.md §6)
- Light: paper `#F4EFE6`, card `#FBF8F2`, ink `#1C1B19`, muted `#6B665E`, rules `#D9D2C5`, accent **vermilion** `#D9481C`, highlight **marigold** `#E8A33D`, secondary **plum** `#5B3A5E`.
- Dark "Blackboard": charcoal `#151412`, chalk `#EDE8DE`, accents slightly lifted.
- Subject cells: muted sticky-note pastels hashed per subject, ink text; labs get diagonal-stripe texture and span 2 periods. Each role has an accent: Super Admin deep ink `#1C1B19` with gold rule `#B8892B`, College Admin vermilion, HOD **terracotta-brown** `#8A4B2A`, Teacher plum, Student marigold.
- Type: **Fraunces** (display serif), **Inter** (UI), **JetBrains Mono** (times/codes) via Google Fonts.
- Layout: whitespace, hairline register rules, big serif headings, time ruler on the left.
- **GSAP** (`gsap`, `@gsap/react`; SplitText & Flip free in 3.13+): landing headline reveal + rotating Kaalchakra wheel; wheel spins while solving; cells drop into grid with stagger; Flip on regenerate/re-plan; score counters tween; all motion off under `prefers-reduced-motion`.

## Data model (`src/types.ts`)
**Platform** `{colleges: College[]}` · **College** `{id, name, code, status: active|archived, collegeAdminIds}` · **Settings / Calendar** per college (days[] — any subset & order, periodsPerDay, startTime, periodMinutes, lunchAfterPeriod(s), blockedSlots, labBlockLength, maxMeetingRequestsPerStudent) · **Programme/Year** `{deptId, name, sectionsCount, defaultStrength}` (Structure Builder input → `lib/structure.ts` generates Sections) · Department `{code, name}` · **Subject** `{programmeId, code, name, theory|lab, periodsPerWeek, blockLength?, roomType}` — curriculum per programme, defined in the Structure Builder · **Assignment** = section × subject → teacher (generated by `syncAssignments`, teacher picked by HOD/College Admin) · Room (lecture|lab|seminar, capacity, owner dept or `shared`) · Teacher (dept, maxPerDay, maxPerWeek, unavailable slots) · Section (dept, strength) · Assignment (section, subject, code, teacher, periodsPerWeek, theory|lab, blockLength=2 for lab, roomType) · Timetable (placements `{assignmentId, day, period, length, roomId, locked}`, unplaced `{assignmentId, reason, suggestion}`) · `published: {timetable, version, at}` · Department `status: draft|ready|published` · Room `ownerDeptId | 'shared'` · Grant `{roomId, fromDeptId, toDeptId, slots[] | 'all', status: offered|requested|approved|rejected|revoked}` · Placement carries `deptId` (global ledger = all depts' placements) · LeaveRequest `{teacherId, day, reason, status: pending|approved|rejected}` · Substitution `{placementKey, day, substituteTeacherId}` · OfficeHours `{teacherId, slots[], accepting}` · MeetingRequest `{studentName, sectionId, teacherId, day, period, topic, note, status: pending|accepted|proposed|declined|needsReschedule, roomId?, proposedSlot?}` · Session `{role: superAdmin|collegeAdmin|deptAdmin|teacher|student, collegeId?, deptId?, teacherId?, sectionId?}`.
Every college-owned entity has `collegeId`; all selectors take `collegeId` first. Section `{programmeId, deptId, name, strength}`.

## Solver (`src/solver/`)
`solve.ts` (pure, seeded): expand sessions → most-constrained-first (labs, shared-room needs, scarce teachers) → candidates satisfying hard rules → best soft score → 1-level repair swap → else unplaced with reason. `worker.ts` runs seeded restarts, keeps best. `validate.ts` independently re-checks hard rules. `score.ts` 0–100. `preflight.ts` capacity math. `replan.ts` = lock unaffected placements + re-run solve on displaced sessions (no new algorithm). `substitutes.ts` = free same-dept teachers for a slot. Dept-scoped generate = same `solve.ts` with other depts' committed placements passed in as locked bookings and a room filter (own rooms + shared + granted slots) — no new algorithm. `conflicts.ts` = global validator grouped by dept pair.

## Project structure
```
D:\hackathon\
  CLAUDE.md  PROGRESS.md  TEST.md  README.md(end)  index.html  vite.config.ts  package.json
  src/ types.ts store.ts demoData.ts theme.css main.tsx App.tsx
       solver/ solve.ts validate.ts score.ts preflight.ts replan.ts substitutes.ts worker.ts *.test.ts
       portals/ super/* college/* department/* teacher/* student/*
       components/ TimetableGrid Wheel RoleSwitcher CollegeSwitcher StructureBuilder ClashCourt Ledger MeetingInbox ...
       lib/ access.ts structure.ts meetings.ts finder.ts assistant.ts auth.ts csv.ts share.ts colors.ts
       components/ ... ChatDrawer LoginScreen
```

## Release versions (each version = shippable, committed, deployed, tests green, PROGRESS.md + TEST.md updated)
| Version | Time | Theme | Features | Tests (TEST.md IDs) |
|---|---|---|---|---|
| **v0.1 Foundation** | 0–10 | Skeleton live | Vite+TS+Tailwind v4, theme tokens & fonts, GitHub push, Vercel connected, multi-college types, `structure.ts` (generate sections from programme counts), **2 demo colleges seeded through the structure config** (Engineering: 3 depts, 6 periods, Mon–Sat, shared labs + seminar hall; Arts & Science: 2 depts, 5 periods, Mon–Fri) | T0 build passes; demo data sanity (ids unique, refs valid, every entity has collegeId); structure generates N sections × strength exactly as configured |
| **v0.2 Engine** | 10–30 | Zero clashes | solve, validate, score, preflight, worker; seeded restarts; unplaced reasons | T1 both demo colleges → 0 conflicts (proves no hard-coded shape); T2 each hard rule H1–H12; T3 impossible input → reason, 0 conflicts; T4 determinism; T5 lunch/unavailable/lab contiguity; T6 score range & preflight |
| **v0.3 Timetable views** | 30–42 | See it | TimetableGrid (section/teacher/room), 0-clash seal, Clash Court popover, GSAP cell-drop, print CSS | grid render smoke test; manual print check |
| **v0.35 Finder & filters** | 42–50 | Find anything fast | `lib/finder.ts` (free teachers/rooms, isFree, nextFree, commonFree), filter bar with URL state, Ctrl+K palette; Who's-free panel | free teacher/room correct on demo slots; busy never returned; commonFree intersection; filters reduce placements correctly; scope respected |
| **v0.4 Super Admin + College Admin portals** | 50–62 | Build any college, many colleges | Landing + role & college switcher, `access.ts` scoping; **Super Admin**: colleges list/create/archive/clone, Structure Builder (calendar, depts, programmes/years, sections count, strength); **College Admin**: shared rooms, teachers/assignments setup (availability grid, paste-from-Excel), localStorage, Generate all, Publish/version | structure: change counts → sections regenerate; calendar with 5 days/5 periods solves; data of college A never visible in college B; csv parse; store round-trip; JSON export→import; access: super sees all colleges, college admin only own |
| **v0.5 Department Admin (HOD) portal + Room Exchange** | 62–72 | Departments in parallel, no inter-dept clashes | Dept-scoped CRUD (teachers, sections, subjects, dept rooms), dept-only generate against global booking ledger, Draft→Ready status, Room Exchange (offer / request / approve grants), dept load chart | access: HOD sees/edits only own dept; dept A then dept B generate → 0 global clashes; no grant → other dept's room never used; grant → borrower uses only granted slots; revoke → placements flagged |
| **v0.6 Teacher & Student portals + Meet-a-Teacher** | 72–84 | Everyone uses it | Teacher: My Week, Today, load, leave request, substitution duties, office hours, meeting Requests inbox; Student: college/section picker, Now/Next card, substitute notice, "Can I meet?" common-free strip + request + status, mobile layout, share link | publish isolation (draft not visible); access: teacher/student scope; now/next calc; share encode↔decode; meeting slots = teacher free ∩ section free; request limit enforced; teacher sees only own requests; re-plan into a meeting slot → needsReschedule |
| **v0.7 Ops & insights** | 84–94 | Real-college problems | Leave inbox (HOD) → Absence Mode (substitutes / re-plan with Flip), Lock & regenerate, Conflict Center (global validator, publish blocked on clash), College dashboard (load, room heatmap incl. idle rooms to lend, quality), Shared-Resource Ledger | re-plan keeps unaffected slots & 0 conflicts; locked slot stays; substitute free & same dept; ledger totals; injected cross-dept clash detected & publish blocked |
| **v0.8 Kaal Assistant (chatbot)** | 94–102 | Answer small queries | Chat drawer on every portal; rule-based intent parser (no API key, offline, deterministic) over `finder.ts`/timetable; role-scoped answers; clickable answers jump to the timetable cell; suggested-question chips | each intent returns correct answer on demo data; unknown question → helpful fallback; student can't get admin data |
| **v0.9 Authentication (last)** | 102–110 | Lock the doors | Login screen replaces role switcher; Super Admin creates College Admin accounts; College Admin creates users (role + dept/teacher/section link) and sets passwords; passwords hashed (Web Crypto SHA-256 + salt) in local store; route guards via `access.ts`; logout; seeded demo accounts listed on login page for judges | wrong password rejected; each role lands on own portal; guarded route redirects; hash never equals plain text |
| **v1.0 Ship** | 110–120 | Polish & submit | Full `npm test`, build, manual checklist on live URL, dark mode check, README from PROGRESS.md + TEST.md, submit | full suite green; manual checklist ✅ |

**Until v0.9 roles work via the role switcher** (pick role → pick person); every screen already goes through `access.ts`, so adding auth only swaps "who is the session" — no screen rewrites.
**Auth honesty note:** client-only auth is a demo-grade gate (data lives in the browser). README states the production path: Supabase/Firebase Auth + Postgres with row-level security per department.
**If behind schedule:** drop in this order — share link → Ctrl+K palette (keep filter bar + Who's free) → ledger → lock & regenerate → dark mode → v0.9 auth (keep role switcher). Never drop v0.2 tests.
**Future work (README only, not built):** real backend auth & DB (multi-tenant per college), LLM-powered assistant (Claude via Vercel function using finder functions as tools), cross-college shared faculty, drag-and-drop editing, compare candidates, exam timetables, notifications.

### Kaal Assistant — what it answers (role-scoped)
Pattern-matched intents with entity lookup (teacher / section / room / subject / day / period / "now", "today", "tomorrow"):
- "Is Prof. Kaur free on Tuesday 3rd period?" · "When is Prof. Kaur free today?"
- "Where is CSE-3A now?" / "What's my next class?" (uses logged-in person)
- "Which labs are free Friday after lunch?" · "Free rooms with 60+ seats now"
- "Who teaches DBMS to CSE-3A?" · "How many periods does Prof. Singh have this week?"
- "Who is substituting today?" · "Is the seminar hall booked Wednesday?"
- "Can I meet Prof. Kaur tomorrow?" (student) → common free slots + Request button · "Any meeting requests?" (teacher)
- "Any clashes?" (admins) → validator summary · "Why is ME-5B Physics lab unplaced?" → unplaced reason
- "help" → list of example questions. Unknown → "I can answer questions about free teachers, rooms, classes… try: …".
Answers are short cards with a "Show in timetable" link. Optional upgrade only if a key is available & time remains: route unknown questions to Claude via a Vercel serverless function (not planned in the 2 h).

## Testing strategy
- vitest unit tests next to the code (`*.test.ts`), focused on solver + data logic (where clashes come from). UI checked via a manual checklist — no heavy E2E framework.
- **TEST.md** table: `ID · Version · Area · Case · Expected · Type (unit/manual) · Status (✅/❌/⏳) · Notes`, plus "Last run: date, N passed / M failed". Updated whenever a test is added or run.
- Manual checklist: demo flow per role, wizard from scratch, publish → teacher/student see it, leave → substitute, print preview, phone width, reduced motion, dark mode, refresh keeps data.

## What happens immediately after approval (then STOP)
0. **Plan summary PDF for Cowork PRD**: generate `D:\hackathon\docs\Kaalchakra-Plan-Summary.pdf` (2–3 pages, made with a small Python reportlab/markdown→HTML→PDF script kept in the scratchpad): name & pitch, problem, users & 4 roles with see/can-do matrix, room exchange & clash rules, finder & assistant, design direction, version roadmap table v0.1–v1.0, test strategy, out-of-scope. Also save this full plan as `docs/PLAN.md`. Report the PDF path so it can be uploaded to Cowork to generate the PRD.
1. Scaffold in `D:\hackathon`: `npm create vite@latest . -- --template react-ts`, `git init`.
2. Install **only required** libraries:
   - runtime: `gsap @gsap/react zustand papaparse lz-string lucide-react`
   - dev: `tailwindcss @tailwindcss/vite vitest @types/papaparse`
   (react, react-dom, vite, typescript, @vitejs/plugin-react come with the template.) Add `"test": "vitest run"` script; wire Tailwind plugin in vite.config.ts.
3. **Docs layout** (all .md except README & root CLAUDE.md live in `docs/`):
   ```
   CLAUDE.md            ← GLOBAL, never changes after creation: important unchanging rules (content below). Ends with a static line importing @docs/CLAUDE.md so the current phase design always loads too.
   README.md            ← written at v1.0 from docs/PROGRESS.md + docs/TEST.md
   docs/CLAUDE.md       ← PROGRESSIVE: written/updated before each version starts (that version's design)
   docs/PLAN.md         ← copy of this plan (versions roadmap)
   docs/PROGRESS.md
   docs/TEST.md
   ```
   **Root CLAUDE.md (global, unchanging)**: product summary, roles & judging map; hard clash rules H1–H10 (teacher/section/room single-booking, room type, capacity, teacher unavailability & approved leave, lunch, lab contiguity & no straddling lunch/day end, teacher max/day & /week, locked slots immutable, room used only by owner dept / shared / approved grant slots, global ledger: no room or teacher double-booked across departments); soft rules S1–S7 with weights (subject spread, ≤1 same theory/day, teacher gaps, section gaps, balanced daily load, own-dept rooms before shared, no last-period labs); solver invariants (never emit a clash, validator must pass, unplaced+reason over clash, deterministic per seed); the full role visibility/permission matrix above (all filtering only through `lib/access.ts`; Teacher/Student read only the published version; HOD writes only own dept; shared rooms owned by College Admin); data model; design tokens, fonts, GSAP & reduced-motion rules; folder structure; commands; commit rules; "update PROGRESS.md after every feature, TEST.md after every test change; never finish a version with failing tests".
   **docs/CLAUDE.md (progressive)**: "Current version: v0.1 (not started)"; one section per version written *before* that version starts: *Design* (screens, components, data touched, decisions), then after it: *Built*, *Open issues*. Only v0.1's design is written now. Global CLAUDE.md contains the rule: "before starting version N, write N's design in docs/CLAUDE.md; never edit root CLAUDE.md".
4. **docs/PROGRESS.md**: version checklists v0.1–v1.0 (unchecked), log table (time · version · feature · commit · notes), decisions, screenshots-to-capture list — feeds the README.
5. **docs/TEST.md**: all planned cases above with status ⏳ and the manual checklist.
6. **docs/PLAN.md**: this plan.
7. Stop and report back; building starts on the user's go.

## Revision 2 — apply now (steps 0–6 above are already done; nothing is built yet)
Scope change: multi-college platform, Super Admin role, Meet-a-Teacher requests, no hard-coded structure. Update the existing files only (no app code, no new libraries needed):
1. **Root `CLAUDE.md`** — one-time revision *before* any build starts (the "never edit" rule applies from v0.1 onward): add Multi-college & no-hard-coding rules (G1 every entity has `collegeId`, all selectors scoped by college; G2 no hard-coded counts/names of depts, sections, strength, days, periods, timings — always from config; G3 demo data only via the same config path; G4 UI grids/loops driven by calendar config); roles table gains **Super Admin** (all colleges, Structure Builder, create/archive/clone colleges, assign College Admins, no direct timetable edits); Teacher gains office hours + meeting inbox; Student gains meeting requests; add **H13** "no data crosses colleges (rooms, teachers, placements are per college)"; meeting rules (meetings never block teaching; slots = teacher free ∩ section free; max pending per student from config; re-plan into a meeting → `needsReschedule`); Super Admin accent colour; structure adds `portals/super`, `lib/structure.ts`, `lib/meetings.ts`.
2. **`docs/CLAUDE.md`** — rewrite v0.1 design: multi-college types (College, Calendar, Programme, Section with collegeId, OfficeHours, MeetingRequest, Session with superAdmin), `structure.ts`, two demo colleges of different shapes seeded through config; tests T0.2 updated, T0.3 structure generation.
3. **`docs/TEST.md`** — add: T0.3 structure generates exact sections/strength; T1 runs on both demo colleges; T2.H13 cross-college isolation; T4.5 change sections count → regenerate; T4.6 super/college admin scope; T6.5 meeting slots = teacher free ∩ section free; T6.6 request limit; T6.7 teacher sees only own requests; T6.8 re-plan → needsReschedule; T8.6 chatbot "Can I meet…"; manual M13 Super Admin creates a new college from scratch with custom structure and generates a clash-free timetable, M14 student requests meeting → teacher accepts → status shows.
4. **`docs/PROGRESS.md`** — update checklist lines for v0.1, v0.4, v0.6; log row "Revision 2: multi-college, Super Admin, meetings"; decision entries; screenshots: Super Admin colleges list & Structure Builder, meeting request flow.
5. **`docs/PLAN.md`** — replace with this revised plan.
6. **PDF** — regenerate `docs/Kaalchakra-Plan-Summary.pdf` with 5 roles, multi-college & no-hard-coding section, Meet-a-Teacher section and updated roadmap.
7. Stop and report.

## Revision 3 — phases inside every version + user-driven GitHub pushes
### Phase cycle (repeated for every version)
| Phase | What happens | Output |
|---|---|---|
| **D — Design** | Write the version's design in `docs/CLAUDE.md` (screens, components, data touched, rules it must respect, test IDs). Show the user a 5-line summary. | design section |
| **B — Build** | Implement the version feature by feature (list below). | code |
| **T — Test** | Write/run the version's unit tests, `npm run build`, quick check in the browser pane. Update `docs/TEST.md`. | green tests |
| **R — Record** | Update `docs/PROGRESS.md` log + checklist, fill *Built / Open issues* in `docs/CLAUDE.md`. | docs |
| **🚀 Push checkpoint** | After **each feature** (not only each version) Claude stops and prints a checkpoint block; **the user commits & pushes themselves**. Claude never runs `git commit` / `git push`. | user's commit |

**Checkpoint block format (printed by Claude when a feature is finished and its tests pass):**
```
🚀 PUSH CHECKPOINT  P0.2-b  — Validator (H1–H14)
Tests: 18 passed · Build: ok
Files changed: src/solver/validate.ts, src/solver/validate.test.ts, docs/TEST.md
Run:
  git add -A
  git commit -m "feat(solver): independent validator for H1–H14"
  git push
```
Then Claude waits for the user's "pushed / continue" before starting the next feature. (Vercel auto-deploys on each push once connected.)

### Features & checkpoints per version
| Version | Features (one push checkpoint each) |
|---|---|
| **v0.1 Foundation** | P0.1-a theme + fonts + landing shell · P0.1-b types + `structure.ts` (+T0.3) · P0.1-c two demo colleges (+T0.2) · *user: create GitHub repo, first push, connect Vercel* |
| **v0.2 Engine** | P0.2-a `solve.ts` core (H1–H9, H12, H13) + T1 · P0.2-b `validate.ts` + T2.* · P0.2-c labs/locks/grant filter (H8, H10, H11) + unplaced reasons + T3 · P0.2-d `score.ts`, `preflight.ts`, seeded restarts, worker + T4/T6 |
| **v0.3 Views** | P0.3-a TimetableGrid (section/teacher/room, config-driven size) · P0.3-b clash seal + Clash Court popover · P0.3-c GSAP cell-drop + wheel + print CSS |
| **v0.35 Finder** | P0.35-a `finder.ts` + T35.* · P0.35-b filter bar (URL state) · P0.35-c Who's-free panel + Ctrl+K |
| **v0.4 Super & College Admin** | P0.4-a store (zustand persist, multi-college) + role/college switcher + `access.ts` + T4.2–T4.6 · P0.4-b Super Admin colleges list/create/clone · P0.4-c Structure Builder · P0.4-d College Admin setup (rooms, teachers, assignments, availability grid, paste-from-Excel + T4.1) · P0.4-e Generate all + Publish/version |
| **v0.5 HOD + Room Exchange** | P0.5-a HOD dept CRUD + Draft→Ready · P0.5-b dept generate vs global ledger + T5.2 · P0.5-c Room Exchange (offer/request/grant/revoke) + T5.3–T5.5 |
| **v0.6 Teacher & Student** | P0.6-a Teacher portal (My Week, Today, load, leave request) · P0.6-b Student portal (Now/Next, substitute notice, mobile, share link) + T6.1–T6.4 · P0.6-c Meet-a-Teacher (`meetings.ts`, office hours, request, inbox) + T6.5–T6.8 |
| **v0.7 Ops & insights** | P0.7-a Leave inbox + Absence Mode (substitutes, re-plan, Flip) + T7.1–T7.2 · P0.7-b Lock & regenerate + Conflict Center + T7.3–T7.4 · P0.7-c Dashboard + Shared-Resource Ledger + T7.5 |
| **v0.8 Assistant** | P0.8-a `assistant.ts` intents + T8.* · P0.8-b ChatDrawer UI |
| **v0.9 Auth** | P0.9-a `auth.ts` (users, salted hash) + T9.* · P0.9-b Login screen + route guards + demo accounts |
| **v1.0 Ship** | P1.0-a full test run + fixes · P1.0-b README (from PROGRESS + TEST) · *user: final push, check Vercel URL, submit* |

### Apply now (docs only; nothing built yet)
1. Root `CLAUDE.md` — replace working rule 5 (commits) with: "Claude never runs `git commit`/`git push`. After each feature passes tests, print the 🚀 PUSH CHECKPOINT block (format above) with a conventional commit message and wait for the user's go." Add the D/B/T/R phase cycle to working rule 1. (Still pre-build, so this one-time edit is allowed; frozen from v0.1.)
2. `docs/CLAUDE.md` — add the phase cycle header and v0.1's feature/checkpoint list (P0.1-a/b/c) under its Design.
3. `docs/PROGRESS.md` — under each version, list its checkpoints as sub-checkboxes; log table gains a "Checkpoint" column; user ticks happen via Claude after the user confirms a push.
4. `docs/PLAN.md` — refresh with this plan.
5. Stop and report.

## Verification
- `npm test` green at the end of every version; `npm run build` passes.
- Live Vercel URL: Super Admin creates a college with a custom structure → HOD (mark Ready) → College Admin (Generate, Publish) → Teacher (leave) → HOD (substitute) → Student (sees substitute notice, requests a meeting) → Teacher accepts (checked in the browser pane), print preview, phone width, reduced motion.
