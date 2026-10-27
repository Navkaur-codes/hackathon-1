export const BUILDER_TABS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'semester', label: 'Semester' },
  { id: 'departments', label: 'Departments & years' },
  { id: 'subjects', label: 'Subjects' },
] as const

export type BuilderTab = (typeof BUILDER_TABS)[number]['id']

export const asBuilderTab = (s: string | undefined): BuilderTab => BUILDER_TABS.find((t) => t.id === s)?.id ?? 'calendar'
