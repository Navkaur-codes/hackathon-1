import { useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { PrintHeader, PrintPreview } from '../../components/PrintSheets'
import { TimetableGrid } from '../../components/TimetableGrid'
import { buildGrid } from '../../lib/gridModel'
import { describeTimetable } from '../../solver/best'
import type { CollegeData, Id } from '../../types'

type Props = { college: CollegeData; teacherId: Id }

/** The teacher's weekly pattern from the published version, printable on one A4 page. */
export function WeekTab({ college, teacherId }: Props) {
  const timetable = college.published!.timetable
  const grid = buildGrid(college, timetable, 'teacher', teacherId)
  const result = useMemo(() => describeTimetable(college, timetable), [college, timetable])
  const [preview, setPreview] = useState(false)

  return (
    <section aria-labelledby="week-h" className="rounded-xl border border-rule bg-card p-5 print:border-0 print:p-0">
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <h2 id="week-h" className="mr-auto font-display text-lg font-semibold">
          My week <span className="font-mono text-[12px] font-normal text-muted">published v{college.published!.version} · repeats all semester</span>
        </h2>
        <button
          type="button"
          onClick={() => setPreview(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink px-3 py-1.5 text-[13px] font-medium transition hover:bg-ink hover:text-paper"
        >
          <Printer size={14} aria-hidden /> Print
        </button>
      </div>
      <PrintHeader college={college} grid={grid} result={result} />
      <TimetableGrid grid={grid} />
      {preview && (
        <PrintPreview
          college={college}
          timetable={timetable}
          result={result}
          grid={grid}
          mode="one"
          onMode={() => {}}
          onPrint={() => window.print()}
          onClose={() => setPreview(false)}
          allowAll={false}
        />
      )}
    </section>
  )
}
