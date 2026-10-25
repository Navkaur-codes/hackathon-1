# Kaalchakra — Test Register

> Updated whenever a test is added or run. Status: ✅ pass · ❌ fail · ⏳ planned.
> Unit tests: vitest (`npm test`), files `src/**/*.test.ts`. UI: manual checklist below.

**Last run:** 2026-10-21 (P0.35-c) — `npm test` 206 passed / 0 failed (14 files) · build ✅ · lint ✅

## Unit tests
| ID | Version | Area | Case | Expected | Type | Status | Notes |
|---|---|---|---|---|---|---|---|
| T0.1 | v0.1 | build | `npm run build` + `npm run lint` | succeeds, no TS/lint errors | unit/CI | ✅ | P0.1-a (Paper & Ink, new type scale); landing checked in browser at 463px: no horizontal overflow, h1 36px on 2 lines, Fraunces loaded, animations complete |
| T0.2 | v0.1 | demoData | ids unique, all refs resolve, lab rooms exist for lab assignments, every entity has collegeId, refs stay within one college | true | unit | ✅ | `demoData.test.ts` (15 cases): two different shapes; platform-unique ids; refs resolve in-college; every subject has a usable room of its type with enough capacity; teacher loads ≤ weekly max and ≤ maxPerDay × workable days; section demand < non-break slots; ECE lunch staggered vs CSE/ME; a cross-dept teacher in each college; `summarizeCollege` numbers |
| T0.3 | v0.1 | structure | programme with N sections × strength S | exactly N sections, each strength S; changing N regenerates, keeps edited survivors | unit | ✅ | `structure.test.ts`: N = 1, 3, 7, 30; names past Z (AA, AB); grow 2→4 & shrink →1 keep edits |
| T0.4 | v0.1 | structure | sections × programme subjects | exactly one assignment per section × subject; add/remove subject or section syncs and keeps chosen teachers | unit | ✅ | also: other programmes' subjects ignored |
| T0.5 | v0.1 | structure | `buildCollege(spec)` | all records derived from spec, every record has the college's id, round-robin teachers per section, unknown teacher key rejected, unavailability → slot keys | unit | ✅ | |
| T0.6 | v0.1 | calendar | `periodTimes` | times follow startTime/periodMinutes, honouring per-slot lengths (short lunch slot) | unit | ✅ | |
| T0.7 | v0.1 | breaks | staggered breaks | section → programme → dept → college inheritance; day-specific rules; non-working days ignored; two depts in one college get different break slots | unit | ✅ | |
| T0.8 | v0.2 | semester | real dates → pattern days; holidays, no-class days, weekends | DIET 19 weeks / 105 teaching days / 6 holidays / 2 exam days; DCAS 16 / 74 / 5 / 1 (checked independently); Sat holiday counts only where Saturday is worked | unit | ✅ | `lib/semester.test.ts` |
| T0.9 | v0.2 | semester | hours delivered per subject over the semester | every assignment delivered; holidays reduce totals; minutes use real slot lengths | unit | ✅ | |
| T0.10 | v0.2 | semester | classes on a real date | Monday pattern in order; holiday/exam/Sunday/out-of-range empty; substitution changes the teacher for that date only | unit | ✅ | |
| T1 | v0.2 | solver | solve **both** demo colleges (different days/periods/depts, staggered breaks) | validator 0 conflicts, 0 unplaced — proves nothing hard-coded | unit | ✅ | `solve.test.ts`: DIET & DCAS × seeds 1, 2, 3, 7, 42 — 0 conflicts, 0 unplaced, all curriculum periods placed |
| T2.H1 | v0.2 | solver/validate | teacher double-booked (incl. across depts) | never produced; validator detects hand-made violation | unit | ✅ | validate.test.ts (detection) + solve.test.ts (never produced: 60 random colleges × 2 seeds, validator clean) |
| T2.H2 | v0.2 | solver/validate | section double-booked | never produced; detected | unit | ✅ | validate.test.ts (detection) + solve.test.ts (never produced: 60 random colleges × 2 seeds, validator clean) |
| T2.H3 | v0.2 | solver/validate | room double-booked across depts | never produced; detected | unit | ✅ | validate.test.ts (detection) + solve.test.ts (never produced: 60 random colleges × 2 seeds, validator clean) |
| T2.H4 | v0.2 | solver/validate | lab in lecture room / wrong type | never produced; detected | unit | ✅ | validate.test.ts (detection) + solve.test.ts (never produced: 60 random colleges × 2 seeds, validator clean) |
| T2.H5 | v0.2 | solver/validate | room capacity < strength | never produced; detected | unit | ✅ | validate.test.ts (detection) + solve.test.ts (never produced: 60 random colleges × 2 seeds, validator clean) |
| T2.H6 | v0.2 | solver/validate | class in teacher unavailable slot / leave day | never produced; detected | unit | ✅ | validate.test.ts (detection) + solve.test.ts (never produced: 60 random colleges × 2 seeds, validator clean) |
| T2.H7 | v0.2 | solver/validate | class in a section's own break slot (incl. staggered dept/section breaks) or blocked slot | never produced; detected | unit | ✅ | validate.test.ts (detection) + solve.test.ts (never produced: 60 random colleges × 2 seeds, validator clean) |
| T2.H8 | v0.2 | solver/validate | lab not contiguous / crosses the section's break or day end | never produced; detected | unit | ✅ | validate.test.ts (detection) + solve.test.ts (never produced: 60 random colleges × 2 seeds, validator clean) |
| T2.H9 | v0.2 | solver/validate | teacher exceeds max/day or max/week | never produced; detected | unit | ✅ | validate.test.ts (detection) + solve.test.ts (never produced: 60 random colleges × 2 seeds, validator clean) |
| T2.H10 | v0.2 | solver/validate | locked placement after re-solve | unchanged; validator flags a moved locked class (`mustKeep`) | unit | ✅ | validate.test.ts (detection) + solve.test.ts (re-solve with every 9th class locked keeps them exactly, 0 conflicts) |
| T2.H11 | v0.2 | solver/validate | other dept's room used without grant | never produced; detected | unit | ✅ | validate.test.ts (detection) + solve.test.ts (never produced: 60 random colleges × 2 seeds, validator clean) |
| T2.H12 | v0.2 | solver/validate | unknown assignment/room, outside the week, unassigned teacher, more periods than the curriculum | never produced; detected | unit | ✅ | validate.test.ts (detection) + solve.test.ts (never produced: 60 random colleges × 2 seeds, validator clean) |
| T2.H13 | v0.2 | solver/validate | teacher/room of college B used in college A | never produced; detected | unit | ✅ | validate.test.ts (detection) + solve.test.ts (never produced: 60 random colleges × 2 seeds, validator clean) |
| T2.H14 | v0.2 | solver/validate | shared teacher teaching two depts with different lunch slots | keeps ≥ 1 free slot in the lunch window each teaching day; violation detected | unit | ✅ | validate.test.ts (detection) + solve.test.ts (never produced: 60 random colleges × 2 seeds, validator clean) |
| T1b | v0.2 | solver | breaks, availability and labs on the demos | labs are whole blocks; staggered lunch respected (ECE never in its lunch slot); unavailable teachers never scheduled | unit | ✅ | `solve.test.ts` T5 block: visiting teacher never on Saturday |
| T5.0 | v0.2 | solver | department-by-department solving (CSE → ECE → ME, each against the others booked) | 0 global conflicts, everything placed | unit | ✅ | preview of v0.5 |
| T5.1a | v0.2 | solver | adjusted timetable for a date with a teacher on leave | 0 conflicts with `leave` | unit | ✅ | |
| T3 | v0.2 | solver | impossible input: lab demand > lab rooms, no room big enough, room only in another dept, teacher weekly limit, teacher never available, section week full, break blocks a lab, no teacher | unplaced with a specific plain reason + fix; 0 conflicts; placed + unplaced = curriculum | unit | ✅ | `solver/unplaced.test.ts` (8 cases) |
| T3r | v0.2 | solver | repair step | never more unplaced than without repair, never a clash (60 random colleges) | unit | ✅ | measured on 300 random colleges: rescued placements in 2 — most stuck classes are genuinely impossible (pre-flight catches those) |
| T4 | v0.2 | solver | same seed twice | identical output | unit | ✅ | different seeds give different timetables |
| T6a | v0.2 | score | score on demos; crammed subject; empty timetable; determinism | 0–100 with every part 0–1; cramming one subject into a day lowers spread, same-day and total; deterministic | unit | ✅ | `solver/score.test.ts`; demos: DIET 96, DCAS 89 |
| T6b | v0.2 | preflight | demos clean; overloaded teacher; bad semester dates; each T3 case | demos: no errors; error with exact message + fix for each impossible input | unit | ✅ | |
| T6c | v0.2 | restarts | `solveBest` (20 seeds) vs first attempt | never more unplaced, never lower score, 0 conflicts, reproducible from `bestSeed`, semester totals reported | unit | ✅ | |
| T6d | v0.2 | worker | `runSolver` without Web Workers | falls back inline with identical result | unit | ✅ | in the browser it runs in a real worker (checked: `worker.ts?worker_file` loaded) |
| T3.1 | v0.3 | gridModel | grid for a section / teacher / room on both demos | one cell per placement of that entity; labs span their length; section break rows = its own staggered breaks; teacher view includes cross-dept classes; rows × cols follow the calendar | unit | ✅ | `lib/gridModel.test.ts` (8 cases) incl. DCAS 30-min lunch slot & Friday-only assembly; every placement appears exactly once per view |
| T3.2 | v0.3 | colors | subject colours | same code → same colour; readable contrast | unit | ✅ | every palette colour ≥ 4.5:1 with ink text; DIET curriculum uses ≥ 6 colours |
| T3.3 | v0.3 | explain | Clash Court checklist | all ✓ for solver placements; a hand-made clash shows the failing check, agreeing with the validator | unit | ✅ | `lib/explain.test.ts`: every placement of both demos all ✓; lunch-break move → H7, teacher double-booking → H1, unlent room → H11 — each also reported by the validator. Browser: popover beside the class (tablet), bottom sheet (phone), Esc returns focus to the class |
| T35.1 | v0.35 | finder | free teachers at a demo slot | excludes busy, unavailable and over-daily-limit teachers; load that day + teaches-subject flag; free ∪ busy = all teachers | unit | ✅ | `lib/finder.test.ts`: checked at every slot of the DIET week — membership exactly equals not-busy ∧ available ∧ under the daily limit; visiting teacher never free on Saturday; ranking order; 2-period windows |
| T35.2 | v0.35 | finder | free rooms by type & capacity | only matching, unbooked rooms; usable badge own / shared / needs-grant | unit | ✅ | type/size filters at every slot; LT-101 own, CL-1 shared, LT-201 needs-grant → granted after an approved grant |
| T35.3 | v0.35 | finder | commonFree(teacher A, teacher B) | intersection of free slots | unit | ✅ | equals the intersection of week strips (2 teachers + seminar hall); never offers a section break or an unavailable slot |
| T35.4 | v0.35 | finder | nextFree / weekStrip / nowSlot | earliest free slot after a time; strip marks busy · free · break; real clock time → pattern slot | unit | ✅ | ECE lunch column = break; Sharma's Saturday = unavailable; wrap-around; Mon 10:00 → P2, Sunday / 08:00 → none, DCAS 11:30 → lunch slot |
| T35.5 | v0.35 | filters | filter by dept / subject / theory-lab / room type / day; URL round-trip | only matching cells; `fromSearch(toSearch(f))` equals `f` | unit | ✅ | `lib/filters.test.ts`: each filter, AND-combination, URL round-trip, malformed values ignored |
| T35.6 | v0.35 | viewUrl | timetable page state ↔ URL (college, seed, view, entity, filters, tab) | round-trip equal; no college/seed → null; bad view → section; the URL's seed rebuilds the identical timetable | unit | ✅ | `lib/viewUrl.test.ts` (3 cases); `tab=free` added in P0.35-c |
| T35.7 | v0.35 | fuzzy | Ctrl/⌘+K palette matcher | subsequence only, case-insensitive; contiguous / word-start hits rank first; empty query keeps order | unit | ✅ | `lib/fuzzy.test.ts` (3 cases) |
| T4.1 | v0.4 | csv | parse pasted TSV/CSV teachers & assignments | correct rows, bad rows reported | unit | ⏳ | |
| T4.2 | v0.4 | store | persist → reload | identical state | unit | ⏳ | |
| T4.3 | v0.4 | store | export JSON → import JSON | identical data | unit | ⏳ | |
| T4.4 | v0.4 | access | collegeAdmin scope | sees all depts of own college only | unit | ⏳ | |
| T4.5 | v0.4 | structure | Super Admin changes sections count / strength / periods per day | sections regenerate; new calendar (e.g. 5 days × 5 periods) still solves with 0 conflicts | unit | ⏳ | |
| T4.6 | v0.4 | access | superAdmin scope | sees all colleges, cannot edit timetables; college A data never visible to college B users | unit | ⏳ | |
| T4.7 | v0.4 | clone | clone DIET as a new college; blank template | every id re-prefixed, refs resolve, no id shared with the source, both solve with 0 conflicts | unit | ⏳ | |
| T4.8 | v0.4 | publish | publish with a conflict / stale draft / unplaced; publish twice; unpublish | refused with reason; unplaced needs confirm; version 1 → 2; unpublish clears | unit | ⏳ | |
| T4.9 | v0.4 | edit | add / remove subject or department, rename section | other assignments and chosen teachers kept; draft marked stale | unit | ⏳ | |
| T5.1 | v0.5 | access | HOD scope | sees/edits only own dept (+ shared/granted rooms read) | unit | ⏳ | |
| T5.2 | v0.5 | solver | dept A generate, then dept B generate | 0 global conflicts | unit | ⏳ | engine side already covered by T5.0 (v0.2) |
| T5.3 | v0.5 | grants | no grant | other dept's room never used | unit | ⏳ | |
| T5.4 | v0.5 | grants | approved slot grant | borrower uses only granted slots | unit | ⏳ | |
| T5.5 | v0.5 | grants | revoke grant | affected placements flagged | unit | ⏳ | |
| T6.1 | v0.6 | publish | teacher/student read | only published version, never draft | unit | ⏳ | |
| T6.2 | v0.6 | access | teacher & student scope | own classes / own section only | unit | ⏳ | |
| T6.3 | v0.6 | now/next | given day+time | correct current & next class | unit | ⏳ | |
| T6.4 | v0.6 | share | encode → decode | round-trip equal | unit | ⏳ | |
| T6.5 | v0.6 | meetings | bookable slots for teacher + section | = teacher free ∩ section free (published timetable) | unit | ⏳ | |
| T6.6 | v0.6 | meetings | student exceeds max pending requests | request rejected with message | unit | ⏳ | |
| T6.7 | v0.6 | meetings | teacher inbox | only own requests; HOD sees counts only | unit | ⏳ | |
| T6.8 | v0.6 | meetings | re-plan puts class into accepted meeting slot | meeting → needsReschedule | unit | ⏳ | |
| T7.1 | v0.2 (engine, from v0.7) | leave cover | HOD approves a leave for a date | every affected class gets an auto-allotted free substitute (or `uncovered`), 0 conflicts on that date, weekly pattern & other dates untouched, holidays need no cover, two leaves same date never share a substitute | unit | ✅ | `solver/substitutes.test.ts`; property: every teacher × every day of a week validates clean |
| T7.2 | v0.2 (engine, from v0.7) | substitutes | ranking | free, available, within max/day, keeps lunch; same dept → same subject → knows section → lightest load | unit | ✅ | |
| T7.3 | v0.7 | lock | lock slot, regenerate | slot unchanged | unit | ⏳ | |
| T7.4 | v0.7 | conflicts | inject cross-dept room clash | detected with both depts; publish blocked | unit | ⏳ | |
| T7.5 | v0.7 | ledger | per shared room | totals equal placement count | unit | ⏳ | |
| T8.1 | v0.8 | assistant | "Is <teacher> free on <day> <period>?" | correct yes/no + next free | unit | ⏳ | |
| T8.2 | v0.8 | assistant | "Where is <section> now?" / "my next class" | correct room & subject | unit | ⏳ | |
| T8.3 | v0.8 | assistant | "free labs Friday" | correct list | unit | ⏳ | |
| T8.4 | v0.8 | assistant | unknown question | helpful fallback with examples | unit | ⏳ | |
| T8.5 | v0.8 | assistant | student asks admin-only question | refused / scoped answer | unit | ⏳ | |
| T8.6 | v0.8 | assistant | "Can I meet <teacher> tomorrow?" | common free slots + request action | unit | ⏳ | |
| T9.1 | v0.9 | auth | wrong password | rejected | unit | ⏳ | |
| T9.2 | v0.9 | auth | stored password | hash ≠ plain text, salted | unit | ⏳ | |
| T9.3 | v0.9 | auth | each role login | lands on own portal; guarded routes redirect | unit | ⏳ | |

## Manual checklist (run on live Vercel URL before submit)
| ID | Case | Status |
|---|---|---|
| M1 | Try each demo college → generate → "0 clashes — verified" seal | ✅ (local dev, 2026-10-21) — DIET 96/100, 111 periods/wk, 1,617 h, 432 ms; "Generate another" → seed 22, still 0 clashes; DCAS 89/100, 789 h, 144 ms. Re-check on the Vercel URL at v1.0 |
| M2 | Create a tiny college from scratch via wizard (2 rooms, 2 teachers, 1 section) without help | ⏳ |
| M3 | HOD marks Ready → College Admin generates & publishes → teacher & student see it | ⏳ |
| M4 | HOD offers lab → other HOD requests → approve → borrower timetable uses it | ⏳ |
| M5 | Teacher requests leave for a date → HOD approves → a free teacher is auto-allotted (HOD can swap) → student sees the substitute on that date only | ⏳ |
| M6 | Who's free? finder + Ctrl+K search jump to timetable | ✅ (local dev, 2026-10-21, DIET seed 9) — `?tab=free` reopens the finder; Fri P5+P6 · Lab · for CSE → CL-1, CL-2 (shared), ECE Electronics Lab (needs a grant); **Now** at Wed 18:15 → "No class is running right now"; common free slot of Gill + Kaur + Arora → 22 slots listed and drawn; Ctrl+K → "grew" → Enter opens Prof. Baljit Grewal's grid; "em eng" → Enter applies the EM subject filter (`&subject=EM`); 375 px: no page scroll, mini week scrolls in its box; no console errors. Re-check on Vercel at v1.0 |
| M7 | Kaal Assistant answers 3 sample questions | ⏳ |
| M8 | Print preview: one clean timetable per A4 | ✅ simulated (2026-10-21): print CSS applied on screen — only header + grid, colours kept, one week = 434 px of a 718 px A4-landscape page; "Print all sections" → 7 pages (one per DIET section), all classes visible, page breaks set. ⏳ confirm once in a real print dialog |
| M9 | Phone width (375px): student view readable, no horizontal scroll | ⏳ — timetable page checked at 349 px: page never scrolls sideways, grid scrolls inside its box with sticky times (P0.3-a); student view in v0.6 |
| M10 | Reduced motion: no GSAP animation; dark mode readable | ⏳ — code skips all motion under `prefers-reduced-motion` (landing, card, grid drop-in, Flip); not yet checked with the OS setting. Print forces ink-on-white even in dark mode |
| M11 | Refresh browser: data kept | ⏳ |
| M12 | Login with each demo account (v0.9) | ⏳ |
| M16 | Filter bar: filter → faded classes + count; shared URL restores the view | ✅ (2026-10-21) — DIET CSE-Y2-A + *Lab* → "2 of 15 classes match", 13 faded, URL gains `&kind=lab`; reload of `?college=diet&seed=9&view=teacher&id=diet-t-gill&day=4` reopens Dr. Manjit Gill's week with Fri selected (2 of 12 match, only Friday classes bright); Clear drops the filter params; All colleges clears the query; 375 px: bar wraps, page never scrolls sideways; no console errors |
| M15 | Grid motion: classes drop in on first show; "Generate another" glides each class to its new slot | ✅ (2026-10-21) — drop-in: opacity 0 at 120 ms → all visible, inline styles cleared; Flip: same element moved Fri P1 → Mon P3, transform during, none after |
| M13 | Super Admin creates a new college from scratch with a custom structure (own days, periods, depts, sections, strength) → timetable generates with 0 clashes | ⏳ |
| M14 | Student requests a meeting → teacher accepts with room → student sees accepted status | ⏳ |
