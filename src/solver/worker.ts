// Web Worker: solving runs off the main thread so the UI never freezes.
import type { CollegeData } from '../types'
import { solveBest, type BestOptions } from './best'

export type SolveRequest = { id: number; college: CollegeData; opts?: BestOptions }

self.onmessage = (e: MessageEvent<SolveRequest>) => {
  const { id, college, opts } = e.data
  try {
    self.postMessage({ id, ok: true, result: solveBest(college, opts) })
  } catch (err) {
    self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
