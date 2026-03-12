const CATEGORY_COLORS = {
  courses: '#7c6af7',
  passive: '#2dd4bf',
  work:    '#4fa5ff',
  health:  '#4ade80',
}

export default function ProgressBar({ value = 0, max = 100, colorKey, color, height = 6, showLabel = false }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const barColor = color || CATEGORY_COLORS[colorKey] || '#7c6af7'
  const overflow = pct >= 100

  return (
    <div className="w-full">
      <div
        className="relative w-full overflow-hidden rounded-full bg-surface-500"
        style={{ height }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: overflow
              ? 'linear-gradient(90deg, #4ade80, #22d3ee)'
              : barColor,
            boxShadow: overflow ? `0 0 8px ${barColor}60` : undefined,
          }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-surface-400 mt-1 block">
          {value} / {max}
        </span>
      )}
    </div>
  )
}
