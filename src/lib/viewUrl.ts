// The timetable page's state as a URL query, so a filtered view can be bookmarked or shared.
// `seed` reproduces the exact timetable (the solver is deterministic per seed).

import type { Id } from '../types'
import { fromSearch, toSearch, type Filters } from './filters'
import type { GridView } from './gridModel'

export type ViewState = {
  collegeId: Id
  seed: number
  view: GridView
  /** Empty = the first entity of the view. */
  entityId: Id
  filters: Filters
}

const VIEWS: GridView[] = ['section', 'teacher', 'room']

/** `college=…&seed=…&view=…&id=…` followed by the filter params. */
export function viewToSearch(s: ViewState): string {
  const q = new URLSearchParams()
  q.set('college', s.collegeId)
  q.set('seed', String(s.seed))
  q.set('view', s.view)
  if (s.entityId) q.set('id', s.entityId)
  const f = toSearch(s.filters)
  return f ? `${q}&${f}` : q.toString()
}

/** Inverse of `viewToSearch`; null when the query does not name a college and seed. */
export function viewFromSearch(search: string): ViewState | null {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const collegeId = q.get('college')
  const seed = q.get('seed')
  if (!collegeId || !seed || !/^\d+$/.test(seed)) return null
  const view = q.get('view') as GridView | null
  return {
    collegeId,
    seed: Number(seed),
    view: view && VIEWS.includes(view) ? view : 'section',
    entityId: q.get('id') ?? '',
    filters: fromSearch(search),
  }
}
