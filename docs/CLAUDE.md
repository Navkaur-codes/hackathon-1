# Kaalchakra — Progressive Design Log

> Written **before** each version starts (Design), completed after it (Built, Open issues).
> Global rules: root `CLAUDE.md`. Roadmap: `docs/PLAN.md`.

**Current version: v0.1 Foundation — code complete (P0.1-c awaiting push); next: v0.2 Engine** (plan revision 3 + subjects)

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
- **P0.1-c** — `demoData.ts`: DIET (Mon–Sat × 7 slots, CSE/ECE/ME, 7 sections, ECE lunch staggered, cross-dept Maths & Communication teachers, 2 shared computer labs + seminar hall, a visiting teacher off on Saturdays) and DCAS (Mon–Fri × 6 slots, 30-min lunch slot, extra Friday break, Commerce/English, cross-dept Business Communication). `summarizeCollege` + `CollegeCard` show both on the landing, every number computed.
- Tests: 32 green (T0.1–T0.7).

### Open issues
- Vercel not connected yet (user step) — live URL pending.
- Vite dev server's Tailwind output once went stale after a newly created component (missing classes); restarting the dev server fixed it. Production build was unaffected. If classes seem missing in dev, restart the preview before debugging CSS.
- "Generate timetable" buttons are disabled placeholders until v0.2/v0.4 wire the solver.
- Root `README.md` is still the Vite template — replaced at v1.0.

---
<!-- Next: write "## v0.2 Engine — Design" here before starting v0.2 -->
