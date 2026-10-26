// Kaalchakra data model. Every college-owned record carries `collegeId` (rule G1).
// Nothing here fixes how many days, periods, departments, sections or subjects a college has (rule G2).

export type Id = string

/** `${dayIndex}-${periodIndex}`, both 0-based indexes into the college calendar. */
export type SlotKey = `${number}-${number}`

export type Role = 'superAdmin' | 'collegeAdmin' | 'deptAdmin' | 'teacher' | 'student'
export type RoomType = 'lecture' | 'lab' | 'seminar'
export type SubjectKind = 'theory' | 'lab'
export type DeptStatus = 'draft' | 'ready' | 'published'

// ── Platform & college ────────────────────────────────────────────────

export type College = {
  id: Id
  code: string
  name: string
  status: 'active' | 'archived'
  collegeAdminIds: Id[]
}

/**
 * A break occupies one slot of the shared period grid. Different groups may break at different slots
 * (staggered lunch), so every section still shares one clock and clashes stay checkable.
 */
export type BreakRule = {
  /** 0-based period index that is a break (for a flexible break: the preferred slot). */
  period: number
  /** 0-based day indexes this applies to; omitted = every working day. */
  days?: number[]
  label?: string
  /**
   * Flexible break: on each of its days exactly one of these slots stays free as the break, chosen by the
   * solver for a better timetable (e.g. lunch at 11:30 or 12:20). Omitted = a fixed break at `period`.
   */
  options?: number[]
}

export type Calendar = {
  collegeId: Id
  /** Working day labels in order, e.g. ['Mon','Tue','Wed','Thu','Fri']. Any subset, any order. */
  days: string[]
  /** Real weekday of each working day (0 = Sunday … 6 = Saturday), same order as `days`. Maps semester dates to the pattern. */
  weekdays: number[]
  /** Number of slots per day in the shared grid (teaching periods + break slots). */
  periodsPerDay: number
  /** 'HH:MM' start of the first slot. */
  startTime: string
  /** Default slot length in minutes. */
  periodMinutes: number
  /** Optional per-slot lengths (e.g. a 30-min lunch slot); missing entries use `periodMinutes`. */
  periodLengths?: number[]
  /** College default breaks. Departments, programmes and sections may override them. */
  breaks: BreakRule[]
  /** Slots where lunch may fall; every teacher keeps ≥ `teacherMinFreeInLunchWindow` of them free on days they teach. */
  lunchWindow: number[]
  teacherMinFreeInLunchWindow: number
  /** College-wide slots where nothing may be scheduled (assembly, sports hour…). */
  blockedSlots: SlotKey[]
  /** Default length of a lab block in periods (a subject may override it). */
  labBlockLength: number
  maxMeetingRequestsPerStudent: number
}

/**
 * The semester the timetable runs for. The solver builds one clash-free weekly pattern; it is rolled out
 * over every working date between `startDate` and `endDate`, skipping holidays and no-class dates.
 */
export type Semester = {
  collegeId: Id
  name: string
  /** ISO dates, inclusive. */
  startDate: string
  endDate: string
  holidays: { date: string; label: string }[]
  /** Working dates without regular classes (exams, fest, orientation…). */
  noClassDates: { date: string; label: string }[]
}

// ── Structure (defined by the Super Admin) ─────────────────────────────

export type Department = {
  id: Id
  collegeId: Id
  code: string
  name: string
  status: DeptStatus
  /** Overrides the college breaks for this department. */
  breaks?: BreakRule[]
}

/** A year / semester / programme inside a department, e.g. "B.Tech Year 2". */
export type Programme = {
  id: Id
  collegeId: Id
  deptId: Id
  name: string
  /** Short label used in section names, e.g. "Y2". */
  shortName: string
  sectionsCount: number
  defaultStrength: number
  /** Overrides the department/college breaks for this year. */
  breaks?: BreakRule[]
}

export type Section = {
  id: Id
  collegeId: Id
  deptId: Id
  programmeId: Id
  name: string
  strength: number
  /** Overrides programme/department/college breaks for this section. */
  breaks?: BreakRule[]
}

/** Curriculum item of a programme (rule G5). Every section of the programme takes it. */
export type Subject = {
  id: Id
  collegeId: Id
  deptId: Id
  programmeId: Id
  code: string
  name: string
  kind: SubjectKind
  periodsPerWeek: number
  /** Lab block length in periods; falls back to `calendar.labBlockLength`. */
  blockLength?: number
  roomType: RoomType
}

// ── Resources ─────────────────────────────────────────────────────────

export type Teacher = {
  id: Id
  collegeId: Id
  deptId: Id
  name: string
  maxPerDay: number
  maxPerWeek: number
  unavailable: SlotKey[]
}

export type Room = {
  id: Id
  collegeId: Id
  name: string
  type: RoomType
  capacity: number
  /** Owning department id, or 'shared' for college-wide rooms. */
  owner: Id | 'shared'
}

/** Who teaches which subject to which section. `teacherId` is null until someone assigns one. */
export type Assignment = {
  id: Id
  collegeId: Id
  sectionId: Id
  subjectId: Id
  teacherId: Id | null
}

// ── Timetable ─────────────────────────────────────────────────────────

export type Placement = {
  assignmentId: Id
  collegeId: Id
  deptId: Id
  day: number
  period: number
  /** Number of consecutive periods (1 for theory, block length for labs). */
  length: number
  roomId: Id
  locked: boolean
}

export type Unplaced = {
  assignmentId: Id
  /** How many periods of this assignment could not be placed. */
  periods: number
  reason: string
  suggestion: string
}

export type Timetable = {
  collegeId: Id
  seed: number
  placements: Placement[]
  unplaced: Unplaced[]
}

export type Published = {
  timetable: Timetable
  version: number
  /** ISO timestamp. */
  at: string
}

/** One line of a college's publish history (newest last). */
export type PublishEntry = {
  version: number
  at: string
  /** Quality score 0–100 of the version when it was published. */
  score: number
  periods: number
  unplaced: number
  /** Set when the version was later taken down. */
  unpublishedAt?: string
}

// ── Workflows ─────────────────────────────────────────────────────────

/**
 * A room loan between departments (Room Exchange): `fromDeptId` owns the room, `toDeptId` may use it in `slots`
 * once `approved`. Weekly slots — the loan repeats every week of the semester.
 * Flow: request → approved / rejected (owner decides) · offer → approved / rejected (borrower decides) ·
 * approved → revoked (owner).
 */
export type Grant = {
  id: Id
  collegeId: Id
  roomId: Id
  fromDeptId: Id
  toDeptId: Id
  slots: SlotKey[] | 'all'
  status: 'offered' | 'requested' | 'approved' | 'rejected' | 'revoked'
  /**
   * Who started it: the borrower asked (`request`), the owner offered (`offer`), or the College Admin's timetable
   * put a class in the room for the semester (`allocation` — derived by `lib/allocation.ts`, not revocable by HODs).
   */
  kind?: 'request' | 'offer' | 'allocation'
  note?: string
  /** ISO timestamps. */
  createdAt?: string
  decidedAt?: string
}

/**
 * A room for ONE date (extra class, seminar, test) — it never changes the weekly pattern. Approved by the HOD who
 * owns the room (shared rooms: the College Admin); a department's own room is approved at once.
 */
export type RoomBooking = {
  id: Id
  collegeId: Id
  roomId: Id
  /** The department asking. */
  deptId: Id
  /** ISO date. */
  date: string
  /** Slot indexes on that date. */
  periods: number[]
  purpose: string
  /** `needsNewRoom`: a later published version needs one of these periods for a class. */
  status: 'requested' | 'approved' | 'declined' | 'withdrawn' | 'needsNewRoom'
  createdAt: string
  decidedAt?: string
}

/** Leave is for one calendar date; it never changes the weekly master timetable (see docs/CLAUDE.md). */
export type LeaveRequest = {
  id: Id
  collegeId: Id
  teacherId: Id
  /** ISO date, e.g. '2026-10-26'. */
  date: string
  /** Working-day index of that date in the college calendar. */
  day: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  /** ISO timestamp of the request. */
  createdAt?: string
}

/**
 * A change for one date only, created when the HOD approves a leave. The weekly pattern never changes.
 * Kaalchakra auto-allots the best free teacher ('suggested'); the HOD may swap it, then it is 'confirmed'.
 */
export type Substitution = {
  id: Id
  collegeId: Id
  /** ISO date the change applies to. */
  date: string
  /** The leave that caused it. */
  leaveId?: Id
  assignmentId: Id
  day: number
  period: number
  /** Teacher normally teaching this class (the one on leave). */
  originalTeacherId: Id
  /** Free teacher allotted to the same slot, or null when nobody is free (class uncovered). */
  substituteTeacherId: Id | null
  status: 'suggested' | 'confirmed' | 'uncovered'
  /** Why this teacher was picked, e.g. "Same department · teaches DS · 2 periods that day". */
  note: string
  /** Optional alternative when no one is free: move the class to another free slot that week. */
  movedTo?: { day: number; period: number; roomId: Id }
}

export type OfficeHours = {
  collegeId: Id
  teacherId: Id
  slots: SlotKey[]
  accepting: boolean
}

/**
 * Meet-a-Teacher: a student asks for one slot on a real date when both are free in the published timetable.
 * Flow: pending → accepted (optionally with a room) / proposed (another time; the student takes it or not) /
 * declined · withdrawn by the student · needsReschedule when a newer published version puts a class there.
 * Meetings never block teaching.
 */
export type MeetingRequest = {
  id: Id
  collegeId: Id
  studentName: string
  sectionId: Id
  teacherId: Id
  /** ISO date and its pattern day. */
  date: string
  day: number
  period: number
  topic: string
  note: string
  status: 'pending' | 'accepted' | 'proposed' | 'declined' | 'withdrawn' | 'needsReschedule'
  roomId?: Id
  /** The teacher's other time, while `proposed`. */
  proposed?: { date: string; period: number }
  /** The teacher's answer. */
  reply?: string
  createdAt: string
  decidedAt?: string
}

export type Session = {
  role: Role
  collegeId?: Id
  deptId?: Id
  teacherId?: Id
  sectionId?: Id
  /** A student types their name once (meeting requests); real accounts arrive in v0.9. */
  studentName?: string
}

/** Everything that belongs to one college. */
export type CollegeData = {
  college: College
  calendar: Calendar
  semester: Semester
  departments: Department[]
  programmes: Programme[]
  sections: Section[]
  subjects: Subject[]
  teachers: Teacher[]
  rooms: Room[]
  assignments: Assignment[]
  grants: Grant[]
  leaves: LeaveRequest[]
  substitutions: Substitution[]
  officeHours: OfficeHours[]
  meetings: MeetingRequest[]
  /** Draft weekly pattern being worked on. */
  draft?: Timetable
  /** The structure or setup changed after the draft was generated: viewable, but generate again before publishing. */
  draftStale?: boolean
  /** The weekly pattern everyone follows for the semester (with date-specific substitutions on top). */
  published?: Published
  /** Every version ever published, newest last (missing = none yet). */
  publishLog?: PublishEntry[]
  /** Single-date room bookings (missing = none yet). */
  bookings?: RoomBooking[]
}

export type Platform = {
  colleges: CollegeData[]
}
