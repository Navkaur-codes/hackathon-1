# Kaalchakra — demo script with test data

A 15-minute walk-through for showing progress. **Part A** builds a brand-new college (GNDEC) from nothing, live, by pasting the data below. **Part B** uses the richer DIET demo college to show everything else.

- Live site: https://kaalchakra-seven.vercel.app
- Every demo account's password: **`kaalchakra`**
- The data in Part A was run through the real code beforehand: it pastes with **0 errors** and generates with **0 clashes, 0 periods left out, quality 98 / 100**.

**Before you start:** open the site in a fresh browser window (or click *Reset demo data* in the footer). Then, so the teacher and student desks have something to show, sign in as **`diet.admin`** → *Timetable* → **Generate timetable** → **Publish**.

---

## Part A — a new college from scratch (≈ 6 min)

### A1. Super Admin creates the college
1. *Sign in* → demo chip **Super Admin** (`super`).
2. **New college** → Name `Guru Nanak Dev Engineering College`, Short code `GNDEC` → create.
3. **Structure** (Structure Builder):
   - **Calendar** — keep Mon–Fri, 6 periods from 09:00, 50 min, lunch in the 4th period. *(Say: nothing is hard-coded — days, periods, lunch, lab length are all settings.)*
   - **Departments & years** — add two departments, then a year for each:

     | Department code | Department name | Year name | Short name | Sections | Students each |
     |---|---|---|---|---|---|
     | `CSE` | `Computer Science & Engineering` | `B.Tech CSE Year 2` | `Y2` | `2` | `60` |
     | `IT` | `Information Technology` | `B.Tech IT Year 2` | `Y2` | `1` | `60` |

     Sections appear automatically: **CSE-Y2-A, CSE-Y2-B, IT-Y2-A**.
   - **Subjects** — add to each year:

     | Year | Code | Name | Kind | Periods / week | Room type |
     |---|---|---|---|---|---|
     | CSE Year 2 | `DS` | `Data Structures` | theory | 4 | lecture |
     | CSE Year 2 | `DBMS` | `Database Systems` | theory | 3 | lecture |
     | CSE Year 2 | `OOP` | `Object Oriented Programming` | theory | 3 | lecture |
     | CSE Year 2 | `DSL` | `Data Structures Lab` | lab | 2 | lab |
     | IT Year 2 | `CN` | `Computer Networks` | theory | 4 | lecture |
     | IT Year 2 | `WT` | `Web Technologies` | theory | 3 | lecture |
     | IT Year 2 | `WTL` | `Web Technologies Lab` | lab | 2 | lab |
4. Back to **All colleges** → GNDEC card → **Manage accounts** → **Add an account**: Name shown `GNDEC Admin`, Username `gndec.admin`. **Copy the temporary password** shown → Create.
5. *Sign out.*

### A2. The College Admin fills in the college
1. Sign in as `gndec.admin` with the temporary password → it asks for a new one → type `gndec-admin-1` twice. *(Say: a new account must choose its own password; only a salted hash is stored.)*
2. **Setup → Paste from Excel** → *Teachers* → paste (tab-separated, copied from Excel works too) → **Import**:
   ```
   Name	Department	Max per day	Max per week
   Dr. Amanpreet Singh	CSE	4	18
   Prof. Jasleen Kaur	CSE	4	18
   Dr. Rajiv Sharma	CSE	4	18
   Prof. Navneet Gill	IT	4	18
   Dr. Simran Bajwa	IT	4	18
   ```
3. **Error check moment** (optional, good to show) — paste these three bad rows in *Teachers* and show the line-by-line errors, then don't import them:
   ```
   Dr. Amanpreet Singh	CSE	4	18
   Prof. Harjit Singh	MECH	4	18
   Dr. Ravneet Kaur	IT	9	18
   ```
   Expected: *already a teacher here* · *No department "MECH" in GNDEC* · *Max a day must be a number from 1 to 6*.
4. *Rooms* → paste → **Import**:
   ```
   Name	Type	Seats	Owner
   LT-201	lecture	70	CSE
   LT-202	lecture	70	CSE
   CSE Lab 1	lab	60	CSE
   LT-301	lecture	70	IT
   IT Lab	lab	60	IT
   Seminar Hall	seminar	150	shared
   ```
5. *Who teaches what* → paste → **Import**:
   ```
   Section	Subject	Teacher
   CSE-Y2-A	DS	Dr. Amanpreet Singh
   CSE-Y2-A	DBMS	Prof. Jasleen Kaur
   CSE-Y2-A	OOP	Dr. Rajiv Sharma
   CSE-Y2-A	DSL	Dr. Amanpreet Singh
   CSE-Y2-B	DS	Prof. Jasleen Kaur
   CSE-Y2-B	DBMS	Dr. Rajiv Sharma
   CSE-Y2-B	OOP	Dr. Amanpreet Singh
   CSE-Y2-B	DSL	Prof. Jasleen Kaur
   IT-Y2-A	CN	Prof. Navneet Gill
   IT-Y2-A	WT	Dr. Simran Bajwa
   IT-Y2-A	WTL	Dr. Simran Bajwa
   ```
6. *Teachers* tab → open **Prof. Navneet Gill** → click **Mon 09:00** and **Mon 09:50** to mark him unavailable. *(Say: the timetable will never put him there.)*
7. **Timetable → Generate timetable** → expect **0 clashes**, all periods placed, quality around 98. **View timetable**:
   - Pick section **CSE-Y2-A** — labs span two periods with stripes, lunch row shaded.
   - Click any class → **Clash Court** lists every rule it satisfies ("Dr. Amanpreet Singh has no other class then", "LT-201 seats 70 ≥ 60", "Lunch kept"…).
   - Teacher view → **Prof. Navneet Gill**: nothing on Monday 09:00–10:40.
8. **Publish** → version 1.

> The college also keeps the starter department "General Studies" (Year 1, Teacher One / Two, Room 101) that every new college begins with — it generates too.

---

## Part B — every role on the DIET demo (≈ 9 min)

Use the demo chips on the login page. Make sure DIET was generated and published (see *Before you start*).

| # | Sign in as | Show | What to look for |
|---|---|---|---|
| B1 | `diet.admin` | **Timetable** → View timetable → click a class → **Lock this class** → **Generate another** | The locked class stays; everything else moves; still 0 clashes |
| B2 | `diet.admin` | **Conflicts** tab | "No clashes anywhere" |
| B3 | `diet.admin` | **Insights** tab | Quality parts, teacher loads, room heatmap, idle rooms, Shared-Resource Ledger |
| B4 | `diet.cse.hod` | **Overview** | Readiness checklist → **Generate my department** → **Mark Ready** |
| B5 | `diet.cse.hod` | **Room Exchange** → *Book a room for a day* | Seminar Hall, a date next week, a free period, purpose `Guest lecture` → request (goes to the College Admin) |
| B6 | `diet.kaur` | **Today** → change the date to **9 Nov** | "Holiday — Diwali break" |
| B7 | `diet.kaur` | **Leave** → a teaching date next week, reason `Conference at PU` → Ask for leave | "Waiting for HOD" |
| B8 | `diet.cse.hod` | **Leave** → **Approve & cover** | A substitute is chosen for every class (same department first); swap one; "0 clashes" stamp |
| B9 | `diet.cse-y2-a` | Type your name `Simran` → **Today** on that date | Notice: "*X* takes it instead of Dr. Harpreet Kaur" |
| B10 | `diet.cse-y2-a` | **Meet a teacher** → Dr. Harpreet Kaur, a date → pick a ★ office-hour or free time → topic `Doubt in trees` → Ask | "Waiting" |
| B11 | `diet.kaur` | **Meetings** → Accept with a room | Student sees "Accepted" with the room |
| B12 | `diet.cse-y2-a` | **Share** → Open the link (or on a phone) | Read-only week, no sign-in needed |
| B13 | any desk | **Ask Kaal** (Ctrl + J) | Admin: `Which labs are free Friday after lunch?` · Student: same question → politely refused · Student: `What's my next class?` |
| B14 | `diet.admin` | **Setup → People** → add a teacher account → sign in as it | Forced new password; then **Disable** it → sign-in refused |

### Ask Kaal — good questions to type
- `Is Bedi free on Tuesday 3rd period?`
- `Which labs are free Friday after lunch?`
- `Where is CSE-Y2-A now?`
- `Who teaches DBMS?`
- `How many periods does Gill have this week?`
- `Is the seminar hall booked on Wednesday?`
- `When is the next holiday?`
- `Any clashes?` (College Admin)
- Student: `Can I meet Kaur tomorrow?` → Request buttons right in the answer

### Phone and dark mode (1 min)
Open the site on a phone, sign in as `diet.cse-y2-a`: Now / Next card, today's classes, the week grid scrolls inside its box. Switch the phone to dark mode — the whole app follows.

---

## Talking points
- **Core:** an independent checker re-tests every hard rule (H1–H14: teacher, section and room never double-booked, room type and size, breaks, labs, limits, lunch for teachers…) on every generate and publish. Publishing is blocked on any clash.
- **Any college:** nothing is hard-coded — GNDEC was built live with its own days, periods, departments, sections and subjects.
- **Harder cases:** staggered and flexible lunch, labs as blocks, rooms shared across departments, leave with automatic substitutes, locked classes, many colleges on one platform.
- **Tests:** 407 automated tests (see `docs/TEST.md`); every feature also checked by hand in the browser.
- **Honest limit:** sign-in and data live in the browser (demo-grade). A real deployment would use an authentication service and a database with access rules per college.
