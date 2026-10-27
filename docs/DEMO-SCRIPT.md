# Kaalchakra — demo script with test data

A 12-minute walk-through. **Part A** builds a brand-new college (GNDEC) from nothing, live, by pasting the data below. **Part B** uses the DIET demo college to show the rest. *(Updated 2026-10-27 for the final sign-in model.)*

- Live site: https://kaalchakra-seven.vercel.app
- Sign-in accounts (the sign-in page shows none of these — keep them handy): **Super Admin** `super` · **College Admin** `diet.admin`, `dcas.admin` — password **`kaalchakra`**. On the sign-in page pick the matching role in **Sign in as**.
- Teachers and students need **no account**: they open their department's public link.
- The data in Part A was run through the real code beforehand: it pastes with **0 errors** and generates with **0 clashes, 0 periods left out, quality 98 / 100**.

**Before you start:** open the site in a fresh browser window (or click *Reset demo data* in the footer).

---

## Part A — a new college from scratch (≈ 6 min)

### A1. Super Admin creates the college and its College Admin
1. Landing → **Sign in** → *Sign in as* **Super Admin**, `super` / `kaalchakra`.
2. **New college** → College name `Guru Nanak Dev Engineering College`, Short code `GNDEC`, College Admin's name `GNDEC Admin`, Username `gndec.admin`, Password `gndec-admin-1` → **Create college**. *(Say: that is all the Super Admin does — colleges and their admin logins.)*
3. *Sign out.*

### A2. The College Admin shapes the college
1. **Sign in** → *Sign in as* **College Admin**, `gndec.admin` / `gndec-admin-1` → the desk opens on **Structure**.
2. **Structure**:
   - **Calendar** — keep Mon–Fri, 6 periods from 09:00, 50 min, lunch in the 4th period. *(Say: nothing is hard-coded — days, periods, lunch, lab length are all settings.)*
   - **Departments & years** — add two departments, then a year for each (Level stays `UG`; type `PG` for a postgraduate year):

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

### A3. The College Admin fills in the setup
1. **Setup → Paste from Excel** → *Teachers* → paste (tab-separated, copied from Excel works too) → **Import**:
   ```
   Name	Department	Max per day	Max per week
   Dr. Amanpreet Singh	CSE	4	18
   Prof. Jasleen Kaur	CSE	4	18
   Dr. Rajiv Sharma	CSE	4	18
   Prof. Navneet Gill	IT	4	18
   Dr. Simran Bajwa	IT	4	18
   ```
2. **Error check moment** (optional, good to show) — paste these three bad rows in *Teachers* and show the line-by-line errors, then don't import them:
   ```
   Dr. Amanpreet Singh	CSE	4	18
   Prof. Harjit Singh	MECH	4	18
   Dr. Ravneet Kaur	IT	9	18
   ```
   Expected: *already a teacher here* · *No department "MECH" in GNDEC* · *Max a day must be a number from 1 to 6*.
3. *Rooms* → paste → **Import**:
   ```
   Name	Type	Seats	Owner
   LT-201	lecture	70	CSE
   LT-202	lecture	70	CSE
   CSE Lab 1	lab	60	CSE
   LT-301	lecture	70	IT
   IT Lab	lab	60	IT
   Seminar Hall	seminar	150	shared
   ```
4. *Who teaches what* → paste → **Import**:
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
5. *Teachers* tab → open **Prof. Navneet Gill** → click **Mon 09:00** and **Mon 09:50** to mark him unavailable. *(Say: the timetable will never put him there.)*
6. **Timetable → Generate timetable** → expect **0 clashes**, all periods placed, quality around 98. **View timetable**:
   - Pick section **CSE-Y2-A** — labs span two periods with stripes, lunch row shaded.
   - Click any class → **Clash Court** lists every rule it satisfies ("Dr. Amanpreet Singh has no other class then", "LT-201 seats 70 ≥ 60", "Lunch kept"…).
   - Teacher view → **Prof. Navneet Gill**: nothing on Monday 09:00–10:40.
7. **Publish** → version 1 → under **Public links · version 1** copy the **CSE** link and open it in a private window or on a phone: department, college, Faculty · UG / PG classes · Rooms, the timetable, then *Version 1 · updated …*. No sign-in, no way into the app. *(Say: publishing again makes new links for the new version.)*

> The college also keeps the starter department "General Studies" (Year 1, Teacher One / Two, Room 101) that every new college begins with — it generates too.

---

## Part B — the DIET demo (≈ 5 min)

Sign in as **College Admin** `diet.admin` / `kaalchakra`. The desk tabs are **Structure · Setup · Timetable · Conflicts · Insights**.

| # | Where | Do | Expect |
|---|---|---|---|
| B1 | **Structure** | Calendar shows Mon–Sat × 7 slots; Departments & years shows CSE / ECE / ME, ME Year 3 with a flexible lunch | Every number is a setting |
| B2 | **Timetable** | **Generate timetable** | 0 clashes, quality ~96, staggered lunch (ECE breaks later than CSE / ME) |
| B3 | **Timetable** → View timetable | Click a class → **Clash Court** → **Lock this class** → **Generate another** | The locked class stays; everything else moves; still 0 clashes |
| B4 | **Timetable** → View timetable | Who's free? → Friday after lunch, type *lab* | The free labs, shared ones marked |
| B5 | **Conflicts** | — | "No clashes anywhere" |
| B6 | **Insights** | — | Quality parts, teacher loads, room heatmap, idle rooms, Shared-Resource Ledger |
| B7 | **Timetable** → **Publish** | Public links · version n → open **ECE** | ECE's faculty, classes and rooms; the compact grid; "Version n · updated …" at the bottom |
| B8 | **Setup → Paste from Excel** | Paste a bad row | Line-by-line errors, nothing imported |

### Ask Kaal (College Admin, Ctrl + J) — good questions to type
- `Is Bedi free on Tuesday 3rd period?`
- `Which labs are free Friday after lunch?`
- `Where is CSE-Y2-A now?`
- `Who teaches DBMS?`
- `How many periods does Gill have this week?`
- `Any clashes?`

### Phone (1 min)
Open a department link on a phone: Now / Next for a class, the week grid scrolls inside its box, Print works.

---

## Talking points
- **Core:** an independent checker re-tests every hard rule (H1–H14: teacher, section and room never double-booked, room type and size, breaks, labs, limits, lunch for teachers…) on every generate and publish. Publishing is blocked on any clash.
- **Any college:** nothing is hard-coded — GNDEC was built live with its own days, periods, departments, sections and subjects.
- **Harder cases:** staggered and flexible lunch, labs as blocks, rooms shared and allocated across departments, locked classes, many colleges on one platform, public department links that work on any phone without the college's data.
- **Tests:** 423 automated tests (see `docs/TEST.md`); every feature also checked by hand in the browser.
- **Honest limit:** sign-in and data live in the browser (demo-grade); a public link carries the version it was made from, so each new publish means sharing new links. A real deployment would use an authentication service and a database with access rules per college.
