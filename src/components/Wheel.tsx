import { forwardRef } from 'react'

type WheelProps = {
  size?: number
  spokes?: number
  className?: string
}

/** The Kaalchakra mark: a time-wheel drawn in ink with a vermilion hub. Purely decorative. */
export const Wheel = forwardRef<SVGSVGElement, WheelProps>(function Wheel(
  { size = 320, spokes = 12, className },
  ref,
) {
  const c = 100
  const ticks = Array.from({ length: 60 }, (_, i) => i)
  const spokeAngles = Array.from({ length: spokes }, (_, i) => (360 / spokes) * i)

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="Kaalchakra wheel"
    >
      <circle cx={c} cy={c} r={92} fill="none" stroke="var(--ink)" strokeWidth={2.5} />
      <circle cx={c} cy={c} r={84} fill="none" stroke="var(--rule)" strokeWidth={1} />
      {ticks.map((i) => {
        const long = i % 5 === 0
        const a = (i * 6 * Math.PI) / 180
        const r1 = long ? 76 : 80
        return (
          <line
            key={i}
            x1={c + Math.sin(a) * r1}
            y1={c - Math.cos(a) * r1}
            x2={c + Math.sin(a) * 84}
            y2={c - Math.cos(a) * 84}
            stroke={long ? 'var(--ink)' : 'var(--muted)'}
            strokeWidth={long ? 1.6 : 0.8}
          />
        )
      })}
      <g data-wheel-spokes>
        {spokeAngles.map((deg) => (
          <g key={deg} transform={`rotate(${deg} ${c} ${c})`}>
            <line x1={c} y1={c - 16} x2={c} y2={c - 66} stroke="var(--ink)" strokeWidth={2} strokeLinecap="round" />
            <circle cx={c} cy={c - 66} r={3} fill="var(--card)" stroke="var(--ink)" strokeWidth={1.5} />
          </g>
        ))}
        <circle cx={c} cy={c} r={66} fill="none" stroke="var(--ink)" strokeWidth={1.2} strokeDasharray="2 5" />
      </g>
      <circle cx={c} cy={c} r={16} fill="var(--vermilion)" />
      <circle cx={c} cy={c} r={6} fill="var(--paper)" />
    </svg>
  )
})
