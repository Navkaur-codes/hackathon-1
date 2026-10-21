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
  /** 0-based period index that is a break. */
  period: number
  /** 0-based day indexes this applies to; omitted = every working day. */
  days?: number[]
  label?: string
}

export type Calendar = {
  collegeId: Id
  /** Working day labels in order, e.g. ['Mon','Tue','Wed','Thu','Fri']. Any subset, any order. */
  days: string[]
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

// ── Workflows ─────────────────────────────────────────────────────────

export type Grant = {
  id: Id
  collegeId: Id
  roomId: Id
  fromDeptId: Id
  toDeptId: Id
  slots: SlotKey[] | 'all'
  status: 'offered' | 'requested' | 'approved' | 'rejected' | 'revoked'
}

export type LeaveRequest = {
  id: Id
  collegeId: Id
  teacherId: Id
  day: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
}

export type Substitution = {
  id: Id
  collegeId: Id
  assignmentId: Id
  day: number
  period: number
  substituteTeacherId: Id
}

export type OfficeHours = {
  collegeId: Id
  teacherId: Id
  slots: SlotKey[]
  accepting: boolean
}

export type MeetingRequest = {
  id: Id
  collegeId: Id
  studentName: string
  sectionId: Id
  teacherId: Id
  day: number
  period: number
  topic: string
  note: string
  status: 'pending' | 'accepted' | 'proposed' | 'declined' | 'needsReschedule'
  roomId?: Id
  proposedSlot?: SlotKey
}

export type Session = {
  role: Role
  collegeId?: Id
  deptId?: Id
  teacherId?: Id
  sectionId?: Id
}

/** Everything that belongs to one college. */
export type CollegeData = {
  college: College
  calendar: Calendar
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
  draft?: Timetable
  published?: Published
}

export type Platform = {
  colleges: CollegeData[]
}
