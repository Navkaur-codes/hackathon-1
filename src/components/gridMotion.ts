// Grid motion (root CLAUDE.md §6): classes drop in on first show; on "Generate another" or a view switch,
// GSAP Flip glides each class from its old slot to its new one. Everything is skipped under reduced motion.
//
// React updates the DOM before effects run, so the "before" snapshot is taken by the caller right before
// it changes state (`captureGrid()`), and the grid animates from it after rendering (`animateGrid`).

import gsap from 'gsap'
import { Flip } from 'gsap/Flip'

gsap.registerPlugin(Flip)

type FlipState = ReturnType<typeof Flip.getState>

let pending: FlipState | null = null

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Snapshot the classes currently on screen — call right before changing what the grid shows. */
export function captureGrid() {
  if (reducedMotion()) return
  const cells = document.querySelectorAll<HTMLElement>('[data-grid] [data-cell]')
  pending = cells.length ? Flip.getState(cells) : null
}

/** Animate the grid after it rendered: Flip from the last snapshot, or a staggered drop-in the first time. */
export function animateGrid(container: HTMLElement, firstShow: boolean) {
  const cells = container.querySelectorAll<HTMLElement>('[data-cell]')
  const state = pending
  pending = null
  if (reducedMotion() || cells.length === 0) return

  if (state && !firstShow) {
    Flip.from(state, {
      targets: cells,
      duration: 0.6,
      ease: 'power2.inOut',
      stagger: 0.008,
      onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 0.35, delay: 0.25 }),
    })
  } else {
    gsap.from(cells, { autoAlpha: 0, y: -14, duration: 0.45, ease: 'power2.out', stagger: 0.018, clearProps: 'transform,opacity,visibility' })
  }
}
