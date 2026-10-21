// Promise wrapper the UI calls. Uses the Web Worker in the browser; falls back to solving inline where
// workers are unavailable (tests, very old browsers) so behaviour is identical either way.

import type { CollegeData } from '../types'
import { solveBest, type BestOptions, type SolveResult } from './best'

type Reply = { id: number; ok: true; result: SolveResult } | { id: number; ok: false; error: string }

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (r: SolveResult) => void; reject: (e: Error) => void }>()

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<Reply>) => {
      const p = pending.get(e.data.id)
      if (!p) return
      pending.delete(e.data.id)
      if (e.data.ok) p.resolve(e.data.result)
      else p.reject(new Error(e.data.error))
    }
  }
  return worker
}

export function runSolver(college: CollegeData, opts?: BestOptions): Promise<SolveResult> {
  const w = getWorker()
  if (!w) return Promise.resolve(solveBest(college, opts))
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage({ id, college, opts })
  })
}
