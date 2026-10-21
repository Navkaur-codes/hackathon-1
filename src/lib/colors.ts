// Deterministic muted pastel per subject (Paper & Ink "sticky notes"). Text on them is always dark ink,
// in light and dark mode, so contrast stays ≥ 4.5:1.

export const CELL_INK = '#1C1B19'

export const SUBJECT_PALETTE = [
  '#F2D7C6', // apricot
  '#EFE0B4', // ochre
  '#DCE4D3', // sage
  '#EED3D9', // rose
  '#DFD8EE', // lilac
  '#E6DECB', // sand
  '#D6E1E3', // mist
  '#F1CFBF', // terracotta
  '#E3E7C4', // pistachio
  '#E9D6E8', // mauve
]

/** FNV-1a hash → stable index; same subject code always gets the same colour. */
export function subjectColor(code: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return SUBJECT_PALETTE[(h >>> 0) % SUBJECT_PALETTE.length]
}

/** WCAG relative luminance contrast ratio between two hex colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
