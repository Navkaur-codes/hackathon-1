# Kaalchakra — Test Register

> Updated whenever a test is added or run. Status: ✅ pass · ❌ fail · ⏳ planned.
> Unit tests: vitest (`npm test`), files `src/**/*.test.ts`. UI: manual checklist below.

**Last run:** 2026-10-21 (P0.2-a) — `npm test` 56 passed / 0 failed (3 files) · build ✅ · lint ✅

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
| T1 | v0.2 | solver | solve **both** demo colleges (different days/periods/depts, staggered breaks) | validator 0 conflicts, 0 unplaced — proves nothing hard-coded | unit | ⏳ | |
| T2.H1 | v0.2 | solver/validate | teacher double-booked (incl. across depts) | never produced; validator detects hand-made violation | unit | ✅ (detection) | validate.test.ts; 'never produced' half lands with the solver in P0.2-b |
| T2.H2 | v0.2 | solver/validate | section double-booked | never produced; detected | unit | ✅ (detection) | validate.test.ts; 'never produced' half lands with the solver in P0.2-b |
| T2.H3 | v0.2 | solver/validate | room double-booked across depts | never produced; detected | unit | ✅ (detection) | validate.test.ts; 'never produced' half lands with the solver in P0.2-b |
| T2.H4 | v0.2 | solver/validate | lab in lecture room / wrong type | never produced; detected | unit | ✅ (detection) | validate.test.ts; 'never produced' half lands with the solver in P0.2-b |
| T2.H5 | v0.2 | solver/validate | room capacity < strength | never produced; detected | unit | ✅ (detection) | validate.test.ts; 'never produced' half lands with the solver in P0.2-b |
| T2.H6 | v0.2 | solver/validate | class in teacher unavailable slot / leave day | never produced; detected | unit | ✅ (detection) | validate.test.ts; 'never produced' half lands with the solver in P0.2-b |
| T2.H7 | v0.2 | solver/validate | class in a section's own break slot (incl. staggered dept/section breaks) or blocked slot | never produced; detected | unit | ✅ (detection) | validate.test.ts; 'never produced' half lands with the solver in P0.2-b |
| T2.H8 | v0.2 | solver/validate | lab not contiguous / crosses the section's break or day end | never produced; detected | unit | ✅ (detection) | validate.test.ts; 'never produced' half lands with the solver in P0.2-b |
| T2.H9 | v0.2 | solver/validate | teacher exceeds max/day or max/week | never produced; detected | unit | ✅ (detection) | validate.test.ts; 'never produced' half lands with the solver in P0.2-b |
| T2.H10 | v0.2 | solver/validate | locked placement after re-solve | unchanged; validator flags a moved locked class (`mustKeep`) | unit | ✅ (detection) | validate.test.ts; solver half in P0.2-b |
| T2.H11 | v0.2 | solver/validate | other dept's room used without grant | never produced; detected | unit | ✅ (detection) | validate.test.ts; 'never produced' half lands with the solver in P0.2-b |
| T2.H12 | v0.2 | solver/validate | unknown assignment/room, outside the week, unassigned teacher, more periods than the curriculum | never produced; detected | unit | ✅ (detection) | validate.test.ts; 'never produced' half lands with the solver in P0.2-b |
| T2.H13 | v0.2 | solver/validate | teacher/room of college B used in college A | never produced; detected | unit | ✅ (detection) | validate.test.ts; 'never produced' half lands with the solver in P0.2-b |
| T2.H14 | v0.2 | solver/validate | shared teacher teaching two depts with different lunch slots | keeps ≥ 1 free slot in the lunch window each teaching day; violation detected | unit | ✅ (detection) | validate.test.ts; 'never produced' half lands with the solver in P0.2-b |
| T3 | v0.2 | solver | impossible input (lab demand > lab slots) | item unplaced with reason + suggestion, 0 conflicts | unit | ⏳ | |
| T4 | v0.2 | solver | same seed twice | identical output | unit | ⏳ | |
| T6a | v0.2 | score | score on demo | 0 ≤ score ≤ 100 | unit | ⏳ | |
| T6b | v0.2 | preflight | teacher assigned > maxPerWeek | warning returned | unit | ⏳ | |
| T35.1 | v0.35 | finder | free teachers at a demo slot | excludes busy/unavailable teachers | unit | ⏳ | |
| T35.2 | v0.35 | finder | free rooms by type & capacity | only matching, unbooked rooms | unit | ⏳ | |
| T35.3 | v0.35 | finder | commonFree(teacher A, teacher B) | intersection of free slots | unit | ⏳ | |
| T35.4 | v0.35 | finder | nextFree(teacher) | earliest free slot after given time | unit | ⏳ | |
| T35.5 | v0.35 | filters | filter by dept/teacher/room type/day | only matching placements | unit | ⏳ | |
| T4.1 | v0.4 | csv | parse pasted TSV/CSV teachers & assignments | correct rows, bad rows reported | unit | ⏳ | |
| T4.2 | v0.4 | store | persist → reload | identical state | unit | ⏳ | |
| T4.3 | v0.4 | store | export JSON → import JSON | identical data | unit | ⏳ | |
| T4.4 | v0.4 | access | collegeAdmin scope | sees all depts of own college only | unit | ⏳ | |
| T4.5 | v0.4 | structure | Super Admin changes sections count / strength / periods per day | sections regenerate; new calendar (e.g. 5 days × 5 periods) still solves with 0 conflicts | unit | ⏳ | |
| T4.6 | v0.4 | access | superAdmin scope | sees all colleges, cannot edit timetables; college A data never visible to college B users | unit | ⏳ | |
| T5.1 | v0.5 | access | HOD scope | sees/edits only own dept (+ shared/granted rooms read) | unit | ⏳ | |
| T5.2 | v0.5 | solver | dept A generate, then dept B generate | 0 global conflicts | unit | ⏳ | |
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
| T7.1 | v0.7 | replan | HOD approves a leave for a date | that date's adjusted timetable: absent teacher has no classes, each affected class has a substitute or moved slot, unaffected classes unchanged, 0 conflicts with `leave`; weekly master untouched | unit | ⏳ | |
| T7.2 | v0.7 | substitutes | suggestions | free, same dept, under max/day | unit | ⏳ | |
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
| M1 | Try each demo college → generate → "0 clashes — verified" seal | ⏳ |
| M2 | Create a tiny college from scratch via wizard (2 rooms, 2 teachers, 1 section) without help | ⏳ |
| M3 | HOD marks Ready → College Admin generates & publishes → teacher & student see it | ⏳ |
| M4 | HOD offers lab → other HOD requests → approve → borrower timetable uses it | ⏳ |
| M5 | Teacher requests leave → HOD picks substitute → student sees substitute notice | ⏳ |
| M6 | Who's free? finder + Ctrl+K search jump to timetable | ⏳ |
| M7 | Kaal Assistant answers 3 sample questions | ⏳ |
| M8 | Print preview: one clean timetable per A4 | ⏳ |
| M9 | Phone width (375px): student view readable, no horizontal scroll | ⏳ |
| M10 | Reduced motion: no GSAP animation; dark mode readable | ⏳ |
| M11 | Refresh browser: data kept | ⏳ |
| M12 | Login with each demo account (v0.9) | ⏳ |
| M13 | Super Admin creates a new college from scratch with a custom structure (own days, periods, depts, sections, strength) → timetable generates with 0 clashes | ⏳ |
| M14 | Student requests a meeting → teacher accepts with room → student sees accepted status | ⏳ |
